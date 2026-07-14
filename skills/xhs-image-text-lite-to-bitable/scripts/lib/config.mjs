import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const APP_DIR = 'xhs-image-text-lite';
export const PRO_APP_DIR = 'xhs-viral-breakdown';

export function configPath({ home = os.homedir(), env = process.env, platform = process.platform } = {}) {
  if (env.XHS_IMAGE_TEXT_LITE_CONFIG_HOME) return path.join(env.XHS_IMAGE_TEXT_LITE_CONFIG_HOME, 'config.json');
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), APP_DIR, 'config.json');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), APP_DIR, 'config.json');
}

export function proConfigPath({ home = os.homedir(), env = process.env, platform = process.platform } = {}) {
  if (env.XHS_VIRAL_CONFIG_HOME) return path.join(env.XHS_VIRAL_CONFIG_HOME, 'config.json');
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), PRO_APP_DIR, 'config.json');
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), PRO_APP_DIR, 'config.json');
}

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeBinding(value = {}) {
  return {
    base_name: value.base_name || '小红书图文采集试用库',
    base_token: value.base_token || '',
    base_url: value.base_url || '',
    table_name: value.table_name || '图文采集库',
    table_id: value.table_id || '',
    view_id: value.view_id || '',
  };
}

export function normalizeConfig(input = {}) {
  const source = input.feishu?.image_text || input.feishu || input.image_text || input;
  const binding = normalizeBinding(source);
  return {
    initialized: Boolean(input.initialized || (binding.base_token && binding.table_id && binding.view_id)),
    created_at: input.created_at || new Date().toISOString(),
    version: 1,
    timezone: input.timezone || 'Asia/Shanghai',
    feishu: {
      identity: input.feishu?.identity || input.identity || 'bot',
      image_text: binding,
    },
  };
}

export function validateConfig(config, { requireBinding = true } = {}) {
  const errors = [];
  if (!config) return ['配置不存在'];
  const binding = config.feishu?.image_text;
  if (!binding) errors.push('缺少 feishu.image_text');
  if (requireBinding) {
    for (const key of ['base_token', 'table_id', 'view_id']) {
      if (!binding?.[key]) errors.push(`缺少 feishu.image_text.${key}`);
    }
  }
  if (!['bot', 'user'].includes(config.feishu?.identity || '')) errors.push('feishu.identity 必须是 bot 或 user');
  return errors;
}

export function loadConfig({ migrate = true, ...options } = {}) {
  const target = configPath(options);
  if (fs.existsSync(target)) return { config: normalizeConfig(readJson(target)), path: target, migrated: false };
  if (migrate) {
    const pro = proConfigPath(options);
    if (fs.existsSync(pro)) {
      const proConfig = readJson(pro);
      const config = normalizeConfig({ feishu: { identity: proConfig.feishu?.identity || 'bot', image_text: proConfig.feishu?.image_text } });
      writeJsonAtomic(target, config);
      return { config, path: target, migrated: true, legacy_path: pro };
    }
  }
  return { config: null, path: target, migrated: false };
}

