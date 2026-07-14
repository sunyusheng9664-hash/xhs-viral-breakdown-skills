#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchCreate, createBase, discoverLark, inspectLarkAuth, listRecords, setVisibleFields, valuesAsStrings } from './lib/lark.mjs';
import { configPath, loadConfig, normalizeConfig, validateConfig, writeJsonAtomic } from './lib/config.mjs';
import { selectPending } from './lib/dedupe.mjs';
import { extractionOutcome } from './lib/outcome.mjs';
import { extractUrls, fetchPage, findNoteObject, normalizeNote, parseInitialState } from './lib/xhs.mjs';
import { writeXlsx } from './lib/xlsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const FIELDS = ['标题', '正文', '链接', '话题', '封面', '点赞', '收藏', '评论', '转发', '图片', '采集时间', '失败原因'];
const FIELD_SCHEMA = [
  { name: '标题', type: 'text' }, { name: '正文', type: 'text' }, { name: '链接', type: 'url' }, { name: '话题', type: 'text' },
  { name: '封面', type: 'url' }, { name: '点赞', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '收藏', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '评论', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '转发', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '图片', type: 'text' }, { name: '采集时间', type: 'text' }, { name: '失败原因', type: 'text' },
];

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) args._.push(token);
    else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) args[token.slice(2)] = rest[++i];
    else args[token.slice(2)] = true;
  }
  return { command, args };
}

function json(data, status = 0) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  process.exitCode = status;
}

function rowFor(item) {
  const d = item.data || {};
  const m = d.metrics || {};
  return [
    d.title || '',
    d.description || '',
    item.original_url || '',
    (d.topics || []).map((topic) => `#${String(topic).replace(/^#/, '')}`).join(' '),
    d.cover_url || '',
    m.liked ?? null,
    m.collected ?? null,
    m.commented ?? null,
    m.shared ?? null,
    (d.image_urls || []).slice(1).join('\n'),
    item.collected_at || new Date().toISOString(),
    '',
  ];
}

function failureRow(item) {
  return ['', '', item.original_url || item.url || '', '', '', null, null, null, null, '', new Date().toISOString(), item.reason || item.error || '采集失败'];
}

async function doctor(args = {}) {
  const nodeReady = Number(process.versions.node.split('.')[0]) >= 18;
  let configStatus = 'missing';
  let configErrors = [];
  const loaded = loadConfig({ migrate: false });
  if (loaded.config) {
    configErrors = validateConfig(loaded.config);
    configStatus = configErrors.length ? 'invalid' : 'ready';
  }
  const identity = loaded.config?.feishu?.identity || 'bot';
  const lark = discoverLark();
  const auth = inspectLarkAuth(lark, identity);
  const outputDir = args['output-dir'] ? path.resolve(args['output-dir']) : OUTPUT_DIR;
  let output = { path: outputDir, ready: false };
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.accessSync(outputDir, fs.constants.W_OK);
    output.ready = true;
  } catch (error) {
    output.error = error.message;
  }
  const ok = nodeReady && Boolean(lark) && auth.ready && configStatus === 'ready' && output.ready;
  json({ ok, node: { ready: nodeReady, version: process.versions.node }, lark_cli: lark ? { available: true, version: lark.version, auth } : { available: false, auth }, config: { path: configPath(), status: configStatus, errors: configErrors }, output }, ok ? 0 : 2);
}

async function configure(args = {}) {
  if (args.migrate) {
    const loaded = loadConfig({ migrate: true });
    if (!loaded.config) return json({ ok: false, action: 'migrate', reason: '未找到 Pro 配置', target: loaded.path }, 2);
    return json({ ok: true, action: loaded.migrated ? 'migrated_from_pro' : 'already_configured', path: loaded.path, legacy_path: loaded.legacy_path || null });
  }
  if (args.bind) {
    const config = normalizeConfig(JSON.parse(fs.readFileSync(path.resolve(args.bind), 'utf8')));
    const errors = validateConfig(config);
    if (errors.length) return json({ ok: false, action: 'bind', errors }, 2);
    writeJsonAtomic(configPath(), config);
    return json({ ok: true, action: 'bound', path: configPath(), base: config.feishu.image_text });
  }
  if (args.create || args['create-test']) {
    if (!args['confirm-create']) throw new Error('创建飞书库前必须取得用户明确同意，并传入 --confirm-create');
    const existing = loadConfig({ migrate: false }).config;
    if (existing && validateConfig(existing).length === 0) return json({ ok: true, action: 'already_configured', path: configPath(), base: existing.feishu.image_text });
    const identity = existing?.feishu?.identity || args.identity || 'bot';
    const suffix = args['create-test'] ? `测试-${new Date().toISOString().slice(0, 10)}` : '';
    const base = createBase({ name: `小红书图文采集试用库${suffix}`, fields: FIELD_SCHEMA, identity, timezone: existing?.timezone || 'Asia/Shanghai', tableName: '图文采集库' });
    const config = normalizeConfig({ initialized: true, feishu: { identity, image_text: base } });
    writeJsonAtomic(configPath(), config);
    return json({ ok: true, action: args['create-test'] ? 'created_test_base' : 'created_base', path: configPath(), base });
  }
  throw new Error('configure 需要 --migrate、--bind、--create 或 --create-test');
}

