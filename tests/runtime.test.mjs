import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { configPath, legacyConfigPath, loadConfig, normalizeConfig, validateConfig, writeJsonAtomic } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/config.mjs';
import { selectPending } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/dedupe.mjs';
import { canonicalProfileUrl, extractInitialStateText, extractOne, extractUrls, fetchPage, findNoteObject, findSubtitleUrl, normalizeBloggerProfile, normalizeNote, parseCount, parseInitialState, parseMediaV2, profileIdFromUrl, srtToTranscript } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/xhs.mjs';
import { parseJsonOutput, valuesAsStrings } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/lark.mjs';
import { buildMigrationPlan, classifyRepairFailure, recordObjects } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/migration.mjs';
import { downloadFreshMedia } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/media.mjs';
import { extractionOutcome } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/outcome.mjs';
import { writeXlsx } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/xlsx.mjs';

test('从混合分享文案提取并清理小红书链接', () => {
  assert.deepEqual(extractUrls('看这个 https://xhslink.com/a/abc，另一个 https://www.xiaohongshu.com/explore/123。'), [
    'https://xhslink.com/a/abc', 'https://www.xiaohongshu.com/explore/123',
  ]);
});

test('解析包含 undefined 和花括号字符串的初始状态', () => {
  const html = '<script>window.__INITIAL_STATE__={"text":"a}b","missing":undefined,"ok":true}</script>';
  assert.equal(extractInitialStateText(html), '{"text":"a}b","missing":undefined,"ok":true}');
  assert.deepEqual(parseInitialState(html), { text: 'a}b', missing: null, ok: true });
});

test('递归定位笔记对象而不依赖固定路径', () => {
  const note = { noteId: 'n1', title: '标题', desc: '正文', imageList: [{ url: 'https://img/1' }], interactInfo: { likedCount: '1.2万' } };
  assert.equal(findNoteObject({ a: { b: [note] } }, 'n1'), note);
});

test('数字单位、mediaV2 二次解析和 SRT 文本归并', () => {
  assert.equal(parseCount('1.2万'), 12000);
  assert.equal(parseCount('1千+'), 1000);
  assert.equal(parseCount('3K'), 3000);
  assert.deepEqual(parseMediaV2(JSON.stringify(JSON.stringify({ video: { duration: 12 } }))), { video: { duration: 12 } });
  assert.equal(srtToTranscript('1\n00:00:00,000 --> 00:00:01,000\n你好\n\n2\n00:00:01,000 --> 00:00:02,000\n世界'), '你好\n世界');
});

test('字幕优先选择 source 中文而不是通用 subtitles 对象的首项', () => {
  const media = { video: { subtitles: { 'en-US': [{ url: 'https://sub/en.srt' }], source: [{ url: 'https://sub/source.srt', language: 'zh-CN' }], 'zh-CN': [{ url: 'https://sub/zh.srt' }] } } };
  assert.equal(findSubtitleUrl(media), 'https://sub/source.srt');
});

test('规范化图文和视频并保持数字类型', () => {
  const image = normalizeNote({ noteId: 'i1', title: '图文', user: { userId: 'u1', nickname: '作者' }, imageList: [{ urlDefault: 'https://img/1' }, { url: 'https://img/2' }], interactInfo: { likedCount: '10', collectedCount: 2 } }, { originalUrl: 'https://xhslink.com/i', finalUrl: 'https://www.xiaohongshu.com/explore/i1', noteId: 'i1' });
  assert.equal(image.type, 'image_text');
  assert.equal(image.data.metrics.liked, 10);
  assert.equal(image.data.author_id, 'u1');
  const video = normalizeNote({ noteId: 'v1', title: '视频', video: {}, mediaV2: JSON.stringify({ video: { duration: 12000 } }) }, { originalUrl: 'https://xhslink.com/v', finalUrl: 'https://www.xiaohongshu.com/explore/v1', noteId: 'v1' });
  assert.equal(video.type, 'video');
  assert.equal(video.data.duration_seconds, 12);
});

