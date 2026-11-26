import { BOARD_SIZE, type Board, type Pos, type Square } from '../src/types.js';

type Coord = readonly [number, number];

export interface Layout {
  attackers?: Coord[];
  defenders?: Coord[];
  king?: Coord;
}

export function setup({ attackers = [], defenders = [], king }: Layout): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array<Square>(BOARD_SIZE).fill(null));
  for (const [row, col] of attackers) board[row][col] = 'attacker';
  for (const [row, col] of defenders) board[row][col] = 'defender';
  if (king) board[king[0]][king[1]] = 'king';
  return board;
}

export function pos(row: number, col: number): Pos {
  return { row, col };
}
