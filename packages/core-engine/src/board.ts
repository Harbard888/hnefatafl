import { type Board, type Dir, type Piece, type Pos, type Side, type Square } from './types.js';
import { COPENHAGEN, type Variant } from './variants.js';

export const THRONE: Pos = COPENHAGEN.throne;

export function cornersOf(variant: Variant = COPENHAGEN): readonly Pos[] {
  const last = variant.size - 1;
  return [
    { row: 0, col: 0 },
    { row: 0, col: last },
    { row: last, col: 0 },
    { row: last, col: last },
  ];
}

export const CORNERS: readonly Pos[] = cornersOf(COPENHAGEN);

export const ORTHOGONAL: readonly Dir[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function inBounds(pos: Pos, variant: Variant = COPENHAGEN): boolean {
  return pos.row >= 0 && pos.row < variant.size && pos.col >= 0 && pos.col < variant.size;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function keyOf(pos: Pos): string {
  return `${pos.row},${pos.col}`;
}

export function offset(pos: Pos, dir: Dir): Pos {
  return { row: pos.row + dir.row, col: pos.col + dir.col };
}

export function isThrone(pos: Pos, variant: Variant = COPENHAGEN): boolean {
  return samePos(pos, variant.throne);
}

export function isCorner(pos: Pos, variant: Variant = COPENHAGEN): boolean {
  const last = variant.size - 1;
  return (pos.row === 0 || pos.row === last) && (pos.col === 0 || pos.col === last);
}

export function isEdge(pos: Pos, variant: Variant = COPENHAGEN): boolean {
  const last = variant.size - 1;
  return pos.row === 0 || pos.row === last || pos.col === 0 || pos.col === last;
}

export function at(board: Board, pos: Pos): Square {
  return board[pos.row][pos.col];
}

export function sideOf(piece: Piece): Side {
  return piece === 'attacker' ? 'attacker' : 'defender';
}

export function createInitialBoard(variant: Variant = COPENHAGEN): Board {
  const board: Board = Array.from({ length: variant.size }, () => Array<Square>(variant.size).fill(null));
  for (const [row, col] of variant.attackers) board[row][col] = 'attacker';
  for (const [row, col] of variant.defenders) board[row][col] = 'defender';
  board[variant.throne.row][variant.throne.col] = 'king';
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function findKing(board: Board): Pos | null {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board.length; col++) {
      if (board[row][col] === 'king') return { row, col };
    }
  }
  return null;
}

export function positionsOf(board: Board, side: Side): Pos[] {
  const positions: Pos[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board.length; col++) {
      const piece = board[row][col];
      if (piece !== null && sideOf(piece) === side) positions.push({ row, col });
    }
  }
  return positions;
}