test('识别并规范化博主主页而不是误判为图文', async () => {
  const finalUrl = 'https://www.xiaohongshu.com/user/profile/u123?xsec_token=token';
  const state = {
    user: {
      userPageData: {
        basicInfo: { nickname: '测试博主', redId: 'red123', desc: '公开简介', imageb: 'https://img/avatar.webp' },
        interactions: [
          { type: 'fans', count: '1.2万' },
          { type: 'follows', count: '10+' },
          { type: 'interaction', count: '3万+' },
        ],
      },
      notes: [[
        { noteCard: { noteId: 'n1', displayTitle: '较高点赞', user: { userId: 'u123' }, interactInfo: { likedCount: '99' }, cover: { url: 'https://img/1.webp' } } },
        { noteCard: { noteId: 'n2', displayTitle: '普通笔记', user: { userId: 'u123' }, interactInfo: { likedCount: '8' } } },
      ]],
    },
  };
  const normalized = normalizeBloggerProfile(state, { originalUrl: 'https://xhslink.com/m/profile', finalUrl });
  assert.equal(profileIdFromUrl(finalUrl), 'u123');
  assert.equal(canonicalProfileUrl(finalUrl), 'https://www.xiaohongshu.com/user/profile/u123');
  assert.equal(normalized.type, 'blogger_profile');
  assert.equal(normalized.data.follower_count, 12000);
  assert.equal(normalized.data.total_likes_collects, 30000);
  assert.equal(normalized.data.top_visible_notes[0].note_id, 'n1');

  const html = `<script>window.__INITIAL_STATE__=${JSON.stringify(state)}</script>`;
  const fakeFetch = async () => ({ ok: true, status: 200, url: finalUrl, text: async () => html });
  const extracted = await extractOne('https://xhslink.com/m/profile', fakeFetch);
  assert.equal(extracted.type, 'blogger_profile');
  assert.equal(extracted.profile_id, 'u123');
  assert.equal(extracted.note_id, '');
});

test('桌面请求失败后使用移动端 UA 回退', async () => {
  const calls = [];
  const fakeFetch = async (_url, options) => {
    calls.push(options.headers['user-agent']);
    if (calls.length === 1) return { ok: false, status: 404, url: 'https://desktop', text: async () => '404' };
    return { ok: true, status: 200, url: 'https://mobile/explore/n1', text: async () => '<script>window.__INITIAL_STATE__={}</script>' };
  };
  const result = await fetchPage('https://xhslink.com/a', fakeFetch);
  assert.equal(result.finalUrl, 'https://mobile/explore/n1');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /iPhone/);
});

test('迁移旧 Codex 配置且不删除旧文件', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-config-'));
  const env = { XDG_CONFIG_HOME: path.join(home, 'neutral') };
  const legacy = legacyConfigPath(home);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  writeJsonAtomic(legacy, { video: { base_token: 'v', table_id: 'tblv', view_id: 'vewv' }, image_text: { base_token: 'i', table_id: 'tbli', view_id: 'vewi' } });
  const loaded = loadConfig({ home, env, platform: 'darwin', migrate: true });
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.config.feishu.video.base_token, 'v');
  assert.equal(fs.existsSync(legacy), true);
  assert.equal(fs.existsSync(configPath({ home, env, platform: 'darwin' })), true);
});

test('Windows 配置位于 APPDATA', () => {
  assert.equal(configPath({ home: 'C:\\Users\\A', env: { APPDATA: 'C:\\Users\\A\\AppData\\Roaming' }, platform: 'win32' }), path.join('C:\\Users\\A\\AppData\\Roaming', 'xhs-viral-breakdown', 'config.json'));
});

test('测试环境可以显式隔离配置目录', () => {
  assert.equal(configPath({ home: '/home/a', env: { XHS_VIRAL_CONFIG_HOME: '/tmp/xhs-isolated' }, platform: 'darwin' }), path.join('/tmp/xhs-isolated', 'config.json'));
});

test('配置校验拒绝缺少绑定标识', () => {
  const errors = validateConfig(normalizeConfig({}));
  assert.ok(errors.some((error) => error.includes('base_token')));
});

