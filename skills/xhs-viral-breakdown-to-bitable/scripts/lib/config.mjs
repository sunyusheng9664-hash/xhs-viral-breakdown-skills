import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function configDir(env = process.env, platform = process.platform, home = os.homedir()) {
  if (env.XHS_VIRAL_CONFIG_HOME) return path.resolve(env.XHS_VIRAL_CONFIG_HOME);
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'xhs-viral-breakdown');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'xhs-viral-breakdown');
}

export function configPath(options = {}) {
  return path.join(configDir(options.env, options.platform, options.home), 'config.json');
}

export function indexPath(options = {}) {
  return path.join(configDir(options.env, options.platform, options.home), 'archive-index.json');
}

export function legacyConfigPath(home = os.homedir()) {
  return path.join(home, '.codex', 'xhs-viral-breakdown-to-bitable', 'config.json');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch {}
}

function normalizeBinding(value = {}, fallbackName) {
  return {
    base_name: value.base_name || fallbackName,
    base_token: value.base_token || '',
    base_url: value.base_url || '',
    table_name: value.table_name || '内容拆解库',
    table_id: value.table_id || '',
    view_id: value.view_id || '',
  };
}

export function normalizeConfig(input = {}) {
  const source = input.feishu || input;
  const legacyFlat = source.video_base_token || source.image_text_base_token;
  const video = legacyFlat ? {
    base_name: source.video_base_name,
    base_token: source.video_base_token,
    base_url: source.video_base_url,
    table_name: source.video_table_name,
    table_id: source.video_table_id,
    view_id: source.video_view_id,
  } : (source.video || input.video || {});
  const imageText = legacyFlat ? {
    base_name: source.image_text_base_name,
    base_token: source.image_text_base_token,
    base_url: source.image_text_base_url,
    table_name: source.image_text_table_name,
    table_id: source.image_text_table_id,
    view_id: source.image_text_view_id,
  } : (source.image_text || input.image_text || {});
  return {
    schema_version: Number(input.schema_version) === 2 ? 2 : 1,
    initialized: Boolean(input.initialized || (video.base_token && imageText.base_token)),
    created_at: input.created_at || new Date().toISOString(),
    timezone: input.timezone || 'Asia/Shanghai',
    feishu: {
      identity: source.identity === 'user' ? 'user' : 'bot',
      video: normalizeBinding(video, '小红书视频爆款拆解库'),
      image_text: normalizeBinding(imageText, '小红书图文爆款拆解库'),
    },
  };
}

export function validateConfig(config, { requireBindings = true } = {}) {
  const errors = [];
  if (!config || ![1, 2].includes(config.schema_version)) errors.push('schema_version 必须为 1 或 2');
  for (const type of ['video', 'image_text']) {
    const binding = config?.feishu?.[type];
    if (!binding) {
      errors.push(`缺少 feishu.${type}`);
      continue;
    }
    if (requireBindings) {
      for (const key of ['base_token', 'table_id', 'view_id']) {
        if (!binding[key]) errors.push(`缺少 feishu.${type}.${key}`);
      }
    }
  }
  return errors;
}

export function loadConfig({ migrate = true, ...options } = {}) {
  const target = configPath(options);
  if (fs.existsSync(target)) return { config: normalizeConfig(readJson(target)), path: target, migrated: false };
  const legacy = legacyConfigPath(options.home || os.homedir());
  if (migrate && fs.existsSync(legacy)) {
    const config = normalizeConfig(readJson(legacy));
    const errors = validateConfig(config);
    if (errors.length) throw new Error(`旧配置无法迁移：${errors.join('；')}`);
    writeJsonAtomic(target, config);
    return { config, path: target, migrated: true, legacy_path: legacy };
  }
  return { config: null, path: target, migrated: false };
}

export function loadIndex(options = {}) {
  const file = indexPath(options);
  if (!fs.existsSync(file)) return { schema_version: 1, records: [] };
  const value = readJson(file);
  return { schema_version: 1, records: Array.isArray(value.records) ? value.records : [] };
}

export function saveIndex(index, options = {}) {
  writeJsonAtomic(indexPath(options), { schema_version: 1, records: index.records || [] });
}
