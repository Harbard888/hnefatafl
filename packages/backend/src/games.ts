import { randomUUID } from 'node:crypto';
import {
  chooseMove,
  getVariant,
  HnefataflGame,
  type Board,
  type Difficulty,
  type GameStatus,
  type Pos,
  type Side,
  type VariantId,
} from '@hnefatafl/core-engine';

export type GameMode = 'two-player' | 'vs-computer';

export interface GameOptions {
  readonly mode: GameMode;
  readonly computerSide: Side;
  readonly difficulty: Difficulty;
  /** Optional override of the difficulty's search depth. */
  readonly depth?: number;
  /** Rules variant; defaults to Copenhagen. */
  readonly variant?: VariantId;
}

export interface PlayedMove {
  readonly side: Side;
  readonly from: Pos;
  readonly to: Pos;
  readonly captured: readonly Pos[];
}

export interface LegalMove {
  readonly from: Pos;
  readonly to: Pos;
}

export interface GameView {
  readonly id: string;
  readonly mode: GameMode;
  readonly variant: VariantId;
  readonly computerSide: Side | null;
  readonly difficulty: Difficulty | null;
  readonly board: Board;
  readonly turn: Side;
  readonly status: GameStatus;
  readonly legalMoves: readonly LegalMove[];
  readonly playerMove: PlayedMove | null;
  readonly computerMove: PlayedMove | null;
}

interface StoredGame {
  readonly id: string;
  readonly options: GameOptions;
  readonly game: HnefataflGame;
}

export class GameStore {
  private readonly games = new Map<string, StoredGame>();

  create(options: GameOptions): GameView {
    const stored: StoredGame = { id: randomUUID(), options, game: new HnefataflGame({ variant: getVariant(options.variant) }) };
    this.games.set(stored.id, stored);
    return this.view(stored, null, null);
  }

  get(id: string): GameView | undefined {
    const stored = this.games.get(id);
    return stored && this.view(stored, null, null);
  }

  /** Throws the engine's error for illegal moves; callers map that to a client error. */
  play(id: string, from: Pos, to: Pos): GameView | undefined {
    const stored = this.games.get(id);
    if (!stored) return undefined;

    const { game, options } = stored;
    if (options.mode === 'vs-computer' && game.turn === options.computerSide) {
      throw new Error(`It is the computer's turn (${options.computerSide})`);
    }
    const playerSide = game.turn;
    const playerMove = this.applyMove(game, playerSide, from, to);

    let computerMove: PlayedMove | null = null;
    if (options.mode === 'vs-computer' && game.status.kind === 'ongoing' && game.turn === options.computerSide) {
      const choice = chooseMove(game, { difficulty: options.difficulty, depth: options.depth });
      if (choice !== null) computerMove = this.applyMove(game, options.computerSide, choice.from, choice.to);
    }

    return this.view(stored, playerMove, computerMove);
  }

  private applyMove(game: HnefataflGame, side: Side, from: Pos, to: Pos): PlayedMove {
    const result = game.move(from, to);
    return { side, from, to, captured: result.captured };
  }

  private view(stored: StoredGame, playerMove: PlayedMove | null, computerMove: PlayedMove | null): GameView {
    const { game } = stored;
    const ongoing = game.status.kind === 'ongoing';
    return {
      id: stored.id,
      mode: stored.options.mode,
      variant: game.variant.id,
      computerSide: stored.options.mode === 'vs-computer' ? stored.options.computerSide : null,
      difficulty: stored.options.mode === 'vs-computer' ? stored.options.difficulty : null,
      board: game.getBoard(),
      turn: game.turn,
      status: game.status,
      legalMoves: ongoing ? game.legalMoves().map((m) => ({ from: m.from, to: m.to })) : [],
      playerMove,
      computerMove,
    };
  }
}
