#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configPath, indexPath, loadConfig, loadIndex, normalizeConfig, saveIndex, validateConfig, writeJsonAtomic } from './lib/config.mjs';
import { identities, selectPending } from './lib/dedupe.mjs';
import { extractOne, extractUrls } from './lib/xhs.mjs';
import { batchCreate, createBase, createField, discoverLark, getVisibleFields, inspectLarkAuth, listFields, listRecordDetails, listRecords, setVisibleFields, updateRecord, uploadAttachments, valuesAsStrings } from './lib/lark.mjs';
import { buildMigrationPlan, classifyRepairFailure, DATA_SCHEMA_VERSION, MIGRATION_FIELDS, recordField, recordObjects } from './lib/migration.mjs';
import { downloadFreshMedia } from './lib/media.mjs';
import { extractionOutcome } from './lib/outcome.mjs';
import { writeXlsx } from './lib/xlsx.mjs';

const IMAGE_FIELDS = ['标题', '正文', '链接', '话题', '封面', '点赞', '收藏', '评论', '转发', '图片', '封面分析', '互动诱因', '爆款原因', '可复制点', '笔记ID', '图片归档状态', '归档错误', '最后归档时间'];
const VIDEO_FIELDS = ['标题', '链接', '封面', '作者', '视频时长', '点赞数', '收藏数', '评论数', '分享数', '正文', '口播文案（原始字幕）', '爆款拆解', '可复制部分', '笔记ID', '图片归档状态', '归档错误', '最后归档时间'];
const IMAGE_FIELD_SCHEMA = [
  { name: '标题', type: 'text' }, { name: '正文', type: 'text' }, { name: '链接', type: 'text', style: { type: 'url' } }, { name: '话题', type: 'text' },
  { name: '封面', type: 'text', style: { type: 'url' } }, { name: '点赞', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '收藏', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '评论', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '转发', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '图片', type: 'text' }, { name: '封面分析', type: 'text' }, { name: '互动诱因', type: 'text' },
  { name: '爆款原因', type: 'text' }, { name: '可复制点', type: 'text' }, ...MIGRATION_FIELDS.image_text,
];
const VIDEO_FIELD_SCHEMA = [
  { name: '标题', type: 'text' }, { name: '链接', type: 'text', style: { type: 'url' } }, { name: '封面', type: 'text', style: { type: 'url' } }, { name: '作者', type: 'text' },
  { name: '视频时长', type: 'text' }, { name: '点赞数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '收藏数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '评论数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '分享数', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } }, { name: '正文', type: 'text' }, { name: '口播文案（原始字幕）', type: 'text' },
  { name: '爆款拆解', type: 'text' }, { name: '可复制部分', type: 'text' }, ...MIGRATION_FIELDS.video,
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
  const tracking = [item.note_id || '', '待处理', '', new Date().toISOString().replace('T', ' ').slice(0, 19)];
  if (item.type === 'video') return [d.title, item.original_url, d.cover_url, d.author, duration(d.duration_seconds), m.liked, m.collected, m.commented, m.shared, d.description, d.transcript || '未获取字幕', a.viral_breakdown, a.reusable_tactics, ...tracking];
  return [d.title, a.body_summary, item.original_url, (d.topics || []).map((topic) => `#${String(topic).replace(/^#/, '')}`).join(' '), d.cover_url, m.liked, m.collected, m.commented, m.shared, (d.image_urls || []).slice(1).join('\n'), a.cover_analysis, a.interaction_drivers, a.viral_reasons, a.reusable_tactics, ...tracking];
}

function timestamp() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function attachmentNames(value, result = []) {
  if (value && typeof value === 'object') {
    if (typeof value.name === 'string') result.push(value.name);
    if (Array.isArray(value)) value.forEach((item) => attachmentNames(item, result));
    else Object.values(value).forEach((item) => attachmentNames(item, result));
  }
  return [...new Set(result)];
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function findCreatedRecord(binding, identity, type, item) {
  const fields = ['链接', '笔记ID', '图片归档状态', '封面图片', ...(type === 'image_text' ? ['图片附件'] : [])];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const records = recordObjects(listRecordDetails(binding, identity, fields));
    const record = records.find((candidate) => recordField(candidate, '笔记ID') === item.note_id)
      || records.find((candidate) => valuesAsStrings(candidate.fields?.['链接']).includes(item.original_url));
    if (record) return record;
    if (attempt < 3) await wait(500 * (attempt + 1));
  }
  return null;
}

async function archiveMedia({ item, recordId, record = null, binding, identity, tempRoot }) {
  const dir = path.join(tempRoot, `${item.type}-${item.note_id || recordId}`);
  const downloaded = await downloadFreshMedia(item, dir);
  const messages = downloaded.errors.map((error) => `第${error.index}张下载失败：${error.reason}`);
  if (downloaded.expected === 0) {
    updateRecord(binding, identity, recordId, { 图片归档状态: '无图片', 归档错误: '原笔记没有可归档图片', 最后归档时间: timestamp(), 笔记ID: item.note_id || '' });
    return { status: '无图片', uploaded: 0, expected: 0, errors: messages };
  }
  if (!downloaded.files.length) {
    updateRecord(binding, identity, recordId, { 图片归档状态: '图片下载失败', 归档错误: messages.join('；'), 最后归档时间: timestamp(), 笔记ID: item.note_id || '' });
    return { status: '图片下载失败', uploaded: 0, expected: downloaded.expected, errors: messages };
  }
  let uploaded = 0;
  const uploadErrors = [];
  const existingCover = new Set(attachmentNames(record?.fields?.['封面图片']));
  const existingImages = new Set(attachmentNames(record?.fields?.['图片附件']));
  const cover = downloaded.files[0];
  if (!existingCover.has(path.basename(cover))) {
    try { uploadAttachments(binding, identity, recordId, '封面图片', [cover]); uploaded += 1; }
    catch (error) { uploadErrors.push(`封面上传失败：${error.message}`); }
  }
  if (item.type === 'image_text') {
    const missing = downloaded.files.filter((file) => !existingImages.has(path.basename(file)));
    if (missing.length) {
      try { uploadAttachments(binding, identity, recordId, '图片附件', missing); uploaded += missing.length; }
      catch (error) { uploadErrors.push(`图组上传失败：${error.message}`); }
    }
  }
  messages.push(...uploadErrors);
  const completeDownloads = downloaded.files.length === downloaded.expected;
  const completeUploads = uploadErrors.length === 0;
  const status = completeDownloads && completeUploads ? '成功' : uploaded || existingCover.size || existingImages.size ? '部分成功' : '附件上传失败';
  updateRecord(binding, identity, recordId, { 图片归档状态: status, 归档错误: messages.join('；'), 最后归档时间: timestamp(), 笔记ID: item.note_id || '' });
  return { status, uploaded, expected: downloaded.expected, errors: messages };
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
    const partial = normalizeConfig({ schema_version: DATA_SCHEMA_VERSION, initialized: false, timezone: 'Asia/Shanghai', feishu: { identity, image_text: imageText, video: existing?.feishu?.video || {} } });
    writeJsonAtomic(configPath(), partial);
    let video;
    try {
      video = bindingReady(existing?.feishu?.video)
        ? existing.feishu.video
        : createBase({ name: `小红书视频爆款拆解库${suffix}`, fields: VIDEO_FIELD_SCHEMA, identity });
    } catch (error) {
      throw new Error(`图文库已创建并保存到本地配置（${imageText.base_url}），视频库创建失败：${error.message}。修复飞书授权后用同一命令重试，程序会复用已创建的图文库。`);
    }
    const config = normalizeConfig({ schema_version: DATA_SCHEMA_VERSION, initialized: true, timezone: 'Asia/Shanghai', feishu: { identity, image_text: imageText, video } });
    writeJsonAtomic(configPath(), config);
    return json({ ok: true, action: args['create-test'] ? 'created_test_bases' : 'created_bases', path: configPath(), bases: { image_text: imageText, video } });
  }
  throw new Error('configure 需要 --migrate、--bind、--create 或 --create-test');
}

