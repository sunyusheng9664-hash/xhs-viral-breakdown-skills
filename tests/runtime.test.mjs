import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { configPath, legacyConfigPath, loadConfig, normalizeConfig, validateConfig, writeJsonAtomic } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/config.mjs';
import { selectPending } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/dedupe.mjs';
import { extractInitialStateText, extractUrls, fetchPage, findNoteObject, findSubtitleUrl, normalizeNote, parseCount, parseInitialState, parseMediaV2, srtToTranscript } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/xhs.mjs';
import { parseJsonOutput, valuesAsStrings } from '../skills/xhs-viral-breakdown-to-bitable/scripts/lib/lark.mjs';
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
  assert.equal(parseCount('3K'), 3000);
  assert.deepEqual(parseMediaV2(JSON.stringify(JSON.stringify({ video: { duration: 12 } }))), { video: { duration: 12 } });
  assert.equal(srtToTranscript('1\n00:00:00,000 --> 00:00:01,000\n你好\n\n2\n00:00:01,000 --> 00:00:02,000\n世界'), '你好\n世界');
});

test('字幕优先选择 source 中文而不是通用 subtitles 对象的首项', () => {
  const media = { video: { subtitles: { 'en-US': [{ url: 'https://sub/en.srt' }], source: [{ url: 'https://sub/source.srt', language: 'zh-CN' }], 'zh-CN': [{ url: 'https://sub/zh.srt' }] } } };
  assert.equal(findSubtitleUrl(media), 'https://sub/source.srt');
});

test('规范化图文和视频并保持数字类型', () => {
  const image = normalizeNote({ noteId: 'i1', title: '图文', imageList: [{ urlDefault: 'https://img/1' }, { url: 'https://img/2' }], interactInfo: { likedCount: '10', collectedCount: 2 } }, { originalUrl: 'https://xhslink.com/i', finalUrl: 'https://www.xiaohongshu.com/explore/i1', noteId: 'i1' });
  assert.equal(image.type, 'image_text');
  assert.equal(image.data.metrics.liked, 10);
  const video = normalizeNote({ noteId: 'v1', title: '视频', video: {}, mediaV2: JSON.stringify({ video: { duration: 12000 } }) }, { originalUrl: 'https://xhslink.com/v', finalUrl: 'https://www.xiaohongshu.com/explore/v1', noteId: 'v1' });
  assert.equal(video.type, 'video');
  assert.equal(video.data.duration_seconds, 12);
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

test('飞书命令失败时仍保留 Excel 备份', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-write-failure-'));
  const configHome = path.join(dir, 'config');
  fs.mkdirSync(configHome, { recursive: true });
  writeJsonAtomic(path.join(configHome, 'config.json'), normalizeConfig({ initialized: true, feishu: { identity: 'bot', image_text: { base_token: 'base', table_id: 'table', view_id: 'view' }, video: { base_token: 'base2', table_id: 'table2', view_id: 'view2' } } }));
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
