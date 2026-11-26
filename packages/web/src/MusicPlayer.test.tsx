// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translator } from './i18n';
import { MusicPlayer } from './MusicPlayer';
import { DEFAULT_VOLUME, PLAYLIST_STORAGE_KEY, VOLUME_STORAGE_KEY } from './music';

const t = translator('en');

interface FakePlayer {
  opts: { playerVars: Record<string, unknown>; events: { onReady(): void; onStateChange(e: { data: number }): void; onError(): void } };
  playVideo: ReturnType<typeof vi.fn>;
  pauseVideo: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setLoop: ReturnType<typeof vi.fn>;
  loadPlaylist: ReturnType<typeof vi.fn>;
  loadVideoById: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

let players: FakePlayer[];

beforeEach(() => {
  window.localStorage.clear();
  players = [];
  const Player = function (this: FakePlayer, _el: HTMLElement, opts: FakePlayer['opts']) {
    Object.assign(this, {
      opts,
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      setVolume: vi.fn(),
      setLoop: vi.fn(),
      loadPlaylist: vi.fn(),
      loadVideoById: vi.fn(),
      destroy: vi.fn(),
    });
    players.push(this);
    queueMicrotask(() => opts.events.onReady());
  } as unknown as new (el: HTMLElement, opts: Record<string, unknown>) => FakePlayer;
  window.YT = { Player, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } } as unknown as Window['YT'];
});
afterEach(() => {
  cleanup();
  delete window.YT;
});

describe('MusicPlayer', () => {
  it('creates the player on first play with the stored volume and the default playlist, then toggles pause', async () => {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, '70');
    const user = userEvent.setup();
    render(<MusicPlayer t={t} />);
    expect(players).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Play music/ }));
    await waitFor(() => expect(players[0]?.playVideo).toHaveBeenCalled());
    const [player] = players;
    expect(player.setVolume).toHaveBeenCalledWith(70);
    expect(player.setLoop).toHaveBeenCalledWith(true);
    expect(player.opts.playerVars).toMatchObject({ listType: 'playlist', list: 'PLfBULhdsahtM' });

    act(() => player.opts.events.onStateChange({ data: 1 }));
    const pause = screen.getByRole('button', { name: /Pause/ });
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    await user.click(pause);
    expect(player.pauseVideo).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Play music/ })).toBeTruthy();
  });

  it('starts on the first user interaction only once', async () => {
    const user = userEvent.setup();
    render(<MusicPlayer t={t} />);
    await user.keyboard('a');
    await waitFor(() => expect(players).toHaveLength(1));
    await user.keyboard('b');
    await user.click(document.body);
    expect(players).toHaveLength(1);
  });

  it('persists and applies the volume, falling back to the default without storage', async () => {
    const user = userEvent.setup();
    render(<MusicPlayer t={t} />);
    const slider = screen.getByLabelText(/Volume/) as HTMLInputElement;
    expect(slider.value).toBe(String(DEFAULT_VOLUME));

    await user.click(screen.getByRole('button', { name: /Play music/ }));
    await waitFor(() => expect(players[0]?.setVolume).toHaveBeenCalled());
    fireEvent.change(slider, { target: { value: '15' } });
    expect(players[0].setVolume).toHaveBeenLastCalledWith(15);
    expect(window.localStorage.getItem(VOLUME_STORAGE_KEY)).toBe('15');
  });

  it('rejects non-YouTube links and keeps the old playlist', async () => {
    const user = userEvent.setup();
    render(<MusicPlayer t={t} />);
    await user.click(screen.getByRole('button', { name: 'Change playlist' }));
    const input = screen.getByLabelText(t('musicUrlLabel'));
    await user.clear(input);
    await user.type(input, 'https://example.com/x');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect((await screen.findByRole('alert')).textContent).toBe(t('musicInvalid'));
    expect(window.localStorage.getItem(PLAYLIST_STORAGE_KEY)).toBeNull();
  });

  it('loads a new playlist into the running player and remembers it', async () => {
    const user = userEvent.setup();
    render(<MusicPlayer t={t} />);
    await user.click(screen.getByRole('button', { name: /Play music/ }));
    await waitFor(() => expect(players[0]?.playVideo).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Change playlist' }));
    const input = screen.getByLabelText(t('musicUrlLabel'));
    await user.clear(input);
    await user.type(input, 'https://www.youtube.com/playlist?list=PLnew123');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(players[0].loadPlaylist).toHaveBeenCalledWith({ list: 'PLnew123', listType: 'playlist' });
    expect(window.localStorage.getItem(PLAYLIST_STORAGE_KEY)).toBe('https://www.youtube.com/playlist?list=PLnew123');
    expect(screen.queryByLabelText(t('musicUrlLabel'))).toBeNull();
  });

  it('uses a stored single video in a loop and shows a load error from the player', async () => {
    window.localStorage.setItem(PLAYLIST_STORAGE_KEY, 'https://youtu.be/VYEqT0enZe4');
    const user = userEvent.setup();
    render(<MusicPlayer t={t} />);
    await user.click(screen.getByRole('button', { name: /Play music/ }));
    await waitFor(() => expect(players[0]).toBeDefined());
    expect(players[0].opts.playerVars).toMatchObject({ loop: 1, playlist: 'VYEqT0enZe4' });

    act(() => players[0].opts.events.onError());
    expect((await screen.findByRole('alert')).textContent).toBe(t('musicLoadError'));
  });

  it('shows a load error when the YouTube API script fails', async () => {
    delete window.YT;
    const user = userEvent.setup();
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      queueMicrotask(() => (node as HTMLScriptElement).onerror?.(new Event('error')));
      return node;
    });
    render(<MusicPlayer t={t} />);
    await user.click(screen.getByRole('button', { name: /Play music/ }));
    expect((await screen.findByRole('alert')).textContent).toBe(t('musicLoadError'));
    append.mockRestore();
  });

  it('destroys the player on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MusicPlayer t={t} />);
    await user.click(screen.getByRole('button', { name: /Play music/ }));
    await waitFor(() => expect(players[0]?.playVideo).toHaveBeenCalled());
    unmount();
    expect(players[0].destroy).toHaveBeenCalled();
  });
});
