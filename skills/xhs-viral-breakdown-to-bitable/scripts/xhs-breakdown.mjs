#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { configPath, indexPath, legacyConfigPath, loadConfig, loadIndex, normalizeConfig, readJson, saveIndex, validateConfig, writeJsonAtomic } from './lib/config.mjs';
import { identities, selectPending } from './lib/dedupe.mjs';
import { extractOne, extractUrls } from './lib/xhs.mjs';
import { batchCreate, createBase, createField, createTable, discoverLark, downloadAttachment, getVisibleFields, inspectLarkAuth, listFields, listRecordDetails, listRecords, listTables, listViews, renameTable, setVisibleFields, updateRecord, uploadAttachments, valuesAsStrings } from './lib/lark.mjs';
import { buildMigrationPlan, classifyRepairFailure, DATA_SCHEMA_VERSION, fieldObjects, MIGRATION_FIELDS, recordField, recordObjects } from './lib/migration.mjs';
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
const BLOGGER_FIELD_SCHEMA = [
  { name: '账号名称', type: 'text' }, { name: '平台类型', type: 'text' }, { name: '小红书号', type: 'text' },
  { name: '主页链接', type: 'text', style: { type: 'url' } }, { name: '简介/签名', type: 'text' },
  { name: '头像截图', type: 'attachment' }, { name: '头像风格', type: 'text' }, { name: '主页截图', type: 'attachment' },
  { name: '内容定位', type: 'text' }, { name: '人设标签', type: 'text' }, { name: '受众画像', type: 'text' },
  { name: '价值主张', type: 'text' }, { name: '差异化点', type: 'text' },
  { name: '粉丝总量', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '获赞与收藏总量', type: 'number', style: { type: 'plain', precision: 0, thousands_separator: true } },
  { name: '笔记/作品数', type: 'text' }, { name: '更新频率', type: 'text' },
  { name: '选题方向', type: 'text' }, { name: '内容类型', type: 'text' }, { name: '内容形式', type: 'text' },
  { name: '高频关键词', type: 'text' }, { name: '常带话题', type: 'text' }, { name: '发布时段', type: 'text' },
  { name: '内容风格', type: 'text' }, { name: '封面风格', type: 'text' }, { name: '封面配色', type: 'text' },
  { name: '封面字体风格', type: 'text' }, { name: '封面元素', type: 'text' }, { name: '标题写法', type: 'text' },
  { name: '正文结构', type: 'text' }, { name: '开头套路', type: 'text' }, { name: '结尾套路', type: 'text' },
  { name: '高点赞标题1', type: 'text' }, { name: '公开互动数据1', type: 'text' },
  { name: '高点赞标题2', type: 'text' }, { name: '公开互动数据2', type: 'text' },
  { name: '高点赞标题3', type: 'text' }, { name: '公开互动数据3', type: 'text' },
  { name: '高点赞共性', type: 'text' }, { name: '变现方式', type: 'text' },
  { name: '观察到的品牌内容', type: 'text' }, { name: '公开引流方式', type: 'text' },
  { name: '可复用元素', type: 'text' }, { name: '数据限制', type: 'text' },
  { name: '采集状态', type: 'select', multiple: false, options: [
    { name: '基础分析完成' }, { name: '完整分析完成' }, { name: '部分字段缺失' }, { name: '采集失败' },
  ] },
  { name: '采集时间', type: 'datetime', style: { format: 'yyyy-MM-dd HH:mm' } },
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
    if (!args['confirm-create']) throw new Error('创建飞书内容工作台前必须取得用户明确同意，并传入 --confirm-create');
    const suffix = args['create-test'] ? `测试-${new Date().toISOString().slice(0, 10)}` : '';
    const identity = args.identity === 'user' ? 'user' : 'bot';
    const existing = loadConfig({ migrate: false }).config;
    if (existing && existing.schema_version === DATA_SCHEMA_VERSION && bindingReady(existing.feishu.image_text) && bindingReady(existing.feishu.video) && bindingReady(existing.feishu.blogger)) {
      return json({ ok: true, action: 'already_configured', path: configPath(), workspace: { image_text: existing.feishu.image_text, video: existing.feishu.video, blogger: existing.feishu.blogger } });
    }
    if (existing && bindingReady(existing?.feishu?.image_text) && bindingReady(existing?.feishu?.video)) {
      throw new Error('检测到旧版双库配置。请先运行 upgrade-check，向用户说明合并方案并取得授权后执行 upgrade-apply');
    }
    const imageText = createBase({ name: `小红书内容资产库${suffix}`, fields: IMAGE_FIELD_SCHEMA, identity });
    renameTable(imageText, identity, '图文笔记');
    imageText.table_name = '图文笔记';
    const partial = normalizeConfig({ schema_version: 2, initialized: false, timezone: 'Asia/Shanghai', feishu: { identity, image_text: imageText } });
    writeJsonAtomic(configPath(), partial);
    let video;
    let blogger;
    try {
      blogger = createTable({ baseToken: imageText.base_token, baseUrl: imageText.base_url, baseName: imageText.base_name, name: '博主主页', fields: BLOGGER_FIELD_SCHEMA, identity });
      video = createTable({ baseToken: imageText.base_token, baseUrl: imageText.base_url, baseName: imageText.base_name, name: '视频笔记', fields: VIDEO_FIELD_SCHEMA, identity });
      createField(imageText, identity, { type: 'link', name: '所属博主', link_table: blogger.table_id });
      createField(video, identity, { type: 'link', name: '所属博主', link_table: blogger.table_id });
    } catch (error) {
      throw new Error(`内容工作台已开始创建并保存到本地配置（${imageText.base_url}），后续数据表创建失败：${error.message}。修复飞书授权后运行 upgrade-check 生成恢复方案。`);
    }
    const config = normalizeConfig({ schema_version: DATA_SCHEMA_VERSION, initialized: true, timezone: 'Asia/Shanghai', feishu: { identity, image_text: imageText, video, blogger } });
    writeJsonAtomic(configPath(), config);
    return json({ ok: true, action: args['create-test'] ? 'created_test_workspace' : 'created_workspace', path: configPath(), workspace: { image_text: imageText, video, blogger } });
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

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function upgradePlanId(config, plans, workspace) {
  const target = {
    schema_version: DATA_SCHEMA_VERSION,
    bindings: Object.fromEntries(['image_text', 'video'].map((type) => [type, {
      base_token: config.feishu[type].base_token,
      table_id: config.feishu[type].table_id,
      view_id: config.feishu[type].view_id,
    }])),
    plans,
    workspace,
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable(target))).digest('hex').slice(0, 16);
}

