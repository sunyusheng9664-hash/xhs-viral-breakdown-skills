import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

function extension(contentType, url) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
}

export async function downloadFreshMedia(item, outputDir, fetchImpl = fetch) {
  fs.mkdirSync(outputDir, { recursive: true });
  const urls = item.type === 'video'
    ? [item.data?.cover_url].filter(Boolean)
    : (item.data?.image_urls || []).filter(Boolean);
  const files = [];
  const errors = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      const response = await fetchImpl(url, {
        redirect: 'follow',
        headers: { 'user-agent': UA, referer: item.final_url || 'https://www.xiaohongshu.com/' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ext = extension(response.headers?.get?.('content-type'), url);
      const name = item.type === 'video' ? `01_封面${ext}` : `${String(index + 1).padStart(2, '0')}${index === 0 ? '_封面' : ''}${ext}`;
      const file = path.join(outputDir, name);
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      files.push(file);
    } catch (error) {
      errors.push({ index: index + 1, url, reason: error.message });
    }
  }
  return { expected: urls.length, files, errors };
}
