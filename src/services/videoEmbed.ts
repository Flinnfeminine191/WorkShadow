/** 将常见视频网站页面 URL 转为可嵌入地址；直链视频文件返回 null；其它 https 页面默认用原 URL 作 iframe。 */

const BVID_RE = /BV[a-zA-Z0-9]+/;
const YT_WATCH = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?#]|$)/;

export type VideoEmbedResolution = { embedSrc: string } | { embedSrc: null };

function looksLikeDirectVideoFile(url: string): boolean {
  try {
    return /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i.test(new URL(url).pathname);
  } catch {
    return /\.(mp4|webm|ogg|mov|m4v|mkv|avi)(\?|#|$)/i.test(url);
  }
}

export function resolveVideoEmbed(url: string): VideoEmbedResolution {
  const trimmed = url.trim();
  if (!trimmed) return { embedSrc: null };

  if (/bilibili\.com/i.test(trimmed)) {
    const m = trimmed.match(BVID_RE);
    if (m) {
      const bvid = m[0];
      return {
        embedSrc: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&high_quality=1&danmaku=0`
      };
    }
  }

  const yt = trimmed.match(YT_WATCH);
  if (yt?.[1]) {
    return { embedSrc: `https://www.youtube.com/embed/${encodeURIComponent(yt[1])}` };
  }

  /** B 站、YouTube 以外：默认用原 URL 作网页 iframe */
  if (/^https?:\/\//i.test(trimmed) && !looksLikeDirectVideoFile(trimmed)) {
    return { embedSrc: trimmed };
  }

  return { embedSrc: null };
}
