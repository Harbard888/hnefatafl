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

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export interface GameView {
  id: string;
  mode: GameMode;
  computerSide: Side;
  difficulty: Difficulty | null;
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
  difficulty?: Difficulty;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Player-Token': token } : {}) },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError((body as { error?: string }).error ?? `HTTP ${response.status}`, response.status);
  }
  return body as T;
}

export interface OnlineView {
  code: string;
  you: Side;
  board: GameView['board'];
  turn: Side;
  status: GameView['status'];
  legalMoves: { from: Pos; to: Pos }[];
  opponentJoined: boolean;
  opponentConnected: boolean;
  moves: MoveRecord[];
}

export interface OnlineSeat {
  token: string;
  side: Side;
  view: OnlineView;
}

export function createOnlineGame(side: Side | 'random'): Promise<OnlineSeat> {
  return request('/api/online/games', { method: 'POST', body: JSON.stringify({ side }) });
}

export function joinOnlineGame(code: string): Promise<OnlineSeat> {
  return request(`/api/online/games/${encodeURIComponent(code)}/join`, { method: 'POST' });
}

export function fetchOnlineGame(code: string, token: string): Promise<OnlineView> {
  return request(`/api/online/games/${encodeURIComponent(code)}`, undefined, token);
}

export function playOnlineMove(code: string, token: string, from: Pos, to: Pos): Promise<OnlineView> {
  return request(
    `/api/online/games/${encodeURIComponent(code)}/moves`,
    { method: 'POST', body: JSON.stringify({ from, to }) },
    token,
  );
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
