import express, { type NextFunction, type Request, type Response } from 'express';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, isDifficulty, type Pos, type Side } from '@hnefatafl/core-engine';
import { GameStore, type GameMode, type GameOptions } from './games.js';

const MODES: readonly GameMode[] = ['two-player', 'vs-computer'];
const SIDES: readonly Side[] = ['attacker', 'defender'];
const BOARD_SIZE = 11;
const MAX_DEPTH = 3;

function isPos(value: unknown): value is Pos {
  if (typeof value !== 'object' || value === null) return false;
  const { row, col } = value as Record<string, unknown>;
  return Number.isInteger(row) && Number.isInteger(col)
    && (row as number) >= 0 && (row as number) < BOARD_SIZE
    && (col as number) >= 0 && (col as number) < BOARD_SIZE;
}

function parseOptions(body: unknown): GameOptions | string {
  const input = (body ?? {}) as Record<string, unknown>;
  const mode = input.mode ?? 'two-player';
  const computerSide = input.computerSide ?? 'defender';
  const difficulty = input.difficulty ?? DEFAULT_DIFFICULTY;
  const depth = input.depth;

  if (!MODES.includes(mode as GameMode)) return `mode must be one of ${MODES.join(', ')}`;
  if (!SIDES.includes(computerSide as Side)) return `computerSide must be one of ${SIDES.join(', ')}`;
  if (!isDifficulty(difficulty)) return `difficulty must be one of ${DIFFICULTIES.join(', ')}`;
  if (depth !== undefined && (!Number.isInteger(depth) || (depth as number) < 1 || (depth as number) > MAX_DEPTH)) {
    return `depth must be an integer from 1 to ${MAX_DEPTH}`;
  }
  return { mode: mode as GameMode, computerSide: computerSide as Side, difficulty, depth: depth as number | undefined };
}

export function createApp(store: GameStore = new GameStore()): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/api/games', (req: Request, res: Response) => {
    const options = parseOptions(req.body);
    if (typeof options === 'string') {
      res.status(400).json({ error: options });
      return;
    }
    res.status(201).json(store.create(options));
  });

  app.get('/api/games/:id', (req: Request, res: Response) => {
    const view = store.get(String(req.params.id));
    if (!view) {
      res.status(404).json({ error: 'game not found' });
      return;
    }
    res.json(view);
  });

  app.post('/api/games/:id/moves', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isPos(body.from) || !isPos(body.to)) {
      res.status(400).json({ error: `from and to must be {row, col} with values 0-${BOARD_SIZE - 1}` });
      return;
    }

    const current = store.get(id);
    if (!current) {
      res.status(404).json({ error: 'game not found' });
      return;
    }
    if (current.status.kind !== 'ongoing') {
      res.status(409).json({ error: 'game is already over' });
      return;
    }

    try {
      res.json(store.play(id, body.from, body.to));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'invalid move' });
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status;
    if (status !== undefined && status >= 400 && status < 500) {
      res.status(status).json({ error: 'malformed request body' });
      return;
    }
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