test('配置兼容 Schema v1、v2 并保留 Schema v3', () => {
  assert.equal(normalizeConfig({ schema_version: 1 }).schema_version, 1);
  assert.equal(normalizeConfig({ schema_version: 2 }).schema_version, 2);
  assert.equal(normalizeConfig({ schema_version: 3 }).schema_version, 3);
});

test('Schema v2 迁移只新增缺失字段并保留自定义视图字段', () => {
  const fields = { data: { items: [{ id: 'fld1', name: '标题', type: 'text' }, { id: 'fld2', name: '封面图片', type: 'attachment' }, { id: 'fld3', name: '自定义标签', type: 'text' }] } };
  const visible = { data: { visible_fields: ['标题', '封面', '图片', '自定义标签'] } };
  const plan = buildMigrationPlan('image_text', fields, visible);
  assert.ok(!plan.missing_fields.some((field) => field.name === '封面图片'));
  assert.ok(plan.missing_fields.some((field) => field.name === '图片附件'));
  assert.ok(plan.visible_fields_after.includes('自定义标签'));
  assert.ok(!plan.visible_fields_after.includes('封面'));
  assert.ok(!plan.visible_fields_after.includes('图片'));
});

test('Schema v2 兼容视图返回字段 ID 并只隐藏旧 CDN 字段', () => {
  const fields = { data: { items: [{ id: 'fld-cover-old', name: '封面', type: 'text' }, { id: 'fld-custom', name: '自定义标签', type: 'text' }] } };
  const visible = { data: { visible_fields: ['fld-cover-old', 'fld-custom'] } };
  const plan = buildMigrationPlan('video', fields, visible);
  assert.ok(!plan.visible_fields_after.includes('fld-cover-old'));
  assert.ok(plan.visible_fields_after.includes('fld-custom'));
  assert.ok(plan.visible_fields_after.includes('封面图片'));
});

test('历史修复失败不会把风控或短链错误误写成已删除', () => {
  assert.equal(classifyRepairFailure({ original_url: 'https://xhslink.com/o/a', reason: 'HTTP 403' }), '抓取受限');
  assert.equal(classifyRepairFailure({ original_url: 'https://xhslink.com/o/a', reason: '无法读取，HTTP 404' }), '短链失效');
  assert.equal(classifyRepairFailure({ original_url: 'https://www.xiaohongshu.com/explore/a', reason: '该笔记已删除' }), '源笔记不可访问');
});

test('递归读取飞书记录并保留 record_id', () => {
  const rows = recordObjects({ data: { items: [{ record_id: 'rec1', fields: { 链接: 'https://xhslink.com/o/a' } }] } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].record_id, 'rec1');
});

test('图片下载只使用本次从原笔记提取的地址并保持顺序命名', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-media-'));
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
  };
  const result = await downloadFreshMedia({ type: 'image_text', final_url: 'https://www.xiaohongshu.com/explore/n1', data: { image_urls: ['https://fresh/1', 'https://fresh/2'] } }, dir, fakeFetch);
  assert.deepEqual(calls, ['https://fresh/1', 'https://fresh/2']);
  assert.deepEqual(result.files.map((file) => path.basename(file)), ['01_封面.jpg', '02.jpg']);
  assert.equal(result.errors.length, 0);
});