async function extract(args = {}) {
  if (!args.input) throw new Error('extract 需要 --input <输入文件>');
  const text = fs.readFileSync(path.resolve(args.input), 'utf8');
  const urls = extractUrls(text);
  const items = [];
  for (const url of urls) {
    try {
      const page = await fetchPage(url);
      const state = parseInitialState(page.html);
      const noteId = page.noteId || page.finalUrl.match(/explore\/([^/?#]+)/)?.[1] || '';
      const note = findNoteObject(state, noteId);
      const normalized = normalizeNote(note, { originalUrl: url, finalUrl: page.finalUrl, noteId });
      if (normalized.type !== 'image_text') {
        items.push({ status: 'failed', original_url: url, final_url: page.finalUrl, note_id: noteId, reason: 'Lite 版只支持图文笔记；视频笔记请使用 Pro 版' });
        continue;
      }
      items.push({ ...normalized, status: 'success', collected_at: new Date().toISOString() });
    } catch (error) {
      items.push({ status: 'failed', original_url: url, reason: error.message });
    }
  }
  const output = { ...extractionOutcome(items), detected: urls.length, items };
  if (args.output) fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(output, null, 2)}\n`);
  json(output, output.ok ? 0 : 2);
}

async function archive(args = {}) {
  if (!args.input) throw new Error('archive 需要 --input <采集结果.json>');
  const input = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
  const items = input.items || input;
  const success = items.filter((item) => item.status === 'success' && item.type === 'image_text');
  const failed = items.filter((item) => item.status !== 'success');
  const outputDir = args['output-dir'] ? path.resolve(args['output-dir']) : OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });
  const backup = path.join(outputDir, `xhs-image-text-lite-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);
  writeXlsx(backup, { 图文采集: [FIELDS, ...success.map(rowFor)], 失败记录: [FIELDS, ...failed.map(failureRow)] });
  if (args['no-write']) return json({ ok: true, backup, written: 0, duplicates: 0, failed: failed.length, no_write: true });
  const loaded = loadConfig({ migrate: true });
  if (!loaded.config) throw new Error(`Excel 已生成：${backup}；但未配置飞书，请先运行 configure`);
  const errors = validateConfig(loaded.config);
  if (errors.length) throw new Error(`Excel 已生成：${backup}；飞书配置不完整：${errors.join('；')}`);
  const binding = loaded.config.feishu.image_text;
  const result = { ok: true, backup, written: 0, duplicates: 0, failed: failed.length, base: binding.base_url, write_errors: [] };
  try {
    const remoteValues = new Set(valuesAsStrings(listRecords(binding, loaded.config.feishu.identity)));
    const { pending, duplicates } = selectPending(success, remoteValues);
    result.duplicates += duplicates;
    for (let offset = 0; offset < pending.length; offset += 200) {
      batchCreate(binding, loaded.config.feishu.identity, FIELDS, pending.slice(offset, offset + 200).map(rowFor));
    }
    setVisibleFields(binding, loaded.config.feishu.identity, FIELDS);
    result.written += pending.length;
  } catch (error) {
    result.ok = false;
    result.write_errors.push(error.message);
  }
  json(result, result.ok ? 0 : 2);
}

try {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'doctor') await doctor(args);
  else if (command === 'configure') await configure(args);
  else if (command === 'extract') await extract(args);
  else if (command === 'archive') await archive(args);
  else throw new Error('用法：xhs-image-text-lite.mjs <doctor|configure|extract|archive> [参数]');
} catch (error) {
  json({ ok: false, error: error.message }, 2);
}
