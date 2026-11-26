// Replace to change the default background playlist (any YouTube playlist or video URL).
export const DEFAULT_PLAYLIST_URL =
  'https://www.youtube.com/watch?v=VYEqT0enZe4&list=PLfBULhdsahtM&pp=sAgC';

export const PLAYLIST_STORAGE_KEY = 'hnefatafl.music.playlist';
export const VOLUME_STORAGE_KEY = 'hnefatafl.music.volume';
export const DEFAULT_VOLUME = 40;

export type MusicSource = { list?: string; video?: string };

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Extracts a playlist and/or video id from a YouTube URL. Returns null if not a YouTube link. */
export function parseYouTubeSource(input: string): MusicSource | null {
  const text = input.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const list = url.searchParams.get('list');
  let video = url.searchParams.get('v');
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname.toLowerCase() === 'youtu.be') video = parts[0] ?? null;
  else if (!video && (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live')) {
    video = parts[1] ?? null;
  }

  const source: MusicSource = {};
  if (list && ID_PATTERN.test(list)) source.list = list;
  if (video && ID_PATTERN.test(video)) source.video = video;
  return source.list || source.video ? source : null;
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function loadVolume(storage: Pick<Storage, 'getItem'> | undefined): number {
  const raw = storage?.getItem(VOLUME_STORAGE_KEY);
  return raw == null || raw === '' ? DEFAULT_VOLUME : clampVolume(Number(raw));
}