test('博主头像下载使用独立附件命名', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-avatar-'));
  const fakeFetch = async () => ({ ok: true, status: 200, headers: { get: () => 'image/webp' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
  const result = await downloadFreshMedia({ type: 'blogger_profile', final_url: 'https://www.xiaohongshu.com/user/profile/u1', data: { avatar_url: 'https://img/avatar' } }, dir, fakeFetch);
  assert.equal(path.basename(result.files[0]), '01_头像.webp');
});

test('飞书 CLI JSON 可从附带日志的输出解析', () => {
  assert.deepEqual(parseJsonOutput('log line\n{"ok":true}\n'), { ok: true });
});

test('远端 URL 字段兼容飞书 Markdown 链接格式', () => {
  assert.ok(valuesAsStrings('[http://xhslink.com/o/abc](http://xhslink.com/o/abc)').includes('http://xhslink.com/o/abc'));
});

test('同一批次的短链和长链按 noteId 去重', () => {
  const selected = selectPending([
    { note_id: 'n1', original_url: 'https://xhslink.com/a', final_url: 'https://www.xiaohongshu.com/explore/n1' },
    { note_id: 'n1', original_url: 'https://www.xiaohongshu.com/explore/n1', final_url: 'https://www.xiaohongshu.com/explore/n1' },
  ]);
  assert.equal(selected.pending.length, 1);
  assert.equal(selected.duplicates, 1);
});

test('全部提取失败时顶层状态为失败', () => {
  assert.deepEqual(extractionOutcome([{ status: 'failed' }, { status: 'failed' }]), { ok: false, succeeded: 0, failed: 2 });
  assert.deepEqual(extractionOutcome([{ status: 'success' }, { status: 'failed' }]), { ok: true, succeeded: 1, failed: 1 });
});

test('生成标准 XLSX ZIP 容器', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-xlsx-'));
  const file = path.join(dir, 'backup.xlsx');
  writeXlsx(file, { 图文: [['标题', '点赞'], ['测试', 12]], 视频: [['标题']] });
  const data = fs.readFileSync(file);
  assert.equal(data.subarray(0, 2).toString(), 'PK');
  assert.ok(data.length > 1000);
});

test('archive 无写入模式先产生 Excel 备份', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-archive-'));
  const input = path.join(dir, 'analyzed.json');
  fs.writeFileSync(input, JSON.stringify({ items: [{ status: 'success', type: 'image_text', original_url: 'https://xhslink.com/a', final_url: 'https://www.xiaohongshu.com/explore/n1', note_id: 'n1', data: { title: '标题', topics: [], image_urls: [], metrics: {} }, analysis: { body_summary: '摘要', cover_analysis: '未检查封面，仅基于文本', interaction_drivers: '收藏', viral_reasons: '结构', reusable_tactics: '模板' } }] }));
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-unrelated-cwd-'));
  const result = spawnSync(process.execPath, [cli, 'archive', '--input', input, '--output-dir', dir, '--no-write'], { encoding: 'utf8', cwd: unrelatedCwd });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(fs.existsSync(output.backup), true);
});

test('archive 无写入模式包含博主主页工作表', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-blogger-archive-'));
  const input = path.join(dir, 'analyzed.json');
  fs.writeFileSync(input, JSON.stringify({ items: [{
    status: 'success', type: 'blogger_profile', original_url: 'https://xhslink.com/m/u1', final_url: 'https://www.xiaohongshu.com/user/profile/u1', profile_id: 'u1', note_id: '',
    data: { user_id: 'u1', canonical_profile_url: 'https://www.xiaohongshu.com/user/profile/u1', nickname: '博主', red_id: 'red1', description: '简介', follower_count: 100, total_likes_collects: 200, visible_note_count: 1, top_visible_notes: [{ title: '样本', liked_count: 9 }] },
    analysis: { avatar_style: '真人头像', content_positioning: '健身分享', persona_tags: ['学生'], audience_profile: '健身新人', value_proposition: '训练经验', differentiation: '科研视角', data_limitations: '未登录首屏样本', collection_status: '部分字段缺失' },
  }] }));
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'archive', '--input', input, '--output-dir', dir, '--no-write'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(fs.existsSync(output.backup), true);
  const strings = spawnSync('unzip', ['-p', output.backup, 'xl/workbook.xml'], { encoding: 'utf8' }).stdout;
  assert.match(strings, /博主主页/);
});

