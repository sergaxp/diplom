/** Detects link type and extracts a thumbnail when possible. Returns null on invalid URL. */
export interface LinkInfo {
  url: string;
  type: 'image' | 'video' | 'page';
  thumbnailUrl?: string;
  title?: string;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;
const YT_RE    = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(\d+)/;

export function parseLink(raw: string): LinkInfo | null {
  const url = raw.trim();
  if (!url) return null;
  try { new URL(url); } catch { return null; }

  // YouTube
  const yt = url.match(YT_RE);
  if (yt) {
    return {
      url,
      type: 'video',
      thumbnailUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
      title: 'YouTube',
    };
  }

  // Vimeo (no public thumbnail without API; show as page)
  const vm = url.match(VIMEO_RE);
  if (vm) {
    return { url, type: 'video', title: 'Vimeo' };
  }

  // Direct image
  if (IMAGE_RE.test(url)) {
    return { url, type: 'image', thumbnailUrl: url };
  }

  return { url, type: 'page', title: new URL(url).hostname };
}