function existingUpgradeConfig() {
  const current = loadConfig({ migrate: false });
  if (current.config) return { config: current.config, source: 'current', path: current.path };
  const legacy = legacyConfigPath();
  if (fs.existsSync(legacy)) return { config: normalizeConfig(readJson(legacy)), source: 'legacy', path: legacy };
  return null;
}

function tableObjects(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if ((value.id || value.table_id) && (value.name || value.table_name)) result.push(value);
  if (Array.isArray(value)) value.forEach((item) => tableObjects(item, result));
  else Object.values(value).forEach((item) => tableObjects(item, result));
  const seen = new Set();
  return result.filter((item) => {
    const id = String(item.id || item.table_id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function workspacePlan(config) {
  const target = config.feishu.image_text;
  const tables = tableObjects(listTables(target.base_token, config.feishu.identity));
  const byName = (names) => tables.find((table) => names.includes(String(table.name || table.table_name)));
  const imageTable = tables.find((table) => String(table.id || table.table_id) === target.table_id);
  const imageTableName = String(imageTable?.name || imageTable?.table_name || target.table_name);
  const existingVideo = config.feishu.video.base_token === target.base_token
    ? tables.find((table) => String(table.id || table.table_id) === config.feishu.video.table_id)
    : byName(['视频笔记']);
  const existingBlogger = bindingReady(config.feishu.blogger) && config.feishu.blogger.base_token === target.base_token
    ? tables.find((table) => String(table.id || table.table_id) === config.feishu.blogger.table_id)
    : byName(['博主主页', '博主分析页']);
  return {
    target_base_token: target.base_token,
    target_base_url: target.base_url,
    source_video_base_token: config.feishu.video.base_token,
    source_video_table_id: config.feishu.video.table_id,
    image_table_id: target.table_id,
    image_table_name: imageTableName,
    rename_image_table: imageTableName !== '图文笔记',
    video_already_in_target: Boolean(existingVideo),
    target_video_table: existingVideo ? { id: String(existingVideo.id || existingVideo.table_id), name: String(existingVideo.name || existingVideo.table_name) } : null,
    copy_video_records: config.feishu.video.base_token !== target.base_token,
    create_video_table: !existingVideo,
    create_blogger_table: !existingBlogger,
    blogger_table: existingBlogger ? { id: String(existingBlogger.id || existingBlogger.table_id), name: String(existingBlogger.name || existingBlogger.table_name) } : null,
    preserve_source_video_base: config.feishu.video.base_token !== target.base_token,
  };
}

function plansNeedChanges(config, plans, workspace) {
  if (config.schema_version !== DATA_SCHEMA_VERSION) return true;
  if (workspace.rename_image_table || workspace.create_video_table || workspace.create_blogger_table || workspace.copy_video_records) return true;
  if (config.feishu.video.base_token !== config.feishu.image_text.base_token) return true;
  if (!bindingReady(config.feishu.blogger)) return true;
  return Object.values(plans).some((plan) => plan.missing_fields.length > 0
    || JSON.stringify(plan.visible_fields_before) !== JSON.stringify(plan.visible_fields_after));
}

function customerUpdateMessage(plans, workspace) {
  const imageAdded = plans.image_text.missing_fields.map((field) => field.name);
  const videoAdded = plans.video.missing_fields.map((field) => field.name);
  return [
    '检测到你正在更新小红书爆款拆解 Skill。',
    '',
    '这次更新会把分散的图文库和视频库整理成一个“小红书内容工作台”。以后不用在两个多维表之间来回切换，也可以直接按博主汇总内容、做筛选和看板。',
    '',
    '升级后你会得到：',
    '- 图文笔记、视频笔记、博主主页三张数据表；',
    '- 图文和视频都可以通过“所属博主”关联到博主主页；',
    '- 原有视频记录和封面附件复制到统一工作台；',
    '- 后续新增字段、统计和仪表盘都在同一个多维表中维护。',
    '',
    '本次准备执行：',
    `- 将原图文表${workspace.rename_image_table ? '改名为“图文笔记”' : '保持为“图文笔记”'}；`,
    `- ${workspace.create_video_table ? '新建“视频笔记”并复制原视频库数据与附件' : '复用已有“视频笔记”'}；`,
    `- ${workspace.create_blogger_table ? '新建“博主主页”' : `复用已有“${workspace.blogger_table?.name || '博主主页'}”`}；`,
    '- 为图文和视频表增加“所属博主”关联字段；',
    `- 图文库新增：${imageAdded.length ? imageAdded.join('、') : '无需新增字段'}；`,
    `- 视频库新增：${videoAdded.length ? videoAdded.join('、') : '无需新增字段'}；`,
    '',
    '需要的飞书权限：读取现有表和记录；创建/改名数据表与字段；读取并下载原附件；向新表写入记录和上传附件；更新本机绑定配置。',
    '',
    '不会做的事情：不会删除原视频库、旧数据或自定义字段；不会登录小红书；不会执行发布、点赞、评论等账号操作。',
    '',
    '是否授权我按以上方案合并现有多维表格？本次授权仅用于这次迁移，不包含删除旧库或历史图片修复。',
  ].join('\n');
}

function upgradeAssessment(args = {}) {
  const candidate = existingUpgradeConfig();
  if (!candidate) {
    return {
      ok: true,
      action: 'upgrade_check',
      mode: 'install',
      message: '未检测到旧版配置。这是首次安装流程，不执行表格升级；请继续完成飞书绑定或新建表格。',
      next_action: 'configure',
    };
  }
  const errors = validateConfig(candidate.config);
  if (errors.length) return { ok: false, action: 'upgrade_check', mode: 'blocked', source: candidate.source, errors };
  const lark = discoverLark();
  const identity = candidate.config.feishu.identity;
  const auth = inspectLarkAuth(lark, identity);
  if (!lark || !auth.ready) {
    const userIdentity = identity === 'user';
    return {
      ok: true,
      action: 'upgrade_check',
      mode: 'authorization_required',
      source: candidate.source,
      identity,
      authorization: {
        required: true,
        scope: 'feishu_base_access',
        command: userIdentity ? 'lark-cli auth login --domain base --no-wait --json' : null,
        next_check: '完成授权后重新运行 upgrade-check',
      },
      customer_message: [
        '新版会把原来分散的图文库和视频库合并成一个小红书内容工作台。开始检查和迁移前，需要先确认飞书访问权限。',
        '',
        '需要的权限包括：读取现有多维表和附件；创建/改名数据表与字段；复制记录并上传附件。不会删除原库，也不会申请小红书登录权限。',
        '',
        userIdentity
          ? '接下来我会发起飞书 Base 最小范围授权。请在飞书页面确认，完成后我会重新检查，并把具体迁移方案发给你确认。'
          : '当前配置使用飞书应用身份，但应用的 Base 权限尚未就绪。请先在飞书开发者后台为该应用开通多维表格读写及附件相关权限，完成后再继续。',
      ].join('\n'),
      auth,
    };
  }
  const plans = migrationPlans(candidate.config);
  const workspace = workspacePlan(candidate.config);
  const planId = upgradePlanId(candidate.config, plans, workspace);
  const needsUpgrade = plansNeedChanges(candidate.config, plans, workspace);
  const result = {
    ok: true,
    action: 'upgrade_check',
    mode: needsUpgrade ? 'upgrade' : 'ready',
    source: candidate.source,
    current_schema_version: candidate.config.schema_version,
    target_schema_version: DATA_SCHEMA_VERSION,
    plan_id: planId,
    plans,
    workspace,
    authorization: needsUpgrade ? {
      required: true,
      scope: 'workspace_consolidation',
      includes: ['表改名', '新建数据表', '复制视频记录和附件', '新增所属博主关联', '更新本机绑定配置'],
      excludes: ['删除原视频库', '删除旧数据', '历史图片修复', '小红书登录或互动'],
      apply_command: `upgrade-apply --plan-id ${planId} --confirm-upgrade`,
    } : { required: false },
    customer_message: needsUpgrade ? customerUpdateMessage(plans, workspace) : '当前内容工作台已经完成升级，可以直接使用新版 Skill。',
  };
  if (args['output-dir']) {
    result.report = migrationReportPath(args, 'upgrade-check');
    writeJsonAtomic(result.report, { ...result, generated_at: new Date().toISOString() });
  }
  return { ...result, config: candidate.config };
}

async function upgradeCheck(args) {
  ensureNode();
  const assessment = upgradeAssessment(args);
  const { config: _config, ...output } = assessment;
  json(output);
  if (!assessment.ok) process.exitCode = 2;
}

function bindingFromTable(base, table, tableName) {
  return {
    base_name: base.base_name,
    base_token: base.base_token,
    base_url: base.base_url,
    table_name: tableName || table.name,
    table_id: String(table.id || table.table_id),
    view_id: String(table.view_id || table.default_view_id || ''),
  };
}

function ensureViewId(binding, identity) {
  if (binding.view_id) return binding;
  const response = listViews(binding, identity);
  const data = response?.data || response;
  const view = data?.views?.[0] || data?.items?.[0];
  if (!view?.id) throw new Error(`无法读取数据表 ${binding.table_name || binding.table_id} 的默认视图`);
  return { ...binding, view_id: String(view.id) };
}

function recordRowsFromPages(pages) {
  const records = [];
  for (const page of pages) {
    const data = page?.data || page;
    const fields = data?.fields || [];
    const rows = data?.data || [];
    const ids = data?.record_id_list || [];
    rows.forEach((row, index) => records.push({
      record_id: ids[index],
      fields: Object.fromEntries(fields.map((field, fieldIndex) => [field, row[fieldIndex]])),
    }));
  }
  return records;
}

function createdRecordIds(value) {
  return value?.data?.record_id_list || value?.record_id_list || [];
}

function portableField(field) {
  const allowed = new Set(['text', 'number', 'select', 'datetime', 'attachment', 'checkbox']);
  if (!allowed.has(field.type)) return null;
  const result = { type: field.type, name: field.name };
  if (field.style) result.style = field.style;
  if (field.type === 'select') {
    result.multiple = Boolean(field.multiple);
    if (Array.isArray(field.options)) result.options = field.options.map((option) => ({ name: option.name })).filter((option) => option.name);
  }
  return result;
}

function ensureLinkField(binding, blogger, identity) {
  const fields = fieldObjects(listFields(binding, identity));
  const existing = fields.find((field) => field.name === '所属博主');
  if (existing) {
    if (existing.type !== 'link' || String(existing.link_table || '') !== blogger.table_id) {
      throw new Error(`${binding.table_name} 已有“所属博主”字段，但不是指向博主主页的关联字段；为避免改型或覆盖，请先人工处理该字段`);
    }
    return false;
  }
  createField(binding, identity, { type: 'link', name: '所属博主', link_table: blogger.table_id });
  return true;
}

function copyVideoLibrary(source, target, identity) {
  const sourceFields = fieldObjects(listFields(source, identity));
  const targetFields = fieldObjects(listFields(target, identity));
  const targetNames = new Set(targetFields.map((field) => field.name));
  for (const field of sourceFields) {
    if (targetNames.has(field.name)) continue;
    const portable = portableField(field);
    if (!portable) continue;
    createField(target, identity, portable);
    targetNames.add(field.name);
  }
  const records = recordRowsFromPages(listRecordDetails(source, identity));
  if (!records.length) return { records: 0, attachments: 0, skipped_existing: 0 };
  const targetRecords = recordRowsFromPages(listRecordDetails(target, identity));
  const linkOf = (record) => valuesAsStrings(record.fields?.['链接']).find((value) => /^https?:\/\//.test(value)) || '';
  const existingByLink = new Map(targetRecords.map((record) => [linkOf(record), record]).filter(([link]) => link));
  const attachmentFields = sourceFields.filter((field) => field.type === 'attachment').map((field) => field.name);
  const writableFields = sourceFields
    .filter((field) => portableField(field) && field.type !== 'attachment')
    .map((field) => field.name)
    .filter((name) => targetNames.has(name));
  const mapping = records.filter((record) => existingByLink.has(linkOf(record))).map((record) => ({ source: record, target_id: existingByLink.get(linkOf(record)).record_id, target: existingByLink.get(linkOf(record)), created: false }));
  const missing = records.filter((record) => !existingByLink.has(linkOf(record)));
  for (let offset = 0; offset < missing.length; offset += 200) {
    const batch = missing.slice(offset, offset + 200);
    const result = batchCreate(target, identity, writableFields, batch.map((record) => writableFields.map((field) => record.fields[field] ?? null)));
    const ids = createdRecordIds(result);
    batch.forEach((record, index) => mapping.push({ source: record, target_id: ids[index], target: null, created: true }));
  }
  let attachmentCount = 0;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-video-base-migration-'));
  try {
    for (const item of mapping) {
      if (!item.target_id) continue;
      for (const field of attachmentFields) {
        const attachments = Array.isArray(item.source.fields[field]) ? item.source.fields[field] : [];
        const existingNames = new Set((Array.isArray(item.target?.fields?.[field]) ? item.target.fields[field] : []).map((attachment) => attachment?.name).filter(Boolean));
        for (const attachment of attachments) {
          if (!attachment?.file_token) continue;
          if (attachment.name && existingNames.has(attachment.name)) continue;
          const dir = fs.mkdtempSync(path.join(tempRoot, 'file-'));
          downloadAttachment(source, identity, item.source.record_id, attachment.file_token, dir);
          const files = fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
          if (!files.length) throw new Error(`附件下载完成但未找到本地文件：${attachment.name || attachment.file_token}`);
          uploadAttachments(target, identity, item.target_id, field, [files[0]], { cwd: dir });
          attachmentCount += 1;
        }
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  return { records: missing.length, attachments: attachmentCount, skipped_existing: records.length - missing.length };
}

function applyMissingSchema(config) {
  const plans = migrationPlans(config);
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
  return { created, plans };
}

function applySchemaUpgrade({ config, plans, planId, args, confirmationFlag }) {
  if (!args[confirmationFlag]) throw new Error('尚未取得用户对表结构升级的明确授权');
  if (!args['plan-id']) throw new Error('缺少 --plan-id；请先运行 upgrade-check，把升级说明展示给用户并取得授权');
  if (args['plan-id'] !== planId) throw new Error('升级方案已经变化，原授权失效。请重新运行 upgrade-check 并再次征得用户授权');
  const report = migrationReportPath(args, 'schema-v2-migration');
  writeJsonAtomic(report, { generated_at: new Date().toISOString(), phase: 'before', plan_id: planId, current_schema_version: config.schema_version, target_schema_version: DATA_SCHEMA_VERSION, plans });
  const identity = config.feishu.identity;
  const workspace = workspacePlan(config);
  const imageText = { ...config.feishu.image_text };
  if (workspace.rename_image_table) renameTable(imageText, identity, '图文笔记');
  imageText.table_name = '图文笔记';
  let blogger;
  if (workspace.blogger_table) {
    blogger = ensureViewId(bindingFromTable(imageText, workspace.blogger_table, workspace.blogger_table.name), identity);
  } else {
    blogger = createTable({ baseToken: imageText.base_token, baseUrl: imageText.base_url, baseName: imageText.base_name, name: '博主主页', fields: BLOGGER_FIELD_SCHEMA, identity });
  }
  let video;
  let copied = { records: 0, attachments: 0 };
  if (workspace.target_video_table) {
    video = bindingFromTable(imageText, workspace.target_video_table, '视频笔记');
    video.view_id = config.feishu.video.base_token === imageText.base_token && config.feishu.video.table_id === video.table_id
      ? config.feishu.video.view_id : video.view_id;
    video = ensureViewId(video, identity);
    if (workspace.target_video_table.name !== '视频笔记') renameTable(video, identity, '视频笔记');
    if (workspace.copy_video_records) copied = copyVideoLibrary(config.feishu.video, video, identity);
  } else if (config.feishu.video.base_token === imageText.base_token) {
    video = { ...config.feishu.video, table_name: '视频笔记' };
    renameTable(video, identity, '视频笔记');
  } else {
    video = createTable({ baseToken: imageText.base_token, baseUrl: imageText.base_url, baseName: imageText.base_name, name: '视频笔记', fields: VIDEO_FIELD_SCHEMA, identity });
    copied = copyVideoLibrary(config.feishu.video, video, identity);
  }
  if (!blogger.view_id || !video.view_id) throw new Error('统一工作台的数据表已找到，但缺少 View ID；请检查表权限后重新运行 upgrade-check');
  const linksCreated = {
    image_text: ensureLinkField(imageText, blogger, identity),
    video: ensureLinkField(video, blogger, identity),
  };
  const migrated = normalizeConfig({ ...config, schema_version: DATA_SCHEMA_VERSION, initialized: true, feishu: { ...config.feishu, image_text: imageText, video, blogger } });
  writeJsonAtomic(configPath(), migrated);
  const afterApplied = applyMissingSchema(migrated);
  const after = migrationPlans(migrated);
  writeJsonAtomic(report, { generated_at: new Date().toISOString(), phase: 'complete', plan_id: planId, previous_schema_version: config.schema_version, schema_version: DATA_SCHEMA_VERSION, workspace, copied, links_created: linksCreated, created: afterApplied.created, plans_before: plans, plans_after: after });
  return { ok: true, action: 'upgrade_applied', plan_id: planId, schema_version: DATA_SCHEMA_VERSION, workspace_url: imageText.base_url, tables: { image_text: imageText, video, blogger }, copied, links_created: linksCreated, report, source_video_base_preserved: workspace.preserve_source_video_base, next_authorization: '内容工作台升级已完成。原视频库仍保留为备份；如需删除旧库或修复历史图片，必须再次单独征求授权。' };
}

async function upgradeApply(args) {
  ensureNode();
  const assessment = upgradeAssessment();
  if (!assessment.config) throw new Error('未检测到旧版配置；这是首次安装，不应执行升级');
  if (assessment.mode === 'ready') return json({ ok: true, action: 'already_upgraded', plan_id: assessment.plan_id, message: '当前多维表格已经完成升级，无需重复执行。' });
  json(applySchemaUpgrade({ config: assessment.config, plans: assessment.plans, planId: assessment.plan_id, args, confirmationFlag: 'confirm-upgrade' }));
}

async function schemaPlan(args) {
  ensureNode();
  const assessment = upgradeAssessment(args);
  if (!assessment.config) return json(assessment);
  const { config, plans, plan_id: planId } = assessment;
  const report = migrationReportPath(args, 'schema-v2-plan');
  writeJsonAtomic(report, { generated_at: new Date().toISOString(), plan_id: planId, current_schema_version: config.schema_version, target_schema_version: DATA_SCHEMA_VERSION, plans });
  json({ ok: true, action: 'schema_plan', plan_id: planId, report, plans });
}

async function schemaMigrate(args) {
  ensureNode();
  const assessment = upgradeAssessment();
  if (!assessment.config) throw new Error('未检测到可升级的旧版配置');
  json(applySchemaUpgrade({ config: assessment.config, plans: assessment.plans, planId: assessment.plan_id, args, confirmationFlag: 'confirm-migrate' }));
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
  if (loaded.config.schema_version !== DATA_SCHEMA_VERSION) throw new Error(`Excel 已生成：${backup}；当前飞书表格仍需升级。请先运行 upgrade-check，展示升级说明并取得授权后，再按返回的 plan_id 执行 upgrade-apply`);
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
  if (command === 'upgrade-check') return upgradeCheck(args);
  if (command === 'upgrade-apply') return upgradeApply(args);
  if (command === 'configure') return configure(args);
  if (command === 'schema-plan') return schemaPlan(args);
  if (command === 'schema-migrate') return schemaMigrate(args);
  if (command === 'repair-images') return repairImages(args);
  if (command === 'extract') return extract(args);
  if (command === 'archive') return archive(args);
  throw new Error('用法：xhs-breakdown.mjs <doctor|upgrade-check|upgrade-apply|configure|schema-plan|schema-migrate|repair-images|extract|archive> [参数]');
}

main().catch((error) => fail(error.message));
