import {
  at,
  cloneBoard,
  createInitialBoard,
  findKing,
  isCorner,
  positionsOf,
  samePos,
  sideOf,
} from './board.js';
import {
  capturesAfterMove,
  hasExitFort,
  isEncircled,
  isKingCaptured,
  legalDestinations,
  opposite,
} from './rules.js';
import type { Board, GameStatus, Move, MoveResult, Pos, Side, WinReason } from './types.js';

export interface GameSetup {
  readonly board: Board;
  readonly turn: Side;
}

const REPETITION_LIMIT = 3;
const ONGOING: GameStatus = { kind: 'ongoing' };

function won(winner: Side, reason: WinReason): GameStatus {
  return { kind: 'won', winner, reason };
}

function positionKey(board: Board, turn: Side): string {
  const rows = board.map((row) => row.map((square) => square ?? '.').join(''));
  return `${rows.join('/')}:${turn}`;
}

export class HnefataflGame {
  private board: Board;
  private currentTurn: Side;
  private currentStatus: GameStatus = ONGOING;
  private readonly positionCounts = new Map<string, number>();

  constructor(setup?: GameSetup) {
    this.board = setup ? cloneBoard(setup.board) : createInitialBoard();
    this.currentTurn = setup?.turn ?? 'attacker';
    this.recordPosition(this.board, this.currentTurn);
  }

  get turn(): Side {
    return this.currentTurn;
  }

  get status(): GameStatus {
    return this.currentStatus;
  }

  getBoard(): Board {
    return cloneBoard(this.board);
  }

  legalMoves(): Move[] {
    if (this.currentStatus.kind !== 'ongoing') return [];
    return this.allowedMoves(this.currentTurn);
  }

  move(from: Pos, to: Pos): MoveResult {
    if (this.currentStatus.kind !== 'ongoing') throw new Error('Game is already over');

    const piece = at(this.board, from);
    if (piece === null || sideOf(piece) !== this.currentTurn) {
      throw new Error(`No ${this.currentTurn} piece at (${from.row}, ${from.col})`);
    }
    if (!legalDestinations(this.board, from).some((dest) => samePos(dest, to))) {
      throw new Error(`Illegal move to (${to.row}, ${to.col})`);
    }

    const { board, captured, turn } = this.successor(from, to);
    if (this.isThirdOccurrence(board, turn)) {
      throw new Error(`Illegal move to (${to.row}, ${to.col}): position would repeat a third time`);
    }

    this.board = board;
    this.currentTurn = turn;
    this.recordPosition(board, turn);
    this.currentStatus = this.evaluate();
    return { captured, status: this.currentStatus };
  }

  private successor(from: Pos, to: Pos): { board: Board; captured: Pos[]; turn: Side } {
    const mover = this.currentTurn;
    const board = cloneBoard(this.board);
    board[to.row][to.col] = board[from.row][from.col];
    board[from.row][from.col] = null;

    const captured = capturesAfterMove(board, to, mover);
    for (const pos of captured) board[pos.row][pos.col] = null;

    return { board, captured, turn: opposite(mover) };
  }

  private allowedMoves(side: Side): Move[] {
    return positionsOf(this.board, side).flatMap((from) =>
      legalDestinations(this.board, from)
        .filter((to) => {
          const next = this.successor(from, to);
          return !this.isThirdOccurrence(next.board, next.turn);
        })
        .map((to) => ({ from, to })),
    );
  }

  private evaluate(): GameStatus {
    const king = findKing(this.board);
    if (king !== null && isCorner(king)) return won('defender', 'king-escaped');
    if (isKingCaptured(this.board)) return won('attacker', 'king-captured');
    if (hasExitFort(this.board)) return won('defender', 'exit-fort');
    if (isEncircled(this.board)) return won('attacker', 'encirclement');
    if (!this.hasAllowedMove(this.currentTurn)) {
      return won(opposite(this.currentTurn), 'no-legal-moves');
    }
    return ONGOING;
  }

  private hasAllowedMove(side: Side): boolean {
    return positionsOf(this.board, side).some((from) =>
      legalDestinations(this.board, from).some((to) => {
        const next = this.successor(from, to);
        return !this.isThirdOccurrence(next.board, next.turn);
      }),
    );
  }

  private isThirdOccurrence(board: Board, turn: Side): boolean {
    return (this.positionCounts.get(positionKey(board, turn)) ?? 0) >= REPETITION_LIMIT - 1;
  }

  private recordPosition(board: Board, turn: Side): void {
    const key = positionKey(board, turn);
    this.positionCounts.set(key, (this.positionCounts.get(key) ?? 0) + 1);
  }
}