test('混合归档按 author_id 把已有笔记关联到博主记录', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-blogger-link-'));
  const bin = path.join(dir, 'bin');
  const configHome = path.join(dir, 'config');
  const log = path.join(dir, 'lark.log');
  fs.mkdirSync(bin, { recursive: true });
  writeJsonAtomic(path.join(configHome, 'config.json'), normalizeConfig({ schema_version: 3, initialized: true, feishu: {
    identity: 'bot',
    image_text: { base_token: 'base', table_id: 'table1', view_id: 'view1', base_url: 'https://base/workspace' },
    video: { base_token: 'base', table_id: 'table2', view_id: 'view2', base_url: 'https://base/workspace' },
    blogger: { base_token: 'base', table_id: 'table3', view_id: 'view3', base_url: 'https://base/workspace' },
  } }));
  const fake = path.join(bin, 'lark-cli');
  fs.writeFileSync(fake, `#!/bin/sh
if [ "$1" = "--version" ]; then echo "1.0.0"; exit 0; fi
echo "$*" >> "$LARK_TEST_LOG"
case " $* " in
  *" +record-list "*" --table-id table3 "*) echo '{"data":{"data":[{"record_id":"recB","fields":{"主页链接":"https://www.xiaohongshu.com/user/profile/u1","小红书号":"red1"}}],"has_more":false}}' ;;
  *" +record-list "*" --table-id table1 "*) echo '{"data":{"data":[{"record_id":"recN","fields":{"链接":"https://xhslink.com/n1","笔记ID":"n1"}}],"has_more":false}}' ;;
  *" +record-list "*) echo '{"data":{"data":[],"has_more":false}}' ;;
  *) echo '{"ok":true}' ;;
esac
`);
  fs.chmodSync(fake, 0o755);
  const input = path.join(dir, 'analyzed.json');
  fs.writeFileSync(input, JSON.stringify({ items: [
    { status: 'success', type: 'blogger_profile', original_url: 'https://xhslink.com/m/u1', final_url: 'https://www.xiaohongshu.com/user/profile/u1', profile_id: 'u1', note_id: '', data: { user_id: 'u1', canonical_profile_url: 'https://www.xiaohongshu.com/user/profile/u1', nickname: '博主', red_id: 'red1', description: '简介', avatar_url: '' }, analysis: { avatar_style: '文字头像', content_positioning: '效率', persona_tags: ['职场人'], audience_profile: '新人', value_proposition: '方法', differentiation: '案例', data_limitations: '公开首屏', collection_status: '部分字段缺失' } },
    { status: 'success', type: 'image_text', original_url: 'https://xhslink.com/n1', final_url: 'https://www.xiaohongshu.com/explore/n1', note_id: 'n1', data: { title: '图文', author_id: 'u1', topics: [], image_urls: [], metrics: {} }, analysis: { body_summary: '摘要', cover_analysis: '未检查', interaction_drivers: '实用', viral_reasons: '结构', reusable_tactics: '模板' } },
  ] }));
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'archive', '--input', input, '--output-dir', dir], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, XHS_VIRAL_CONFIG_HOME: configHome, LARK_TEST_LOG: log } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.linked_to_blogger, 1);
  assert.equal(output.unlinked_notes.length, 0);
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /所属博主/);
  assert.match(calls, /recB/);
});

test('doctor 校验配置和所选飞书身份并可从任意目录运行', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-doctor-'));
  const bin = path.join(dir, 'bin');
  const configHome = path.join(dir, 'config');
  fs.mkdirSync(bin, { recursive: true });
  writeJsonAtomic(path.join(configHome, 'config.json'), normalizeConfig({ initialized: true, feishu: { identity: 'bot', image_text: { base_token: 'i', table_id: 'ti', view_id: 'vi' }, video: { base_token: 'v', table_id: 'tv', view_id: 'vv' } } }));
  const fake = path.join(bin, 'lark-cli');
  fs.writeFileSync(fake, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "1.0.0"; exit 0; fi\necho '{"identities":{"bot":{"status":"ready","available":true,"verified":true}},"verified":true}'\n`);
  fs.chmodSync(fake, 0o755);
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'doctor', '--skip-network'], { encoding: 'utf8', cwd: dir, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, XHS_VIRAL_CONFIG_HOME: configHome } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.lark_cli.auth.identity, 'bot');
});

test('doctor 在配置缺失时返回非零退出码', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-doctor-missing-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const fake = path.join(bin, 'lark-cli');
  fs.writeFileSync(fake, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "1.0.0"; exit 0; fi\necho '{"identities":{"bot":{"status":"ready","available":true,"verified":true}},"verified":true}'\n`);
  fs.chmodSync(fake, 0o755);
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'doctor', '--skip-network'], { encoding: 'utf8', cwd: dir, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, XHS_VIRAL_CONFIG_HOME: path.join(dir, 'missing') } });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).config.status, 'missing');
});

