export type Side = 'attacker' | 'defender';

/** Soldiers are identified by their side; the king is a separate piece type. */
export type Piece = Side | 'king';

export type Square = Piece | null;

/** Indexed as `board[row][col]`. */
export type Board = Square[][];

export interface Pos {
  readonly row: number;
  readonly col: number;
}

export interface Dir {
  readonly row: number;
  readonly col: number;
}

export interface Move {
  readonly from: Pos;
  readonly to: Pos;
}

export type WinReason = 'king-escaped' | 'king-captured' | 'exit-fort' | 'encirclement' | 'no-legal-moves';

export type GameStatus =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'won'; readonly winner: Side; readonly reason: WinReason };

export interface MoveResult {
  readonly captured: readonly Pos[];
  readonly status: GameStatus;
}

export const BOARD_SIZE = 11;