function configured() {
  const loaded = loadConfig({ migrate: true });
  if (!loaded.config) throw new Error('未配置飞书，请先运行 configure');
  const errors = validateConfig(loaded.config);
  if (errors.length) throw new Error(`飞书配置无效：${errors.join('；')}`);
  return loaded.config;
}

function migrationReportPath(args, prefix) {
  const outputDir = path.resolve(args['output-dir'] || path.join(os.homedir(), 'Documents', 'xhs-viral-breakdown-backups'));
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
}

function migrationPlans(config) {
  const plans = {};
  for (const type of ['image_text', 'video']) {
    const binding = config.feishu[type];
    plans[type] = buildMigrationPlan(type, listFields(binding, config.feishu.identity), getVisibleFields(binding, config.feishu.identity));
  }
  return plans;
}

async function schemaPlan(args) {
  ensureNode();
  const config = configured();
  const plans = migrationPlans(config);
  const report = migrationReportPath(args, 'schema-v2-plan');
  writeJsonAtomic(report, { generated_at: new Date().toISOString(), current_schema_version: config.schema_version, target_schema_version: DATA_SCHEMA_VERSION, plans });
  json({ ok: true, action: 'schema_plan', report, plans });
}

async function schemaMigrate(args) {
  ensureNode();
  if (!args['confirm-migrate']) throw new Error('迁移会新增字段并增量调整默认视图；请先向用户说明不会删除旧字段，取得同意后传入 --confirm-migrate');
  const config = configured();
  const plans = migrationPlans(config);
  const report = migrationReportPath(args, 'schema-v2-migration');
  writeJsonAtomic(report, { generated_at: new Date().toISOString(), phase: 'before', current_schema_version: config.schema_version, target_schema_version: DATA_SCHEMA_VERSION, plans });
  const created = {};
  for (const type of ['image_text', 'video']) {
    const binding = config.feishu[type];
    created[type] = [];
    for (const field of plans[type].missing_fields) {
      createField(binding, config.feishu.identity, field);
      created[type].push(field.name);
    }
    if (plans[type].visible_fields_after.length) setVisibleFields(binding, config.feishu.identity, plans[type].visible_fields_after);
  }
  const migrated = normalizeConfig({ ...config, schema_version: DATA_SCHEMA_VERSION });
  writeJsonAtomic(configPath(), migrated);
  const after = migrationPlans(migrated);
  writeJsonAtomic(report, { generated_at: new Date().toISOString(), phase: 'complete', previous_schema_version: config.schema_version, schema_version: DATA_SCHEMA_VERSION, created, plans_before: plans, plans_after: after });
  json({ ok: true, action: 'schema_migrated', schema_version: DATA_SCHEMA_VERSION, created, report });
}

