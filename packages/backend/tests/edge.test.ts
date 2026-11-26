import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { GAME_TTL_MS, OnlineError, OnlineStore } from '../src/online.js';

// Shortest Brandubh game: the attackers capture the king on the fifth move.
const BRANDUBH_KING_CAPTURE: [number, number, number, number][] = [
  [0, 3, 0, 2], [2, 3, 2, 2], [1, 3, 1, 4], [3, 3, 1, 3], [0, 2, 1, 2],
];
const step = ([fr, fc, tr, tc]: number[]) => ({ from: { row: fr, col: fc }, to: { row: tr, col: tc } });
const from = { row: 0, col: 3 };
const to = { row: 0, col: 2 };

describe('finished games', () => {
  it('refuses further moves with 409 and lists no legal moves', async () => {
    const app = createApp();
    const { body: game } = await request(app).post('/api/games').send({ variant: 'brandubh' });
    let last = game;
    for (const m of BRANDUBH_KING_CAPTURE) {
      const res = await request(app).post(`/api/games/${game.id}/moves`).send(step(m));
      expect(res.status).toBe(200);
      last = res.body;
    }
    expect(last.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });
    expect(last.legalMoves).toEqual([]);
    const again = await request(app).post(`/api/games/${game.id}/moves`).send(step([0, 0, 0, 1]));
    expect(again.status).toBe(409);
  });

  it('refuses online moves after the game is over', async () => {
    const app = createApp();
    const created = await request(app).post('/api/online/games').send({ side: 'attacker', variant: 'brandubh' });
    const code = created.body.view.code as string;
    const a = created.body.token as string;
    const d = (await request(app).post(`/api/online/games/${code}/join`)).body.token as string;
    const tokens = { attacker: a, defender: d };
    const sides = ['attacker', 'defender'] as const;

    let last = created.body.view;
    for (const [i, m] of BRANDUBH_KING_CAPTURE.entries()) {
      const res = await request(app)
        .post(`/api/online/games/${code}/moves`)
        .set('X-Player-Token', tokens[sides[i % 2]])
        .send(step(m));
      expect(res.status).toBe(200);
      last = res.body;
    }
    expect(last.status.kind).toBe('won');

    const late = await request(app).post(`/api/online/games/${code}/moves`).set('X-Player-Token', d).send(step([2, 2, 2, 1]));
    expect(late.status).toBe(409);
    const view = await request(app).get(`/api/online/games/${code}`).set('X-Player-Token', d);
    expect(view.body.legalMoves).toEqual([]);
    expect(view.body.moves).toHaveLength(5);
  });
});

describe('request validation', () => {
  it('returns 404 for moves on an unknown game, after validating the body', async () => {
    const app = createApp();
    expect((await request(app).post('/api/games/nope/moves').send({ from, to })).status).toBe(404);
    expect((await request(app).post('/api/games/nope/moves').send({ from })).status).toBe(400);
  });

  it.each([
    [{ from: { row: 1.5, col: 0 }, to }],
    [{ from: { row: '0', col: 3 }, to }],
    [{ from: null, to }],
    [{ from, to: { row: 0, col: -1 } }],
    [{ from, to: { row: 11, col: 2 } }],
    [{}],
  ])('rejects malformed move body %j', async (body) => {
    const app = createApp();
    const { body: game } = await request(app).post('/api/games').send({});
    expect((await request(app).post(`/api/games/${game.id}/moves`).send(body)).status).toBe(400);
  });

  it('rejects out-of-range coordinates for the chosen variant without changing the game', async () => {
    const app = createApp();
    const { body: game } = await request(app).post('/api/games').send({ variant: 'brandubh' });
    const res = await request(app).post(`/api/games/${game.id}/moves`).send({ from, to: { row: 0, col: 9 } });
    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/games/${game.id}`)).body.turn).toBe('attacker');
  });

  it.each([{ depth: 0 }, { depth: 4 }, { depth: 1.5 }, { depth: '2' }, { computerSide: 'king' }, { variant: 7 }])(
    'rejects game options %j',
    async (body) => {
      expect((await request(createApp()).post('/api/games').send(body)).status).toBe(400);
    },
  );

  it('creates games from an empty body using defaults', async () => {
    const res = await request(createApp()).post('/api/games');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ mode: 'two-player', variant: 'copenhagen', computerSide: null, difficulty: null });
  });

  it('validates online create parameters and the move body', async () => {
    const app = createApp();
    expect((await request(app).post('/api/online/games').send({ side: 'king' })).status).toBe(400);
    expect((await request(app).post('/api/online/games').send({ variant: 'chess' })).status).toBe(400);
    const created = await request(app).post('/api/online/games');
    expect(created.status).toBe(201);
    expect(created.body.view.variant).toBe('copenhagen');

    const code = created.body.view.code as string;
    const d = (await request(app).post(`/api/online/games/${code}/join`)).body.token as string;
    const res = await request(app).post(`/api/online/games/${code}/moves`).set('X-Player-Token', d).send({ from });
    expect(res.status).toBe(400);
  });

  it('reports unknown online games as 404 on read and move', async () => {
    const app = createApp();
    expect((await request(app).get('/api/online/games/ZZZZZZ').set('X-Player-Token', 'x')).status).toBe(404);
    expect((await request(app).post('/api/online/games/ZZZZZZ/moves').set('X-Player-Token', 'x').send({ from, to })).status).toBe(404);
  });
});

describe('OnlineStore', () => {
  it('keeps a token bound to its own game', () => {
    const store = new OnlineStore();
    const one = store.create('attacker');
    const two = store.create('attacker');
    expect(() => store.get(two.view.code, one.token)).toThrow(OnlineError);
  });

  it('rejects an empty token', () => {
    const store = new OnlineStore();
    const { view } = store.create('attacker');
    expect(() => store.get(view.code, '')).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => store.get(view.code, undefined)).toThrowError(expect.objectContaining({ status: 401 }));
  });

  it('drops abandoned games after the TTL when a new game is created, but keeps active ones', () => {
    let now = 1_000_000;
    const store = new OnlineStore(() => now);
    const stale = store.create('attacker');
    const active = store.create('attacker');
    store.join(active.view.code);

    now += GAME_TTL_MS - 1000;
    store.get(active.view.code, active.token);
    now += 2000;
    store.create('attacker');

    expect(() => store.get(stale.view.code, stale.token)).toThrowError(expect.objectContaining({ status: 404 }));
    expect(store.get(active.view.code, active.token).code).toBe(active.view.code);
  });

  it('sees the joined opponent as connected immediately and trims whitespace in codes', () => {
    const store = new OnlineStore();
    const host = store.create('defender');
    const guest = store.join(` ${host.view.code.toLowerCase()} `);
    expect(guest.view.opponentConnected).toBe(true);
    expect(store.get(host.view.code, host.token).opponentJoined).toBe(true);
  });
});
