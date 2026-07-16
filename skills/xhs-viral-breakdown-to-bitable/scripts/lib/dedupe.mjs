export function identities(item) {
  return [item?.note_id, item?.profile_id, item?.data?.user_id, item?.data?.canonical_profile_url, item?.original_url, item?.final_url]
    .filter(Boolean)
    .map(String);
}

export function selectPending(items, knownValues = []) {
  const seen = knownValues instanceof Set ? knownValues : new Set(knownValues);
  const pending = [];
  let duplicates = 0;

  for (const item of items) {
    const ids = identities(item);
    if (ids.some((id) => seen.has(id))) {
      duplicates += 1;
      continue;
    }
    pending.push(item);
    ids.forEach((id) => seen.add(id));
  }

  return { pending, duplicates, seen };
}