test('无旧配置时识别为首次安装且不访问飞书', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-upgrade-install-'));
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'upgrade-check'], { encoding: 'utf8', env: { ...process.env, HOME: dir, XHS_VIRAL_CONFIG_HOME: path.join(dir, 'config'), PATH: '' } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.mode, 'install');
  assert.equal(output.next_action, 'configure');
});

test('更新先说明授权并把双库升级为统一工作台', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-schema-v3-'));
  const bin = path.join(dir, 'bin');
  const configHome = path.join(dir, 'config');
  const reports = path.join(dir, 'reports');
  const log = path.join(dir, 'lark.log');
  fs.mkdirSync(bin, { recursive: true });
  writeJsonAtomic(path.join(configHome, 'config.json'), normalizeConfig({ schema_version: 1, initialized: true, feishu: { identity: 'bot', image_text: { base_token: 'base', table_id: 'table-image', table_name: '内容拆解库', view_id: 'view-image' }, video: { base_token: 'base', table_id: 'table-video', table_name: '内容拆解库', view_id: 'view-video' } } }));
  const fake = path.join(bin, 'lark-cli');
  fs.writeFileSync(fake, `#!/bin/sh
echo "$*" >> "$LARK_TEST_LOG"
if [ "$1" = "--version" ]; then echo "1.0.0"; exit 0; fi
case " $* " in
  *" auth status "*) echo '{"identities":{"bot":{"status":"ready","available":true,"verified":true}}}' ;;
  *" +table-list "*) echo '{"data":{"tables":[{"id":"table-image","name":"内容拆解库"},{"id":"table-video","name":"内容拆解库"},{"id":"table-blogger","name":"博主主页"}]}}' ;;
  *" +view-list "*) echo '{"data":{"views":[{"id":"view-blogger","name":"Grid View"}]}}' ;;
  *" +field-list "*) echo '{"data":{"items":[{"id":"fld-title","name":"标题","type":"text"},{"id":"fld-custom","name":"自定义标签","type":"text"}]}}' ;;
  *" +view-get-visible-fields "*) echo '{"data":{"visible_fields":["标题","封面","图片","自定义标签"]}}' ;;
  *) echo '{"ok":true}' ;;
esac
`);
  fs.chmodSync(fake, 0o755);
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XHS_VIRAL_CONFIG_HOME: configHome, LARK_TEST_LOG: log };
  const check = spawnSync(process.execPath, [cli, 'upgrade-check', '--output-dir', reports], { encoding: 'utf8', env });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const preview = JSON.parse(check.stdout);
  assert.equal(preview.mode, 'upgrade');
  assert.equal(preview.authorization.scope, 'workspace_consolidation');
  assert.ok(preview.authorization.excludes.includes('删除原视频库'));
  assert.match(preview.customer_message, /小红书内容工作台/);
  assert.match(preview.customer_message, /是否授权我按以上方案合并现有多维表格/);
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /\+field-create/);
  const blocked = spawnSync(process.execPath, [cli, 'upgrade-apply', '--plan-id', preview.plan_id, '--output-dir', reports], { encoding: 'utf8', env });
  assert.equal(blocked.status, 1, blocked.stderr || blocked.stdout);
  const stale = spawnSync(process.execPath, [cli, 'upgrade-apply', '--plan-id', 'stale-plan', '--confirm-upgrade', '--output-dir', reports], { encoding: 'utf8', env });
  assert.equal(stale.status, 1, stale.stderr || stale.stdout);
  assert.match(`${stale.stdout}${stale.stderr}`, /原授权失效/);
  const migrated = spawnSync(process.execPath, [cli, 'upgrade-apply', '--plan-id', preview.plan_id, '--confirm-upgrade', '--output-dir', reports], { encoding: 'utf8', env });
  assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout);
  assert.equal(JSON.parse(migrated.stdout).schema_version, 3);
  assert.match(JSON.parse(migrated.stdout).next_authorization, /单独征求授权/);
  const saved = JSON.parse(fs.readFileSync(path.join(configHome, 'config.json'), 'utf8'));
  assert.equal(saved.schema_version, 3);
  assert.equal(saved.feishu.video.base_token, saved.feishu.image_text.base_token);
  assert.equal(saved.feishu.blogger.table_id, 'table-blogger');
  assert.match(fs.readFileSync(log, 'utf8'), /\+field-create/);
  assert.match(fs.readFileSync(log, 'utf8'), /\+view-set-visible-fields/);
});

