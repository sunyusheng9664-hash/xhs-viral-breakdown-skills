const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

export function extractUrls(text) {
  const matches = String(text || '').match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/[^\s<>"'，。！？、；：（）【】《》]+/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/[，。！？、；：）】》〉,.!?)\]}>'"]+$/g, '')))];
}

function scanObject(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('window.__INITIAL_STATE__ 对象未闭合');
}

export function extractInitialStateText(html) {
  const marker = /window\.__INITIAL_STATE__\s*=\s*/g;
  const match = marker.exec(html);
  if (!match) throw new Error('页面未包含 window.__INITIAL_STATE__');
  const start = html.indexOf('{', match.index + match[0].length);
  if (start < 0) throw new Error('页面中的初始状态不是对象');
  return scanObject(html, start);
}

export function parseInitialState(html) {
  const raw = extractInitialStateText(html).replace(/:\s*undefined\s*(?=[,}])/g, ':null');
  return JSON.parse(raw);
}

function walk(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit, seen));
  else Object.values(value).forEach((item) => walk(item, visit, seen));
}

function idOf(value) {
  return String(value.noteId || value.note_id || value.id || value.note?.noteId || '');
}

function candidateScore(value, noteId) {
  let score = 0;
  if (noteId && idOf(value) === noteId) score += 8;
  if (value.title || value.displayTitle) score += 2;
  if (value.desc || value.description) score += 2;
  if (value.interactInfo || value.interact_info) score += 5;
  if (Array.isArray(value.imageList) || Array.isArray(value.image_list)) score += 5;
  if (value.video || value.mediaV2 || value.media_v2) score += 5;
  return score;
}

export function findNoteObject(state, noteId = '') {
  let best = null;
  let bestScore = 0;
  walk(state, (value) => {
    const score = candidateScore(value, noteId);
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  });
  if (!best || bestScore < 5) throw new Error('初始状态中未找到笔记对象');
  return best.note && typeof best.note === 'object' ? best.note : best;
}

export function parseCount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Number.isFinite(value)) return Math.trunc(value);
  const text = String(value).replace(/,/g, '').trim().replace(/\+$/, '');
  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*([万千kKmM]?)$/);
  if (!match) return null;
  const multiplier = { '': 1, 千: 1000, k: 1000, K: 1000, 万: 10000, m: 1000000, M: 1000000 }[match[2]];
  return Math.round(Number(match[1]) * multiplier);
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function firstUrl(value, seen = new Set()) {
  if (!value || seen.has(value)) return '';
  if (typeof value === 'string') return /^https?:\/\//.test(value) ? value.replace(/\\u002F/g, '/') : '';
  if (typeof value !== 'object') return '';
  seen.add(value);
  for (const key of ['urlDefault', 'url_default', 'masterUrl', 'master_url', 'url', 'src']) {
    const found = firstUrl(value[key], seen);
    if (found) return found;
  }
  for (const child of Object.values(value)) {
    const found = firstUrl(child, seen);
    if (found) return found;
  }
  return '';
}

export function parseMediaV2(value) {
  let current = value;
  for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { break; }
  }
  return current && typeof current === 'object' ? current : null;
}

export function findSubtitleUrl(media) {
  if (!media) return '';
  const candidates = [];
  walk(media, (value) => {
    for (const key of ['source', 'zh-CN', 'zh_CN', 'subtitles', 'subtitle']) {
      if (value[key]) candidates.push({ key, value: value[key] });
    }
  });
  const rank = (key) => ({ source: 0, 'zh-CN': 1, zh_CN: 1, subtitles: 10, subtitle: 10 }[key] ?? 20);
  candidates.sort((a, b) => rank(a.key) - rank(b.key));
  for (const candidate of candidates) {
    const url = firstUrl(candidate.value);
    if (url) return url;
  }
  return '';
}

export function srtToTranscript(srt) {
  return String(srt || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n\r?\n+/)
    .map((block) => block.split(/\r?\n/).filter((line) => line && !/^\d+$/.test(line) && !/-->/.test(line)).join(' '))
    .filter(Boolean)
    .join('\n');
}

function topicNames(note) {
  const list = first(note.tagList, note.tag_list, note.topics, note.topicList) || [];
  if (!Array.isArray(list)) return [];
  return list.map((item) => typeof item === 'string' ? item : first(item.name, item.title, item.tagName)).filter(Boolean);
}

