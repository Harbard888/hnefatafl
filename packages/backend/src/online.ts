import { randomBytes } from 'node:crypto';
import { getVariant, HnefataflGame, type Board, type GameStatus, type Pos, type Side, type VariantId } from '@hnefatafl/core-engine';
import type { LegalMove, PlayedMove } from './games.js';

export type SideChoice = Side | 'random';

/** A player counts as connected if they polled within this window. */
export const CONNECTED_WINDOW_MS = 15_000;
/** Unfinished games nobody touched for this long are dropped. */
export const GAME_TTL_MS = 6 * 60 * 60 * 1000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export class OnlineError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'OnlineError';
  }
}

export interface OnlineView {
  readonly code: string;
  readonly you: Side;
  readonly variant: VariantId;
  readonly board: Board;
  readonly turn: Side;
  readonly status: GameStatus;
  /** Legal moves for this player; empty unless it is their turn. */
  readonly legalMoves: readonly LegalMove[];
  readonly opponentJoined: boolean;
  readonly opponentConnected: boolean;
  /** Full move list, so clients can sync by replacing local history. */
  readonly moves: readonly PlayedMove[];
}

export interface Seat {
  readonly token: string;
  readonly side: Side;
  readonly view: OnlineView;
}

interface PlayerSlot {
  token: string;
  lastSeen: number;
}

interface OnlineGame {
  readonly code: string;
  readonly game: HnefataflGame;
  readonly players: Partial<Record<Side, PlayerSlot>>;
  readonly moves: PlayedMove[];
  touched: number;
}

function other(side: Side): Side {
  return side === 'attacker' ? 'defender' : 'attacker';
}

export class OnlineStore {
  private readonly games = new Map<string, OnlineGame>();

  constructor(private readonly now: () => number = Date.now) {}

  create(choice: SideChoice = 'random', variant: VariantId = 'copenhagen'): Seat {
    this.sweep();
    const side: Side = choice === 'random' ? (randomBytes(1)[0] % 2 === 0 ? 'attacker' : 'defender') : choice;
    const code = this.newCode();
    const stored: OnlineGame = { code, game: new HnefataflGame({ variant: getVariant(variant) }), players: {}, moves: [], touched: this.now() };
    this.games.set(code, stored);
    return this.seat(stored, side);
  }

  join(rawCode: string): Seat {
    const stored = this.find(rawCode);
    const free = (['attacker', 'defender'] as const).find((s) => !stored.players[s]);
    if (!free) throw new OnlineError('game is already full', 409);
    return this.seat(stored, free);
  }

  get(rawCode: string, token: string | undefined): OnlineView {
    const stored = this.find(rawCode);
    const side = this.authenticate(stored, token);
    stored.players[side]!.lastSeen = this.now();
    stored.touched = this.now();
    return this.view(stored, side);
  }

  play(rawCode: string, token: string | undefined, from: Pos, to: Pos): OnlineView {
    const stored = this.find(rawCode);
    const side = this.authenticate(stored, token);
    const { game } = stored;
    stored.players[side]!.lastSeen = this.now();
    stored.touched = this.now();

    if (!stored.players[other(side)]) throw new OnlineError('waiting for an opponent to join', 409);
    if (game.status.kind !== 'ongoing') throw new OnlineError('game is already over', 409);
    if (game.turn !== side) throw new OnlineError('it is not your turn', 403);

    try {
      const result = game.move(from, to);
      stored.moves.push({ side, from, to, captured: result.captured });
    } catch (error) {
      throw new OnlineError(error instanceof Error ? error.message : 'invalid move', 400);
    }
    return this.view(stored, side);
  }

  private seat(stored: OnlineGame, side: Side): Seat {
    const token = randomBytes(16).toString('hex');
    stored.players[side] = { token, lastSeen: this.now() };
    stored.touched = this.now();
    return { token, side, view: this.view(stored, side) };
  }

  private find(rawCode: string): OnlineGame {
    const stored = this.games.get(rawCode.trim().toUpperCase());
    if (!stored) throw new OnlineError('game not found', 404);
    return stored;
  }

  private authenticate(stored: OnlineGame, token: string | undefined): Side {
    const side = (['attacker', 'defender'] as const).find((s) => token && stored.players[s]?.token === token);
    if (!side) throw new OnlineError('invalid player token', 401);
    return side;
  }

  private view(stored: OnlineGame, you: Side): OnlineView {
    const { game } = stored;
    const opponent = stored.players[other(you)];
    const myTurn = game.status.kind === 'ongoing' && game.turn === you && opponent !== undefined;
    return {
      code: stored.code,
      you,
      variant: game.variant.id,
      board: game.getBoard(),
      turn: game.turn,
      status: game.status,
      legalMoves: myTurn ? game.legalMoves().map((m) => ({ from: m.from, to: m.to })) : [],
      opponentJoined: opponent !== undefined,
      opponentConnected: opponent !== undefined && this.now() - opponent.lastSeen < CONNECTED_WINDOW_MS,
      moves: stored.moves,
    };
  }

  private newCode(): string {
    for (;;) {
      const bytes = randomBytes(CODE_LENGTH);
      const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (!this.games.has(code)) return code;
    }
  }

  private sweep(): void {
    const cutoff = this.now() - GAME_TTL_MS;
    for (const [code, stored] of this.games) if (stored.touched < cutoff) this.games.delete(code);
  }
}