async function repairImages(args) {
  ensureNode();
  if (!args['confirm-repair'] && !args['dry-run']) throw new Error('历史图片修复会访问原笔记并上传附件；请取得用户同意后传入 --confirm-repair，或先用 --dry-run 预览');
  const config = configured();
  if (config.schema_version !== DATA_SCHEMA_VERSION) throw new Error('请先运行 schema-plan，并在确认后运行 schema-migrate --confirm-migrate');
  const requestedType = args.type;
  if (requestedType && !['image_text', 'video'].includes(requestedType)) throw new Error('--type 只支持 image_text 或 video');
  const types = requestedType ? [requestedType] : ['image_text', 'video'];
  const limit = Math.max(1, Number(args.limit || 50));
  const report = { ok: true, action: args['dry-run'] ? 'repair_preview' : 'repair_images', limit, processed: 0, skipped: 0, results: [] };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-image-repair-'));
  try {
    for (const type of types) {
      const binding = config.feishu[type];
      const fields = ['链接', '笔记ID', '图片归档状态', '封面图片', ...(type === 'image_text' ? ['图片附件'] : [])];
      const records = recordObjects(listRecordDetails(binding, config.feishu.identity, fields));
      for (const record of records) {
        if (report.processed >= limit) break;
        const recordId = String(record.record_id || record.recordId);
        const rawLink = recordField(record, '链接');
        const link = extractUrls(rawLink)[0] || rawLink;
        const status = recordField(record, '图片归档状态');
        const coverReady = attachmentNames(record.fields?.['封面图片']).length > 0;
        const imagesReady = type === 'video' || attachmentNames(record.fields?.['图片附件']).length > 0;
        if (status === '成功' && coverReady && imagesReady) { report.skipped += 1; continue; }
        report.processed += 1;
        if (!link) {
          const result = { type, record_id: recordId, status: '抓取失败', reason: '记录缺少链接字段' };
          if (!args['dry-run']) updateRecord(binding, config.feishu.identity, recordId, { 图片归档状态: result.status, 归档错误: result.reason, 最后归档时间: timestamp() });
          report.results.push(result);
          continue;
        }
        if (args['dry-run']) { report.results.push({ type, record_id: recordId, link, status: '待处理' }); continue; }
        const item = await extractOne(link);
        if (item.status !== 'success') {
          const failureStatus = classifyRepairFailure(item);
          updateRecord(binding, config.feishu.identity, recordId, { 图片归档状态: failureStatus, 归档错误: item.reason || '无法重新读取原笔记', 最后归档时间: timestamp() });
          report.results.push({ type, record_id: recordId, link, status: failureStatus, reason: item.reason });
          continue;
        }
        if (item.type !== type) {
          const reason = `原笔记类型为 ${item.type}，与当前库 ${type} 不一致`;
          updateRecord(binding, config.feishu.identity, recordId, { 图片归档状态: '抓取失败', 归档错误: reason, 最后归档时间: timestamp(), 笔记ID: item.note_id || '' });
          report.results.push({ type, record_id: recordId, link, status: '抓取失败', reason });
          continue;
        }
        const media = await archiveMedia({ item, recordId, record, binding, identity: config.feishu.identity, tempRoot });
        report.results.push({ type, record_id: recordId, link, note_id: item.note_id, ...media });
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  const reportFile = migrationReportPath(args, args['dry-run'] ? 'image-repair-preview' : 'image-repair-report');
  writeJsonAtomic(reportFile, { ...report, generated_at: new Date().toISOString() });
  json({ ...report, report: reportFile });
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
  if (loaded.config.schema_version !== DATA_SCHEMA_VERSION) throw new Error(`Excel 已生成：${backup}；当前飞书表格仍是 Schema v1。请先运行 schema-plan，确认后执行 schema-migrate --confirm-migrate`);
  const index = loadIndex();
  const localKnown = new Set(index.records.flatMap((record) => record.identities || []));
  const result = { ok: true, backup, written: 0, duplicates: 0, failed: failed.length, bases: {}, media: [], write_errors: [] };
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-new-media-'));
  try { for (const type of ['image_text', 'video']) {
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
      for (const item of pending) {
        const record = await findCreatedRecord(binding, loaded.config.feishu.identity, type, item);
        if (!record) {
          result.ok = false;
          result.write_errors.push({ type, note_id: item.note_id, reason: '记录已写入，但无法定位 record_id，未上传附件' });
          continue;
        }
        const recordId = String(record.record_id || record.recordId);
        const media = await archiveMedia({ item, recordId, record, binding, identity: loaded.config.feishu.identity, tempRoot });
        result.media.push({ type, record_id: recordId, note_id: item.note_id, ...media });
        if (!['成功', '无图片'].includes(media.status)) result.ok = false;
      }
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
  }} finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  saveIndex(index);
  json(result);
  if (!result.ok) process.exitCode = 2;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'doctor') return doctor(args);
  if (command === 'configure') return configure(args);
  if (command === 'schema-plan') return schemaPlan(args);
  if (command === 'schema-migrate') return schemaMigrate(args);
  if (command === 'repair-images') return repairImages(args);
  if (command === 'extract') return extract(args);
  if (command === 'archive') return archive(args);
  throw new Error('用法：xhs-breakdown.mjs <doctor|configure|schema-plan|schema-migrate|repair-images|extract|archive> [参数]');
}

main().catch((error) => fail(error.message));
