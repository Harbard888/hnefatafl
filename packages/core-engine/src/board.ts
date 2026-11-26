import { BOARD_SIZE, type Board, type Dir, type Piece, type Pos, type Side, type Square } from './types.js';

const LAST = BOARD_SIZE - 1;

export const THRONE: Pos = { row: 5, col: 5 };

export const CORNERS: readonly Pos[] = [
  { row: 0, col: 0 },
  { row: 0, col: LAST },
  { row: LAST, col: 0 },
  { row: LAST, col: LAST },
];

export const ORTHOGONAL: readonly Dir[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function inBounds(pos: Pos): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
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

export function isThrone(pos: Pos): boolean {
  return samePos(pos, THRONE);
}

export function isCorner(pos: Pos): boolean {
  return CORNERS.some((corner) => samePos(corner, pos));
}

export function isEdge(pos: Pos): boolean {
  return pos.row === 0 || pos.row === LAST || pos.col === 0 || pos.col === LAST;
}

export function at(board: Board, pos: Pos): Square {
  return board[pos.row][pos.col];
}

export function sideOf(piece: Piece): Side {
  return piece === 'attacker' ? 'attacker' : 'defender';
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array<Square>(BOARD_SIZE).fill(null));
  const place = (cells: readonly [number, number][], piece: Piece): void => {
    for (const [row, col] of cells) board[row][col] = piece;
  };

  place(
    [[0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 5],
     [10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [9, 5],
     [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [5, 1],
     [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [5, 9]],
    'attacker',
  );
  place(
    [[3, 5], [4, 4], [4, 5], [4, 6], [5, 3], [5, 4],
     [5, 6], [5, 7], [6, 4], [6, 5], [6, 6], [7, 5]],
    'defender',
  );
  board[THRONE.row][THRONE.col] = 'king';
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function findKing(board: Board): Pos | null {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === 'king') return { row, col };
    }
  }
  return null;
}

export function positionsOf(board: Board, side: Side): Pos[] {
  const positions: Pos[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece !== null && sideOf(piece) === side) positions.push({ row, col });
    }
  }
  return positions;
}
