export function extractionOutcome(items = []) {
  const succeeded = items.filter((item) => item?.status === 'success').length;
  return { ok: succeeded > 0, succeeded, failed: items.length - succeeded };
}
