import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { CONNECTED_WINDOW_MS, OnlineStore } from '../src/online.js';

const from = { row: 0, col: 3 };
const to = { row: 0, col: 2 };

async function setup(side: string = 'attacker', store = new OnlineStore()) {
  const app = createApp(undefined, store);
  const created = await request(app).post('/api/online/games').send({ side });
  expect(created.status).toBe(201);
  const code = created.body.view.code as string;
  const joined = await request(app).post(`/api/online/games/${code}/join`);
  expect(joined.status).toBe(201);
  return { app, code, a: created.body.token as string, d: joined.body.token as string, created, joined };
}

const move = (app: ReturnType<typeof createApp>, code: string, token: string, body: object = { from, to }) =>
  request(app).post(`/api/online/games/${code}/moves`).set('X-Player-Token', token).send(body);
const poll = (app: ReturnType<typeof createApp>, code: string, token?: string) => {
  const r = request(app).get(`/api/online/games/${code}`);
  return token ? r.set('X-Player-Token', token) : r;
};

describe('online games', () => {
  it('assigns the creator their side and the joiner the other', async () => {
    const { created, joined } = await setup('defender');
    expect(created.body.side).toBe('defender');
    expect(created.body.view.opponentJoined).toBe(false);
    expect(joined.body.side).toBe('attacker');
    expect(joined.body.view.opponentJoined).toBe(true);
  });

  it('rejects a third player and unknown codes', async () => {
    const { app, code } = await setup();
    expect((await request(app).post(`/api/online/games/${code}/join`)).status).toBe(409);
    expect((await request(app).post('/api/online/games/NOPE00/join')).status).toBe(404);
  });

  it('accepts codes case-insensitively', async () => {
    const { app, code, a } = await setup();
    expect((await poll(app, code.toLowerCase(), a)).status).toBe(200);
  });

  it('validates moves for the right player and turn, and keeps both clients in sync', async () => {
    const { app, code, a, d } = await setup('attacker');

    expect((await move(app, code, d)).status).toBe(403);
    expect((await move(app, code, 'bogus')).status).toBe(401);
    expect((await request(app).post(`/api/online/games/${code}/moves`).send({ from, to })).status).toBe(401);
    expect((await move(app, code, a, { from, to: { row: 1, col: 2 } })).status).toBe(400);
    expect((await move(app, code, a, { from: { row: 99, col: 0 }, to })).status).toBe(400);

    const ok = await move(app, code, a);
    expect(ok.status).toBe(200);
    expect(ok.body.turn).toBe('defender');
    expect(ok.body.legalMoves).toEqual([]);

    const theirs = await poll(app, code, d);
    expect(theirs.body.turn).toBe('defender');
    expect(theirs.body.moves).toHaveLength(1);
    expect(theirs.body.legalMoves.length).toBeGreaterThan(0);
    expect(theirs.body.board[0][2]).toBe('attacker');

    expect((await move(app, code, a)).status).toBe(403);
  });

  it('does not allow moves before an opponent joins, and requires a token to read', async () => {
    const app = createApp();
    const created = await request(app).post('/api/online/games').send({ side: 'attacker' });
    const code = created.body.view.code;
    expect((await move(app, code, created.body.token)).status).toBe(409);
    expect((await poll(app, code)).status).toBe(401);
    expect((await request(app).post('/api/online/games').send({ side: 'x' })).status).toBe(400);
  });

  it('reports a disconnected opponent after a quiet period', async () => {
    let now = 1_000;
    const { app, code, a, d } = await setup('attacker', new OnlineStore(() => now));
    expect((await poll(app, code, a)).body.opponentConnected).toBe(true);
    now += CONNECTED_WINDOW_MS + 1;
    expect((await poll(app, code, a)).body.opponentConnected).toBe(false);
    await poll(app, code, d);
    expect((await poll(app, code, a)).body.opponentConnected).toBe(true);
  });
});

describe('online variants', () => {
  it('creates games for the requested variant and defaults to Copenhagen', async () => {
    const app = createApp(undefined, new OnlineStore());
    const tablut = await request(app).post('/api/online/games').send({ side: 'attacker', variant: 'tablut' });
    expect(tablut.status).toBe(201);
    expect(tablut.body.view.variant).toBe('tablut');
    expect(tablut.body.view.board).toHaveLength(9);

    const plain = await request(app).post('/api/online/games').send({});
    expect(plain.body.view.variant).toBe('copenhagen');
    expect((await request(app).post('/api/online/games').send({ variant: 'x' })).status).toBe(400);
  });
});
