import { describe, expect, it } from 'vitest';
import { createInitialBoard } from '../src/board.js';
import { HnefataflGame } from '../src/game.js';
import { capturesAfterMove, hasExitFort, isEncircled } from '../src/rules.js';
import type { Board, Square } from '../src/types.js';
import { BRANDUBH, COPENHAGEN, TABLUT, type Variant } from '../src/variants.js';
import { pos } from './helpers.js';

type Coord = readonly [number, number];

function layout(variant: Variant, { attackers = [], defenders = [], king }: { attackers?: Coord[]; defenders?: Coord[]; king?: Coord }): Board {
  const board: Board = Array.from({ length: variant.size }, () => Array<Square>(variant.size).fill(null));
  for (const [r, c] of attackers) board[r][c] = 'attacker';
  for (const [r, c] of defenders) board[r][c] = 'defender';
  if (king) board[king[0]][king[1]] = 'king';
  return board;
}

describe('game input validation', () => {
  it('rejects positions outside a smaller variant board', () => {
    const game = new HnefataflGame({ variant: BRANDUBH });
    expect(() => game.move(pos(0, 3), pos(0, 8))).toThrow(/outside the 7x7 board/);
    expect(() => game.move(pos(-1, 3), pos(0, 3))).toThrow(/outside/);
  });

  it("rejects moving the opponent's piece, an empty square and a diagonal", () => {
    const game = new HnefataflGame({ variant: BRANDUBH });
    expect(() => game.move(pos(2, 3), pos(2, 0))).toThrow(/No attacker piece/);
    expect(() => game.move(pos(0, 0), pos(0, 1))).toThrow(/No attacker piece/);
    expect(() => game.move(pos(0, 3), pos(1, 2))).toThrow(/Illegal move/);
  });

  it('rejects moves and lists no legal moves once the game is over', () => {
    const board = layout(BRANDUBH, { attackers: [[3, 0]], king: [0, 3] });
    const game = new HnefataflGame({ variant: BRANDUBH, board, turn: 'defender' });
    expect(game.move(pos(0, 3), pos(0, 0)).status).toEqual({ kind: 'won', winner: 'defender', reason: 'king-escaped' });
    expect(game.legalMoves()).toEqual([]);
    expect(() => game.move(pos(3, 0), pos(3, 1))).toThrow(/already over/);
  });

  it('does not mutate the board passed in or returned by getBoard', () => {
    const board = createInitialBoard(BRANDUBH);
    const snapshot = JSON.stringify(board);
    const game = new HnefataflGame({ variant: BRANDUBH, board });
    game.move(pos(0, 3), pos(0, 2));
    game.getBoard()[6][3] = null;
    expect(JSON.stringify(board)).toBe(snapshot);
    expect(game.getBoard()[6][3]).toBe('attacker');
  });
});

describe('hostile squares', () => {
  it('lets attackers capture a defender against the empty throne but not against the occupied one', () => {
    const empty = layout(BRANDUBH, { attackers: [[3, 0]], defenders: [[3, 2]], king: [0, 0] });
    expect(capturesAfterMove(withMove(empty, [3, 0], [3, 1]), pos(3, 1), 'attacker', BRANDUBH)).toEqual([pos(3, 2)]);

    const occupied = layout(BRANDUBH, { attackers: [[3, 0]], defenders: [[3, 2]], king: [3, 3] });
    expect(capturesAfterMove(withMove(occupied, [3, 0], [3, 1]), pos(3, 1), 'attacker', BRANDUBH)).toEqual([]);
  });

  it('makes the throne hostile to attackers even when the king sits on it', () => {
    const board = layout(BRANDUBH, { attackers: [[3, 2]], defenders: [[3, 0]], king: [3, 3] });
    expect(capturesAfterMove(withMove(board, [3, 0], [3, 1]), pos(3, 1), 'defender', BRANDUBH)).toEqual([pos(3, 2)]);
  });

  it('uses restricted corners as captors in Copenhagen but not in Tablut', () => {
    const copenhagen = layout(COPENHAGEN, { attackers: [[0, 3]], defenders: [[0, 1]] });
    expect(capturesAfterMove(withMove(copenhagen, [0, 3], [0, 2]), pos(0, 2), 'attacker', COPENHAGEN)).toEqual([pos(0, 1)]);

    const tablut = layout(TABLUT, { attackers: [[0, 3]], defenders: [[0, 1]] });
    expect(capturesAfterMove(withMove(tablut, [0, 3], [0, 2]), pos(0, 2), 'attacker', TABLUT)).toEqual([]);
  });
});

describe('Copenhagen-only rules stay off in other variants', () => {
  it('does not apply shield wall captures on a Tablut edge', () => {
    const attackers: Coord[] = [[0, 2], [1, 3], [1, 4]];
    const defenders: Coord[] = [[0, 3], [0, 4]];
    const board = layout(TABLUT, { attackers: [...attackers, [0, 6]], defenders });
    const after = withMove(board, [0, 6], [0, 5]);
    expect(capturesAfterMove(after, pos(0, 5), 'attacker', TABLUT)).toEqual([]);
  });

  it('never reports exit forts or encirclement', () => {
    const fort = layout(BRANDUBH, { king: [0, 3], defenders: [[0, 2], [0, 4], [1, 3]] });
    expect(hasExitFort(fort, BRANDUBH)).toBe(false);

    const ring = layout(TABLUT, {
      king: [4, 4],
      attackers: [[3, 4], [5, 4], [4, 3], [4, 5]],
    });
    expect(isEncircled(ring, TABLUT)).toBe(false);
  });
});

function withMove(board: Board, from: Coord, to: Coord): Board {
  const next = board.map((row) => [...row]);
  next[to[0]][to[1]] = next[from[0]][from[1]];
  next[from[0]][from[1]] = null;
  return next;
}
