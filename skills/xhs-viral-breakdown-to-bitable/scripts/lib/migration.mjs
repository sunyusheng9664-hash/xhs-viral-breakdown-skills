export const DATA_SCHEMA_VERSION = 2;

export const ARCHIVE_STATUS_OPTIONS = [
  '成功', '部分成功', '待处理', '源笔记不可访问', '短链失效',
  '抓取受限', '抓取失败', '图片下载失败', '附件上传失败', '无图片',
];

const COMMON_FIELDS = [
  { name: '笔记ID', type: 'text', description: '稳定识别笔记，用于去重和历史图片修复' },
  {
    name: '图片归档状态', type: 'select', multiple: false,
    options: ARCHIVE_STATUS_OPTIONS.map((name) => ({ name })),
  },
  { name: '归档错误', type: 'text', description: '保留最近一次图片归档失败原因' },
  { name: '最后归档时间', type: 'datetime', style: { format: 'yyyy-MM-dd HH:mm' } },
];

export const MIGRATION_FIELDS = {
  image_text: [
    { name: '封面图片', type: 'attachment', description: '首图附件，便于表格预览' },
    { name: '图片附件', type: 'attachment', description: '按原顺序保存全部图片，包含首图' },
    ...COMMON_FIELDS,
  ],
  video: [
    { name: '封面图片', type: 'attachment', description: '视频封面附件' },
    ...COMMON_FIELDS,
  ],
};

export function fieldName(field) {
  return String(field?.name || field?.field_name || field?.fieldName || '');
}

export function collectObjects(value, predicate, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (predicate(value)) result.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectObjects(item, predicate, result));
  else Object.values(value).forEach((item) => collectObjects(item, predicate, result));
  return result;
}

export function fieldObjects(value) {
  const seen = new Set();
  return collectObjects(value, (item) => Boolean(fieldName(item)) && Boolean(item.id || item.field_id || item.type))
    .filter((item) => {
      const key = item.id || item.field_id || fieldName(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function recordObjects(value) {
  const seen = new Set();
  return collectObjects(value, (item) => Boolean(item.record_id || item.recordId) && item.fields && typeof item.fields === 'object')
    .filter((item) => {
      const key = item.record_id || item.recordId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function collectRecordIds(value) {
  const ids = collectObjects(value, (item) => Boolean(item.record_id || item.recordId))
    .map((item) => String(item.record_id || item.recordId));
  return [...new Set(ids)];
}

function strings(value, result = []) {
  if (typeof value === 'string') result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, result));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => strings(item, result));
  return result;
}

export function visibleFieldNames(value) {
  const candidates = value?.data?.visible_fields || value?.visible_fields || value?.data?.fields || value?.fields;
  return [...new Set(strings(candidates).filter(Boolean))];
}

export function buildMigrationPlan(type, fieldResponse, visibleResponse) {
  const objects = fieldObjects(fieldResponse);
  const existingFields = objects.map(fieldName);
  const existing = new Set(existingFields);
  const missingFields = MIGRATION_FIELDS[type].filter((field) => !existing.has(field.name));
  const beforeVisible = visibleFieldNames(visibleResponse);
  const hiddenLegacy = type === 'image_text' ? new Set(['封面', '图片']) : new Set(['封面']);
  const hiddenIdentifiers = new Set([...hiddenLegacy]);
  for (const field of objects) {
    if (hiddenLegacy.has(fieldName(field))) hiddenIdentifiers.add(String(field.id || field.field_id || ''));
  }
  const addedVisible = MIGRATION_FIELDS[type].map((field) => field.name);
  const afterVisible = [...new Set([...beforeVisible.filter((name) => !hiddenIdentifiers.has(name)), ...addedVisible])];
  return {
    type,
    existing_fields: existingFields,
    missing_fields: missingFields,
    visible_fields_before: beforeVisible,
    visible_fields_after: afterVisible,
    hidden_legacy_fields: beforeVisible.filter((name) => hiddenIdentifiers.has(name)),
  };
}

export function classifyRepairFailure(item) {
  const reason = String(item?.reason || item?.error || '');
  const original = String(item?.original_url || '');
  const finalUrl = String(item?.final_url || '');
  if (/验证码|captcha|风控|登录|login|403|429|频繁|限制访问/i.test(reason)) return '抓取受限';
  if (/已删除|删除|私密|无权限|not found|不存在/i.test(reason)) return '源笔记不可访问';
  if (/xhslink\.com/i.test(original) && !finalUrl && /无法读取|跳转|短链|404/i.test(reason)) return '短链失效';
  return '抓取失败';
}

export function recordField(record, name) {
  const value = record?.fields?.[name];
  if (typeof value === 'string') return value;
  return strings(value)[0] || '';
}