test('飞书用户身份未授权时先返回最小权限引导，不读取表结构', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-auth-guide-'));
  const bin = path.join(dir, 'bin');
  const configHome = path.join(dir, 'config');
  const log = path.join(dir, 'lark.log');
  fs.mkdirSync(bin, { recursive: true });
  writeJsonAtomic(path.join(configHome, 'config.json'), normalizeConfig({ schema_version: 2, initialized: true, feishu: { identity: 'user', image_text: { base_token: 'image', table_id: 'table-image', view_id: 'view-image' }, video: { base_token: 'video', table_id: 'table-video', view_id: 'view-video' } } }));
  const fake = path.join(bin, 'lark-cli');
  fs.writeFileSync(fake, `#!/bin/sh\necho "$*" >> "$LARK_TEST_LOG"\nif [ "$1" = "--version" ]; then echo "1.0.0"; exit 0; fi\necho '{"identities":{"user":{"status":"missing","available":false,"verified":false}}}'\n`);
  fs.chmodSync(fake, 0o755);
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XHS_VIRAL_CONFIG_HOME: configHome, LARK_TEST_LOG: log };
  const check = spawnSync(process.execPath, [cli, 'upgrade-check'], { encoding: 'utf8', env });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const output = JSON.parse(check.stdout);
  assert.equal(output.mode, 'authorization_required');
  assert.equal(output.authorization.command, 'lark-cli auth login --domain base --no-wait --json');
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /\+table-list|\+field-list/);
});

test('飞书命令失败时仍保留 Excel 备份', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-write-failure-'));
  const configHome = path.join(dir, 'config');
  fs.mkdirSync(configHome, { recursive: true });
  writeJsonAtomic(path.join(configHome, 'config.json'), normalizeConfig({ schema_version: 3, initialized: true, feishu: { identity: 'bot', image_text: { base_token: 'base', table_id: 'table', view_id: 'view' }, video: { base_token: 'base', table_id: 'table2', view_id: 'view2' }, blogger: { base_token: 'base', table_id: 'table3', view_id: 'view3' } } }));
  const input = path.join(dir, 'analyzed.json');
  fs.writeFileSync(input, JSON.stringify({ items: [{ status: 'success', type: 'image_text', original_url: 'https://xhslink.com/a', final_url: 'https://www.xiaohongshu.com/explore/n1', note_id: 'n1', data: { title: '标题', topics: [], image_urls: [], metrics: {} }, analysis: { body_summary: '摘要', cover_analysis: '未检查封面', interaction_drivers: '收藏', viral_reasons: '结构', reusable_tactics: '模板' } }] }));
  const cli = fileURLToPath(new URL('../skills/xhs-viral-breakdown-to-bitable/scripts/xhs-breakdown.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'archive', '--input', input, '--output-dir', dir], { encoding: 'utf8', env: { ...process.env, PATH: '', XHS_VIRAL_CONFIG_HOME: configHome } });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, false);
  assert.equal(fs.existsSync(output.backup), true);
  assert.equal(output.write_errors.length, 1);
});
