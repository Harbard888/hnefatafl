export type Side = 'attacker' | 'defender';
export type Piece = Side | 'king';
export type Square = Piece | null;
export type Board = Square[][];
export interface Pos {
  row: number;
  col: number;
}
export type GameMode = 'two-player' | 'vs-computer';
export type GameStatus =
  | { kind: 'ongoing' }
  | { kind: 'won'; winner: Side; reason: string };

export interface MoveRecord {
  side: Side;
  from: Pos;
  to: Pos;
  captured?: Pos[];
}

export interface LegalMove {
  from: Pos;
  to: Pos;
}

export interface GameView {
  id: string;
  mode: GameMode;
  computerSide: Side;
  board: Board;
  turn: Side;
  status: GameStatus;
  legalMoves: LegalMove[];
  playerMove: MoveRecord | null;
  computerMove: MoveRecord | null;
}

export interface CreateOptions {
  mode: GameMode;
  computerSide?: Side;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError((body as { error?: string }).error ?? `HTTP ${response.status}`, response.status);
  }
  return body as T;
}

export function createGame(options: CreateOptions): Promise<GameView> {
  return request<GameView>('/api/games', { method: 'POST', body: JSON.stringify(options) });
}

export function playMove(id: string, from: Pos, to: Pos): Promise<GameView> {
  return request<GameView>(`/api/games/${id}/moves`, {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}
