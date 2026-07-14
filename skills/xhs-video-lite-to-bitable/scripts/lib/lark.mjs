import { spawnSync } from 'node:child_process';

function executable(name) {
  return process.platform === 'win32' && name === 'npx' ? 'npx.cmd' : name;
}

function run(command, args, options = {}) {
  const { env: extraEnv = {}, ...spawnOptions } = options;
  return spawnSync(executable(command), args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
      ...extraEnv,
    },
    ...spawnOptions,
  });
}

export function discoverLark() {
  for (const command of ['lark-cli', 'npx']) {
    const args = command === 'npx' ? ['-y', '@larksuite/cli', '--version'] : ['--version'];
    const result = run(command, args);
    if (result.status === 0) return { command: executable(command), prefix: command === 'npx' ? ['-y', '@larksuite/cli'] : [], version: result.stdout.trim() };
  }
  return null;
}

export function parseJsonOutput(output) {
  const text = String(output || '').trim();
  try { return JSON.parse(text); } catch {}
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error(`飞书 CLI 未返回 JSON：${text.slice(0, 300)}`);
}

export function inspectLarkAuth(found, identity = 'bot') {
  if (!found) return { ready: false, identity, reason: '未找到飞书 CLI' };
  const result = run(found.command, [...found.prefix, 'auth', 'status', '--json', '--verify']);
  if (result.status !== 0) {
    return { ready: false, identity, reason: (result.stderr || result.stdout || `退出码 ${result.status}`).trim() };
  }
  try {
    const data = parseJsonOutput(result.stdout);
    const selected = data?.identities?.[identity];
    const ready = Boolean(selected?.verified === true || (selected?.available === true && selected?.status === 'ready'));
    return {
      ready,
      identity,
      status: selected?.status || 'unknown',
      verified: Boolean(selected?.verified),
      reason: ready ? null : (selected?.message || `飞书 ${identity} 身份未就绪`),
    };
  } catch (error) {
    return { ready: false, identity, reason: error.message };
  }
}

export function runLark(args, { allowFailure = false } = {}) {
  const found = discoverLark();
  if (!found) throw new Error('未找到飞书 CLI；请安装 Node.js 后运行 npx -y @larksuite/cli auth login');
  const result = run(found.command, [...found.prefix, ...args]);
  if (result.status !== 0 && !allowFailure) throw new Error((result.stderr || result.stdout || `飞书 CLI 退出码 ${result.status}`).trim());
  return { ...result, json: result.status === 0 ? parseJsonOutput(result.stdout) : null };
}

function collectByKey(value, keys, found = {}) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && child && !found[key]) found[key] = child;
    collectByKey(child, keys, found);
  }
  return found;
}

export function createBase({ name, fields, identity = 'bot', timezone = 'Asia/Shanghai', tableName = '内容拆解库' }) {
  const result = runLark(['base', '+base-create', '--as', identity, '--name', name, '--time-zone', timezone, '--table-name', tableName, '--fields', JSON.stringify(fields), '--format', 'json']);
  const ids = collectByKey(result.json, ['base_token', 'app_token', 'table_id', 'default_view_id', 'view_id', 'url']);
  const data = result.json?.data || result.json;
  const baseToken = data?.base?.base_token || ids.base_token || ids.app_token;
  const tableId = data?.table?.id || ids.table_id;
  if (!baseToken || !tableId) throw new Error(`创建飞书库成功但无法识别返回标识：${JSON.stringify(result.json)}`);
  let viewId = data?.table?.views?.[0]?.id || ids.default_view_id || ids.view_id;
  if (!viewId) {
    const views = runLark(['base', '+view-list', '--as', identity, '--base-token', String(baseToken), '--table-id', String(tableId), '--format', 'json']);
    viewId = collectByKey(views.json, ['view_id']).view_id;
  }
  if (!viewId) throw new Error('无法识别新建表格的 View ID');
  return {
    base_name: name,
    base_token: String(baseToken),
    base_url: data?.base?.url || ids.url || `https://my.feishu.cn/base/${baseToken}`,
    table_name: tableName,
    table_id: String(tableId),
    view_id: String(viewId),
    permission_grant: data?.permission_grant || result.json.permission_grant || null,
  };
}

export function listRecords(binding, identity) {
  const pages = [];
  let offset = 0;
  for (let page = 0; page < 100; page += 1) {
    const result = runLark(['base', '+record-list', '--as', identity, '--base-token', binding.base_token, '--table-id', binding.table_id, '--field-id', '链接', '--offset', String(offset), '--limit', '200', '--format', 'json']).json;
    pages.push(result);
    const data = result?.data;
    const count = Array.isArray(data?.data) ? data.data.length : 0;
    if (!data?.has_more || count === 0) break;
    offset += count;
  }
  return pages;
}

export function batchCreate(binding, identity, fields, rows) {
  return runLark(['base', '+record-batch-create', '--as', identity, '--base-token', binding.base_token, '--table-id', binding.table_id, '--json', JSON.stringify({ fields, rows }), '--format', 'json']).json;
}

export function setVisibleFields(binding, identity, fields) {
  return runLark(['base', '+view-set-visible-fields', '--as', identity, '--base-token', binding.base_token, '--table-id', binding.table_id, '--view-id', binding.view_id, '--json', JSON.stringify({ visible_fields: fields }), '--format', 'json']).json;
}

export function valuesAsStrings(value, result = []) {
  if (typeof value === 'string') {
    result.push(value);
    for (const match of value.match(/https?:\/\/[^\s)\]]+/g) || []) result.push(match);
  }
  else if (Array.isArray(value)) value.forEach((item) => valuesAsStrings(item, result));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => valuesAsStrings(item, result));
  return result;
}
