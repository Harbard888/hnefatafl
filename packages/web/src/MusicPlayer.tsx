import { useCallback, useEffect, useRef, useState } from 'react';
import type { Translate } from './i18n';
import {
  DEFAULT_PLAYLIST_URL,
  PLAYLIST_STORAGE_KEY,
  VOLUME_STORAGE_KEY,
  loadVolume,
  parseYouTubeSource,
  type MusicSource,
} from './music';

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(v: number): void;
  setLoop(loop: boolean): void;
  loadPlaylist(opts: { list: string; listType: 'playlist'; index?: number }): void;
  loadVideoById(id: string): void;
  destroy(): void;
};

type YTApi = {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTApi> | undefined;

function loadYouTubeApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = undefined;
      script.remove();
      reject(new Error('YouTube API failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

function readStoredUrl(): string {
  try {
    return localStorage.getItem(PLAYLIST_STORAGE_KEY) || DEFAULT_PLAYLIST_URL;
  } catch {
    return DEFAULT_PLAYLIST_URL;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable; settings just won't persist
  }
}

export function MusicPlayer({ t }: { t: Translate }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const sourceRef = useRef<MusicSource | null>(parseYouTubeSource(readStoredUrl()));
  const [playing, setPlaying] = useState(false);
  const wantPlayRef = useRef(false);
  const [volume, setVolume] = useState(() => loadVolume(safeStorage()));
  const volumeRef = useRef(volume);
  const [url, setUrl] = useState(readStoredUrl);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<'load' | 'invalid' | null>(null);

  const loadSource = useCallback((player: YTPlayer, source: MusicSource) => {
    if (source.list) {
      player.loadPlaylist({ list: source.list, listType: 'playlist' });
    } else if (source.video) {
      player.loadVideoById(source.video);
    }
  }, []);

  const ensurePlayer = useCallback(async (): Promise<YTPlayer | null> => {
    if (playerRef.current) return playerRef.current;
    const source = sourceRef.current;
    if (!source || !hostRef.current) {
      setError('invalid');
      return null;
    }
    try {
      const YT = await loadYouTubeApi();
      if (playerRef.current) return playerRef.current;
      const mount = document.createElement('div');
      hostRef.current.replaceChildren(mount);
      return await new Promise<YTPlayer>((resolve) => {
        const player = new YT.Player(mount, {
          width: 200,
          height: 112,
          playerVars: {
            ...(source.list ? { listType: 'playlist', list: source.list } : { loop: 1, playlist: source.video }),
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              playerRef.current = player;
              player.setVolume(volumeRef.current);
              if (source.list) player.setLoop(true);
              if (wantPlayRef.current) player.playVideo();
              resolve(player);
            },
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                setError(null);
              } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                setPlaying(false);
              }
            },
            onError: () => {
              setPlaying(false);
              setError('load');
            },
          },
        });
      });
    } catch {
      setError('load');
      return null;
    }
  }, []);

  const play = useCallback(async () => {
    wantPlayRef.current = true;
    setError(null);
    const player = await ensurePlayer();
    player?.playVideo();
  }, [ensurePlayer]);

  const toggle = useCallback(async () => {
    if (playing) {
      wantPlayRef.current = false;
      playerRef.current?.pauseVideo();
      setPlaying(false);
    } else {
      await play();
    }
  }, [playing, play]);

  // Browsers block autoplay with sound, so start on the first user interaction.
  useEffect(() => {
    const start = () => {
      if (!wantPlayRef.current && !playerRef.current) void play();
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      cleanup();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [play]);

  const onVolume = (value: number) => {
    volumeRef.current = value;
    setVolume(value);
    store(VOLUME_STORAGE_KEY, String(value));
    playerRef.current?.setVolume(value);
  };

  const submitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const source = parseYouTubeSource(url);
    if (!source) {
      setError('invalid');
      return;
    }
    sourceRef.current = source;
    store(PLAYLIST_STORAGE_KEY, url.trim());
    setEditing(false);
    setError(null);
    wantPlayRef.current = true;
    const player = playerRef.current;
    if (player) {
      loadSource(player, source);
      player.setLoop(true);
    } else {
      void play();
    }
  };

  return (
    <section className="music" aria-label={t('musicTitle')}>
      <button type="button" onClick={toggle} aria-pressed={playing}>
        {playing ? `⏸ ${t('musicPause')}` : `▶ ${t('musicPlay')}`}
      </button>
      <label className="music-volume">
        {t('musicVolume')}{' '}
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </label>
      <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
        {t('musicChange')}
      </button>
      {editing && (
        <form className="music-form" onSubmit={submitUrl}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('musicUrlPlaceholder')}
            aria-label={t('musicUrlLabel')}
          />
          <button type="submit">{t('musicApply')}</button>
        </form>
      )}
      {error && (
        <span className="music-error" role="alert">
          {error === 'invalid' ? t('musicInvalid') : t('musicLoadError')}
        </span>
      )}
      <div ref={hostRef} className="music-host" aria-hidden="true" />
    </section>
  );
}

function safeStorage(): Pick<Storage, 'getItem'> | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}
