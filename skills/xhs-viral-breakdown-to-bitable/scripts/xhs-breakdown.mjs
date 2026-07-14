#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configPath, indexPath, loadConfig, loadIndex, normalizeConfig, saveIndex, validateConfig, writeJsonAtomic } from './lib/config.mjs';
import { identities, selectPending } from './lib/dedupe.mjs';
import { extractOne, extractUrls } from './lib/xhs.mjs';
import { batchCreate, createBase, discoverLark, inspectLarkAuth, listRecords, setVisibleFields, valuesAsStrings } from './lib/lark.mjs';
import { extractionOutcome } from './lib/outcome.mjs';
import { writeXlsx } from './lib/xlsx.mjs';

const IMAGE_FIELDS = ['标题', '正文', '链接', '话题', '封面', '点赞', '收藏', '评论', '转发', '图片', '封面分析', '互动诱因', '爆款原因', '可复制点'];
const VIDEO_FIELDS = ['标题', '链接', '封面', '作者', '视频时长', '点赞数', '收藏数', '评论数', '分享数', '正文', '口播文案（原始字幕）', '爆款拆解', '可复制部分'];
const IMAGE_FIELD_SCHEMA = [
  { name: '标题', type: 'text' }, { name: '正文', type: 'text' }, { name: '链接', type: 'text', style: { type: 'url' } }, { name: '话题', type: 'text' },
  { name: '封面', type: 'text', style: { type: 'url' } }, { name: '点赞', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '收藏', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '评论', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '转发', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '图片', type: 'text' }, { name: '封面分析', type: 'text' }, { name: '互动诱因', type: 'text' },
  { name: '爆款原因', type: 'text' }, { name: '可复制点', type: 'text' },
];
const VIDEO_FIELD_SCHEMA = [
  { name: '标题', type: 'text' }, { name: '链接', type: 'text', style: { type: 'url' } }, { name: '封面', type: 'text', style: { type: 'url' } }, { name: '作者', type: 'text' },
  { name: '视频时长', type: 'text' }, { name: '点赞数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '收藏数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '评论数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '分享数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '正文', type: 'text' }, { name: '口播文案（原始字幕）', type: 'text' },
  { name: '爆款拆解', type: 'text' }, { name: '可复制部分', type: 'text' },
];

function json(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function fail(message, code = 1) { json({ ok: false, error: message }); process.exit(code); }

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) result._.push(arg);
    else {
      const key = arg.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) result[key] = argv[++i];
      else result[key] = true;
    }
  }
  return result;
}

function readInput(args) {
  if (args.input) return fs.readFileSync(path.resolve(args.input), 'utf8');
  if (args.text) return String(args.text);
  return args._.join(' ');
}

function ensureNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) throw new Error(`需要 Node.js 18+，当前为 ${process.versions.node}`);
}

function bindingReady(binding) {
  return Boolean(binding?.base_token && binding?.table_id && binding?.view_id);
}

function analysisErrors(item) {
  if (item.status !== 'success') return [];
  const required = item.type === 'video' ? ['viral_breakdown', 'reusable_tactics'] : ['body_summary', 'cover_analysis', 'interaction_drivers', 'viral_reasons', 'reusable_tactics'];
  return required.filter((key) => !item.analysis?.[key]).map((key) => `${item.note_id || item.original_url} 缺少 analysis.${key}`);
}

function duration(value) {
  if (!Number.isFinite(value)) return '';
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return minutes ? `${minutes}分${String(seconds).padStart(2, '0')}秒` : `${seconds}秒`;
}

function rowFor(item) {
  const d = item.data || {};
  const m = d.metrics || {};
  const a = item.analysis || {};
  if (item.type === 'video') return [d.title, item.original_url, d.cover_url, d.author, duration(d.duration_seconds), m.liked, m.collected, m.commented, m.shared, d.description, d.transcript || '未获取字幕', a.viral_breakdown, a.reusable_tactics];
  return [d.title, a.body_summary, item.original_url, (d.topics || []).map((topic) => `#${String(topic).replace(/^#/, '')}`).join(' '), d.cover_url, m.liked, m.collected, m.commented, m.shared, (d.image_urls || []).slice(1).join('\n'), a.cover_analysis, a.interaction_drivers, a.viral_reasons, a.reusable_tactics];
}