function images(note) {
  const list = first(note.imageList, note.image_list, note.images) || [];
  if (!Array.isArray(list)) return [];
  return list.map((item) => firstUrl(item)).filter(Boolean);
}

function normalizeMetrics(note) {
  const info = first(note.interactInfo, note.interact_info, note.interaction) || {};
  return {
    liked: parseCount(first(info.likedCount, info.liked_count, info.likes, note.likedCount)),
    collected: parseCount(first(info.collectedCount, info.collected_count, info.collectCount, info.collects)),
    commented: parseCount(first(info.commentCount, info.comment_count, info.comments)),
    shared: parseCount(first(info.shareCount, info.share_count, info.shares)),
  };
}

export function noteIdFromUrl(url) {
  const match = String(url).match(/\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/);
  return match?.[1] || '';
}

export function profileIdFromUrl(url) {
  const match = String(url).match(/\/user\/profile\/([a-zA-Z0-9]+)/);
  return match?.[1] || '';
}

export function canonicalProfileUrl(url) {
  const profileId = profileIdFromUrl(url);
  return profileId ? `https://www.xiaohongshu.com/user/profile/${profileId}` : String(url || '');
}

function interactionCount(interactions, type) {
  const item = Array.isArray(interactions) ? interactions.find((entry) => entry?.type === type) : null;
  return parseCount(first(item?.count, item?.i18nCount));
}

function visibleProfileNotes(state, profileId) {
  const results = [];
  const seen = new Set();
  walk(state?.user?.notes || [], (value) => {
    const card = value?.noteCard || value?.note_card;
    if (!card || typeof card !== 'object') return;
    const noteId = idOf(card);
    const authorId = String(first(card.user?.userId, card.user?.user_id) || '');
    const sampleKey = noteId || `${first(card.displayTitle, card.title) || ''}:${first(card.interactInfo?.likedCount, card.interact_info?.liked_count) || ''}`;
    if (!sampleKey || seen.has(sampleKey) || (profileId && authorId && authorId !== profileId)) return;
    seen.add(sampleKey);
    const imageList = first(card.cover, card.imageList, card.image_list);
    const type = card.video || /video/i.test(String(first(card.type, card.noteType, card.note_type) || '')) ? 'video' : 'image_text';
    results.push({
      note_id: noteId,
      title: first(card.displayTitle, card.title) || '',
      type,
      liked_count: parseCount(first(card.interactInfo?.likedCount, card.interact_info?.liked_count)),
      cover_url: firstUrl(imageList),
      author_id: authorId,
    });
  });
  return results;
}

export function findUserPageData(state) {
  const direct = state?.user?.userPageData || state?.user?.user_page_data;
  if (direct?.basicInfo || direct?.basic_info) return direct;
  let best = null;
  walk(state, (value) => {
    const basic = value?.basicInfo || value?.basic_info;
    if (!best && basic && (basic.nickname || basic.redId || basic.red_id) && Array.isArray(value.interactions)) best = value;
  });
  if (!best) throw new Error('初始状态中未找到博主主页对象');
  return best;
}

export function normalizeBloggerProfile(state, { originalUrl, finalUrl }) {
  const profileId = profileIdFromUrl(finalUrl);
  const page = findUserPageData(state);
  const basic = first(page.basicInfo, page.basic_info) || {};
  const visibleNotes = visibleProfileNotes(state, profileId);
  const topVisibleNotes = [...visibleNotes].sort((a, b) => (b.liked_count ?? -1) - (a.liked_count ?? -1)).slice(0, 3);
  return {
    status: 'success',
    type: 'blogger_profile',
    original_url: originalUrl,
    final_url: finalUrl,
    profile_id: profileId,
    note_id: '',
    data: {
      user_id: profileId,
      canonical_profile_url: canonicalProfileUrl(finalUrl),
      nickname: first(basic.nickname, basic.nickName) || '',
      red_id: first(basic.redId, basic.red_id) || '',
      description: first(basic.desc, basic.description) || '',
      avatar_url: first(basic.imageb, basic.images, basic.avatar) || '',
      following_count: interactionCount(page.interactions, 'follows'),
      follower_count: interactionCount(page.interactions, 'fans'),
      total_likes_collects: interactionCount(page.interactions, 'interaction'),
      visible_note_count: visibleNotes.length,
      visible_notes: visibleNotes,
      top_visible_notes: topVisibleNotes,
    },
    analysis: {},
  };
}

