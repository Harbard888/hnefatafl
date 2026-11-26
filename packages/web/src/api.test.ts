import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createGame, createOnlineGame, fetchOnlineGame, joinOnlineGame, playMove, playOnlineMove } from './api';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('posts JSON bodies to the right endpoints', async () => {
    const fetchMock = mockFetch(201, { id: 'g1' });
    await createGame({ mode: 'two-player', variant: 'tablut' });
    await playMove('g1', { row: 0, col: 3 }, { row: 0, col: 2 });
    const [create, move] = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(create[0]).toBe('/api/games');
    expect(JSON.parse(create[1].body as string)).toEqual({ mode: 'two-player', variant: 'tablut' });
    expect(move[0]).toBe('/api/games/g1/moves');
    expect(JSON.parse(move[1].body as string)).toEqual({ from: { row: 0, col: 3 }, to: { row: 0, col: 2 } });
  });

  it('sends the player token header only when given and encodes the game code', async () => {
    const fetchMock = mockFetch(200, {});
    await fetchOnlineGame('A/B 2', 'secret');
    await joinOnlineGame('ABC234');
    await createOnlineGame('random');
    await playOnlineMove('ABC234', 'tok', { row: 0, col: 3 }, { row: 0, col: 2 });
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe('/api/online/games/A%2FB%202');
    expect((calls[0][1].headers as Record<string, string>)['X-Player-Token']).toBe('secret');
    expect(calls[1][1].headers).not.toHaveProperty('X-Player-Token');
    expect(JSON.parse(calls[2][1].body as string)).toEqual({ side: 'random', variant: 'copenhagen' });
    expect((calls[3][1].headers as Record<string, string>)['X-Player-Token']).toBe('tok');
  });

  it('throws ApiError carrying the status and server message', async () => {
    mockFetch(409, { error: 'game is already full' });
    await expect(joinOnlineGame('ABC234')).rejects.toMatchObject({ name: 'ApiError', status: 409, message: 'game is already full' });
  });

  it('falls back to the HTTP status when the error body has no message', async () => {
    mockFetch(500, {});
    const error = await createGame({ mode: 'two-player' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('HTTP 500');
  });
});