function xlsxRows(items, type) {
  const fields = type === 'video' ? VIDEO_FIELDS : IMAGE_FIELDS;
  return [fields, ...items.filter((item) => item.type === type).map(rowFor)];
}

async function checkNetwork() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://www.xiaohongshu.com/', {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 xhs-viral-breakdown-doctor' },
    });
    return { ready: response.status < 500, status: response.status };
  } catch (error) {
    return { ready: false, reason: error.name === 'AbortError' ? '访问超时' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function doctor(args = {}) {
  const configFile = configPath();
  let configStatus = 'missing';
  let configErrors = [];
  try {
    const loaded = loadConfig({ migrate: false });
    if (loaded.config) {
      configErrors = validateConfig(loaded.config);
      configStatus = configErrors.length ? 'invalid' : 'ready';
    }
  } catch (error) { configStatus = 'invalid'; configErrors = [error.message]; }
  const lark = discoverLark();
  const loaded = configStatus === 'ready' ? loadConfig({ migrate: false }).config : null;
  const identity = loaded?.feishu?.identity || 'bot';
  const auth = inspectLarkAuth(lark, identity);
  const outputDir = path.join(os.homedir(), 'Documents', 'xhs-viral-breakdown-backups');
  let output = { ready: true, path: outputDir };
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.accessSync(outputDir, fs.constants.W_OK);
  } catch (error) { output = { ready: false, path: outputDir, reason: error.message }; }
  const network = args['skip-network'] ? { ready: null, skipped: true } : await checkNetwork();
  const nodeReady = Number(process.versions.node.split('.')[0]) >= 18;
  const ok = nodeReady && Boolean(lark) && auth.ready && configStatus === 'ready' && output.ready && network.ready !== false;
  json({ ok, node: { ready: nodeReady, version: process.versions.node }, platform: process.platform, network, lark_cli: lark ? { available: true, version: lark.version, auth } : { available: false, auth }, config: { path: configFile, status: configStatus, errors: configErrors }, archive_index: indexPath(), output });
  if (!ok) process.exitCode = 2;
}

async function configure(args) {
  ensureNode();
  if (args.migrate) {
    const loaded = loadConfig({ migrate: true });
    if (!loaded.config) return json({ ok: false, action: 'migrate', reason: '未找到旧配置', target: loaded.path });
    return json({ ok: true, action: loaded.migrated ? 'migrated' : 'already_configured', path: loaded.path, legacy_path: loaded.legacy_path || null });
  }
  if (args.bind) {
    const config = normalizeConfig(JSON.parse(fs.readFileSync(path.resolve(args.bind), 'utf8')));
    const errors = validateConfig(config);
    if (errors.length) throw new Error(errors.join('；'));
    writeJsonAtomic(configPath(), config);
    return json({ ok: true, action: 'bound', path: configPath() });
  }
  if (args.create || args['create-test']) {
    if (!args['confirm-create']) throw new Error('创建飞书库前必须取得用户明确同意，并传入 --confirm-create');
    const suffix = args['create-test'] ? `测试-${new Date().toISOString().slice(0, 10)}` : '';
    const identity = args.identity === 'user' ? 'user' : 'bot';
    const existing = loadConfig({ migrate: false }).config;
    if (existing && bindingReady(existing.feishu.image_text) && bindingReady(existing.feishu.video)) {
      return json({ ok: true, action: 'already_configured', path: configPath(), bases: { image_text: existing.feishu.image_text, video: existing.feishu.video } });
    }
    const imageText = bindingReady(existing?.feishu?.image_text)
      ? existing.feishu.image_text
      : createBase({ name: `小红书图文爆款拆解库${suffix}`, fields: IMAGE_FIELD_SCHEMA, identity });
    const partial = normalizeConfig({ initialized: false, timezone: 'Asia/Shanghai', feishu: { identity, image_text: imageText, video: existing?.feishu?.video || {} } });
    writeJsonAtomic(configPath(), partial);
    let video;
    try {
      video = bindingReady(existing?.feishu?.video)
        ? existing.feishu.video
        : createBase({ name: `小红书视频爆款拆解库${suffix}`, fields: VIDEO_FIELD_SCHEMA, identity });
    } catch (error) {
      throw new Error(`图文库已创建并保存到本地配置（${imageText.base_url}），视频库创建失败：${error.message}。修复飞书授权后用同一命令重试，程序会复用已创建的图文库。`);
    }
    const config = normalizeConfig({ initialized: true, timezone: 'Asia/Shanghai', feishu: { identity, image_text: imageText, video } });
    writeJsonAtomic(configPath(), config);
    return json({ ok: true, action: args['create-test'] ? 'created_test_bases' : 'created_bases', path: configPath(), bases: { image_text: imageText, video } });
  }
  throw new Error('configure 需要 --migrate、--bind、--create 或 --create-test');
}

async function extract(args) {
  ensureNode();
  const urls = extractUrls(readInput(args));
  if (!urls.length) throw new Error('没有检测到小红书公开链接');
  const items = [];
  for (const url of urls) items.push(await extractOne(url));
  const outcome = extractionOutcome(items);
  const result = { schema_version: 1, extracted_at: new Date().toISOString(), detected: urls.length, succeeded: outcome.succeeded, failed: outcome.failed, items };
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(result, null, 2)}\n`);
  }
  json({ ok: outcome.ok, output: args.output ? path.resolve(args.output) : null, ...result });
  if (!outcome.ok) process.exitCode = 2;
}

async function archive(args) {
  ensureNode();
  if (!args.input) throw new Error('archive 需要 --input <已分析结果.json>');
  const payload = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
  const items = Array.isArray(payload.items) ? payload.items : [];
  const errors = items.flatMap(analysisErrors);
  if (errors.length) throw new Error(`分析结果未完成：${errors.join('；')}`);
  const outputDir = path.resolve(args['output-dir'] || path.join(os.homedir(), 'Documents', 'xhs-viral-breakdown-backups'));
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(outputDir, `xhs-viral-breakdown-${stamp}.xlsx`);
  const successful = items.filter((item) => item.status === 'success');
  const failed = items.filter((item) => item.status !== 'success');
  writeXlsx(backup, {
    图文: xlsxRows(successful, 'image_text'),
    视频: xlsxRows(successful, 'video'),
    失败: [['原始链接', '最终链接', '阶段', '原因'], ...failed.map((item) => [item.original_url, item.final_url, item.stage, item.reason])],
  });
  if (args['no-write']) return json({ ok: true, dry_run: true, backup, records_ready: successful.length, failed: failed.length });
  const loaded = loadConfig({ migrate: true });
  if (!loaded.config) throw new Error(`Excel 已生成：${backup}；但未配置飞书，请先运行 configure`);
  const configErrors = validateConfig(loaded.config);
  if (configErrors.length) throw new Error(`Excel 已生成：${backup}；飞书配置无效：${configErrors.join('；')}`);
  const index = loadIndex();
  const localKnown = new Set(index.records.flatMap((record) => record.identities || []));
  const result = { ok: true, backup, written: 0, duplicates: 0, failed: failed.length, bases: {}, write_errors: [] };
  for (const type of ['image_text', 'video']) {
    const binding = loaded.config.feishu[type];
    const fields = type === 'video' ? VIDEO_FIELDS : IMAGE_FIELDS;
    const candidates = successful.filter((item) => item.type === type);
    if (!candidates.length) continue;
    try {
      const remoteValues = new Set(valuesAsStrings(listRecords(binding, loaded.config.feishu.identity)));
      const selected = selectPending(candidates, new Set([...localKnown, ...remoteValues]));
      const pending = selected.pending;
      result.duplicates += selected.duplicates;
      for (let offset = 0; offset < pending.length; offset += 200) batchCreate(binding, loaded.config.feishu.identity, fields, pending.slice(offset, offset + 200).map(rowFor));
      setVisibleFields(binding, loaded.config.feishu.identity, fields);
      for (const item of pending) {
        const ids = identities(item);
        ids.forEach((id) => localKnown.add(id));
        index.records.push({ type, note_id: item.note_id || '', identities: ids, archived_at: new Date().toISOString() });
      }
      result.written += pending.length;
      result.bases[type] = binding.base_url;
    } catch (error) {
      result.ok = false;
      result.write_errors.push({ type, reason: error.message });
    }
  }
  saveIndex(index);
  json(result);
  if (!result.ok) process.exitCode = 2;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'doctor') return doctor(args);
  if (command === 'configure') return configure(args);
  if (command === 'extract') return extract(args);
  if (command === 'archive') return archive(args);
  throw new Error('用法：xhs-breakdown.mjs <doctor|configure|extract|archive> [参数]');
}

main().catch((error) => fail(error.message));