export function normalizeNote(note, { originalUrl, finalUrl, noteId, transcript = '', subtitleUrl = '' }) {
  const media = parseMediaV2(first(note.mediaV2, note.media_v2, note.video?.mediaV2, note.video?.media_v2));
  const imageUrls = images(note);
  const isVideo = Boolean(note.video || media || /video/i.test(String(first(note.type, note.noteType, note.note_type) || '')));
  const duration = first(note.video?.duration, media?.video?.duration, media?.duration);
  return {
    status: 'success',
    type: isVideo ? 'video' : 'image_text',
    original_url: originalUrl,
    final_url: finalUrl,
    note_id: noteId || idOf(note) || noteIdFromUrl(finalUrl),
    data: {
      title: first(note.title, note.displayTitle) || '',
      description: first(note.desc, note.description) || '',
      author: first(note.user?.nickname, note.user?.nickName, note.user?.name, note.author?.nickname, note.nickname) || '',
      author_id: String(first(note.user?.userId, note.user?.user_id, note.author?.userId, note.author?.user_id) || ''),
      topics: topicNames(note),
      cover_url: imageUrls[0] || firstUrl(note.cover) || firstUrl(note.video?.image) || firstUrl(media),
      image_urls: imageUrls,
      duration_seconds: Number.isFinite(Number(duration)) ? Number(duration) / (Number(duration) > 10000 ? 1000 : 1) : null,
      metrics: normalizeMetrics(note),
      subtitle_url: subtitleUrl,
      transcript: transcript || '',
    },
    analysis: {},
  };
}

export async function fetchPage(url, fetchImpl = fetch) {
  const attempts = [];
  for (const [mode, userAgent] of [['desktop', DESKTOP_UA], ['mobile', MOBILE_UA]]) {
    try {
      const response = await fetchImpl(url, { redirect: 'follow', headers: { 'user-agent': userAgent, accept: 'text/html,*/*' } });
      const html = await response.text();
      attempts.push({ mode, status: response.status, final_url: response.url });
      if (response.ok && html.includes('window.__INITIAL_STATE__')) return { html, finalUrl: response.url, attempts };
    } catch (error) {
      attempts.push({ mode, error: error.message });
    }
  }
  throw new Error(`无法读取公开页面：${JSON.stringify(attempts)}`);
}

async function downloadSubtitle(url, referer, fetchImpl = fetch) {
  if (!url) return '';
  const response = await fetchImpl(url, { headers: { 'user-agent': DESKTOP_UA, referer: referer || 'https://www.xiaohongshu.com/' } });
  if (!response.ok) throw new Error(`字幕下载失败 HTTP ${response.status}`);
  return response.text();
}

export async function extractOne(originalUrl, fetchImpl = fetch) {
  let finalUrl = '';
  try {
    const page = await fetchPage(originalUrl, fetchImpl);
    finalUrl = page.finalUrl;
    const state = parseInitialState(page.html);
    if (profileIdFromUrl(finalUrl)) {
      return normalizeBloggerProfile(state, { originalUrl, finalUrl });
    }
    const noteId = noteIdFromUrl(finalUrl);
    const note = findNoteObject(state, noteId);
    const media = parseMediaV2(first(note.mediaV2, note.media_v2, note.video?.mediaV2, note.video?.media_v2));
    const subtitleUrl = findSubtitleUrl(media);
    let transcript = '';
    let subtitleError = '';
    if (subtitleUrl) {
      try { transcript = srtToTranscript(await downloadSubtitle(subtitleUrl, finalUrl, fetchImpl)); }
      catch (error) { subtitleError = error.message; }
    }
    const item = normalizeNote(note, { originalUrl, finalUrl, noteId, transcript, subtitleUrl });
    if (item.type === 'video' && !transcript) item.data.transcript = '未获取字幕';
    if (subtitleError) item.limitations = [subtitleError];
    return item;
  } catch (error) {
    return { status: 'failed', original_url: originalUrl, final_url: finalUrl, stage: finalUrl ? 'parse' : 'fetch', reason: error.message };
  }
}
