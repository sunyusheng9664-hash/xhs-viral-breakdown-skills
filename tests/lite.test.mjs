import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { configPath, loadConfig, normalizeConfig, proConfigPath, validateConfig, writeJsonAtomic } from '../skills/xhs-image-text-lite-to-bitable/scripts/lib/config.mjs';
import { configPath as videoConfigPath, loadConfig as loadVideoConfig, normalizeConfig as normalizeVideoConfig, proConfigPath as videoProConfigPath, validateConfig as validateVideoConfig } from '../skills/xhs-video-lite-to-bitable/scripts/lib/config.mjs';

test('Lite 配置使用独立目录且可从 Pro 图文绑定迁移', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-lite-config-'));
  const env = { XDG_CONFIG_HOME: path.join(home, 'neutral') };
  const pro = proConfigPath({ home, env, platform: 'darwin' });
  writeJsonAtomic(pro, { feishu: { identity: 'bot', image_text: { base_token: 'i', table_id: 'ti', view_id: 'vi', base_url: 'https://base/i' }, video: { base_token: 'v', table_id: 'tv', view_id: 'vv' } } });
  const loaded = loadConfig({ home, env, platform: 'darwin', migrate: true });
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.config.feishu.image_text.base_token, 'i');
  assert.equal(configPath({ home, env, platform: 'darwin' }), path.join(env.XDG_CONFIG_HOME, 'xhs-image-text-lite', 'config.json'));
});

test('Lite 配置只要求图文库绑定', () => {
  const config = normalizeConfig({ feishu: { identity: 'bot', image_text: { base_token: 'i', table_id: 'ti', view_id: 'vi' } } });
  assert.deepEqual(validateConfig(config), []);
});

test('Lite archive 不需要 analysis 字段且先生成 Excel', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-lite-archive-'));
  const input = path.join(dir, 'collected.json');
  fs.writeFileSync(input, JSON.stringify({ items: [
    { status: 'success', type: 'image_text', original_url: 'https://xhslink.com/a', final_url: 'https://www.xiaohongshu.com/explore/n1', note_id: 'n1', data: { title: '标题', description: '正文', topics: ['AI'], cover_url: 'https://img/1', image_urls: ['https://img/1', 'https://img/2'], metrics: { liked: 1, collected: 2, commented: 3, shared: 4 } } },
    { status: 'failed', original_url: 'https://xhslink.com/v', reason: 'Lite 版只支持图文笔记' },
  ] }));
  const cli = fileURLToPath(new URL('../skills/xhs-image-text-lite-to-bitable/scripts/xhs-image-text-lite.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'archive', '--input', input, '--output-dir', dir, '--no-write'], { encoding: 'utf8', cwd: dir });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.failed, 1);
  assert.equal(fs.existsSync(output.backup), true);
});

test('视频 Lite 配置使用独立目录且可从 Pro 视频绑定迁移', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-video-lite-config-'));
  const env = { XDG_CONFIG_HOME: path.join(home, 'neutral') };
  const pro = videoProConfigPath({ home, env, platform: 'darwin' });
  writeJsonAtomic(pro, { feishu: { identity: 'bot', image_text: { base_token: 'i', table_id: 'ti', view_id: 'vi' }, video: { base_token: 'v', table_id: 'tv', view_id: 'vv', base_url: 'https://base/v' } } });
  const loaded = loadVideoConfig({ home, env, platform: 'darwin', migrate: true });
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.config.feishu.video.base_token, 'v');
  assert.equal(videoConfigPath({ home, env, platform: 'darwin' }), path.join(env.XDG_CONFIG_HOME, 'xhs-video-lite', 'config.json'));
});

test('视频 Lite 配置只要求视频库绑定', () => {
  const config = normalizeVideoConfig({ feishu: { identity: 'bot', video: { base_token: 'v', table_id: 'tv', view_id: 'vv' } } });
  assert.deepEqual(validateVideoConfig(config), []);
});

test('视频 Lite archive 不需要字幕和 analysis 字段且先生成 Excel', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-video-lite-archive-'));
  const input = path.join(dir, 'collected.json');
  fs.writeFileSync(input, JSON.stringify({ items: [
    { status: 'success', type: 'video', original_url: 'https://xhslink.com/v', final_url: 'https://www.xiaohongshu.com/explore/v1', note_id: 'v1', data: { title: '视频标题', description: '视频正文', author: '作者', cover_url: 'https://img/1', duration_seconds: 65, metrics: { liked: 1, collected: 2, commented: 3, shared: 4 } } },
    { status: 'failed', original_url: 'https://xhslink.com/i', reason: '视频 Lite 版只支持视频笔记' },
  ] }));
  const cli = fileURLToPath(new URL('../skills/xhs-video-lite-to-bitable/scripts/xhs-video-lite.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'archive', '--input', input, '--output-dir', dir, '--no-write'], { encoding: 'utf8', cwd: dir });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.failed, 1);
  assert.equal(fs.existsSync(output.backup), true);
});
