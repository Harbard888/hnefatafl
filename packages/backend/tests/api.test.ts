import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const from = { row: 0, col: 3 };
const to = { row: 0, col: 2 };

async function createGame(app: ReturnType<typeof createApp>, body: object = {}) {
  const res = await request(app).post('/api/games').send(body);
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

describe('two-player games', () => {
  it('applies a legal move and passes the turn', async () => {
    const app = createApp();
    const created = await createGame(app, { mode: 'two-player' });
    const res = await request(app).post(`/api/games/${created.id}/moves`).send({ from, to });

    expect(res.status).toBe(200);
    expect(res.body.turn).toBe('defender');
    expect(res.body.playerMove).toMatchObject({ side: 'attacker', from, to });
    expect(res.body.computerMove).toBeNull();
    expect(res.body.board[0][2]).toBe('attacker');
  });

  it('rejects an illegal move with 400 and leaves the game unchanged', async () => {
    const app = createApp();
    const { id } = await createGame(app);
    const res = await request(app).post(`/api/games/${id}/moves`).send({ from, to: { row: 1, col: 2 } });

    expect(res.status).toBe(400);
    const state = await request(app).get(`/api/games/${id}`);
    expect(state.body.turn).toBe('attacker');
  });

  it('rejects coordinates outside the board', async () => {
    const app = createApp();
    const { id } = await createGame(app);
    const res = await request(app).post(`/api/games/${id}/moves`).send({ from, to: { row: 11, col: 0 } });
    expect(res.status).toBe(400);
  });
});

describe('games against the computer', () => {
  it('answers the player move with the computer move on its side', async () => {
    const app = createApp();
    const created = await createGame(app, { mode: 'vs-computer', computerSide: 'defender' });
    const res = await request(app).post(`/api/games/${created.id}/moves`).send({ from, to });

    expect(res.status).toBe(200);
    expect(res.body.computerMove).toMatchObject({ side: 'defender' });
    expect(res.body.turn).toBe('attacker');
  });

  it('refuses a move for the computer side', async () => {
    const app = createApp();
    const created = await createGame(app, { mode: 'vs-computer', computerSide: 'attacker' });
    const res = await request(app).post(`/api/games/${created.id}/moves`).send({ from, to });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("computer's turn");
  });
});

describe('validation', () => {
  it('rejects unknown modes and out-of-range search depths', async () => {
    const app = createApp();
    expect((await request(app).post('/api/games').send({ mode: 'online' })).status).toBe(400);
    expect((await request(app).post('/api/games').send({ mode: 'vs-computer', depth: 9 })).status).toBe(400);
  });

  it('answers malformed JSON with a JSON error instead of an HTML page', async () => {
    const res = await request(createApp())
      .post('/api/games')
      .set('Content-Type', 'application/json')
      .send('{"mode":');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toBe('malformed request body');
  });

  it('returns 404 for unknown games', async () => {
    const app = createApp();
    expect((await request(app).get('/api/games/missing')).status).toBe(404);
    expect((await request(app).post('/api/games/missing/moves').send({ from, to })).status).toBe(404);
  });
});
