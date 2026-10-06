/** Read duration only from the requested video's main player details, never an ad or title. */
export function youtubeDurationFromHtml(html: string, videoId: string): { seconds: number; duration: string } | null {
  if (!/^[\w-]{11}$/.test(videoId)) return null;
  const marker = /(?:var\s+)?ytInitialPlayerResponse\s*=\s*/.exec(html);
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  if (html[start] !== '{') return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < Math.min(html.length, start + 4 * 1024 * 1024); i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try {
        const player = JSON.parse(html.slice(start, i + 1));
        const details = player.videoDetails;
        if (!(typeof details?.lengthSeconds === 'number' || (typeof details?.lengthSeconds === 'string' && /^\d+$/.test(details.lengthSeconds)))) return null;
        const seconds = Number(details?.lengthSeconds);
        if (details?.videoId !== videoId || details.isLive === true || player.playabilityStatus?.status !== 'OK' || !Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 7 * 86400) return null;
        const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), remainder = seconds % 60;
        return { seconds, duration: [hours ? `${hours} ชั่วโมง` : '', minutes ? `${minutes} นาที` : '', remainder ? `${remainder} วินาที` : ''].filter(Boolean).join(' ') };
      } catch { return null; }
    }
  }
  return null;
}
