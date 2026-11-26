import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/ai.js';
import { createInitialBoard } from '../src/board.js';
import { HnefataflGame } from '../src/game.js';
import { BRANDUBH, COPENHAGEN, TABLUT, VARIANTS, type Variant } from '../src/variants.js';
import { pos } from './helpers.js';

type Coord = readonly [number, number];

function layout(
  variant: Variant,
  { attackers = [], defenders = [], king }: { attackers?: Coord[]; defenders?: Coord[]; king: Coord },
) {
  const board = Array.from({ length: variant.size }, () => Array<'attacker' | 'defender' | 'king' | null>(variant.size).fill(null));
  for (const [r, c] of attackers) board[r][c] = 'attacker';
  for (const [r, c] of defenders) board[r][c] = 'defender';
  board[king[0]][king[1]] = 'king';
  return board;
}

function count(board: ReturnType<typeof createInitialBoard>, piece: string): number {
  return board.flat().filter((s) => s === piece).length;
}

describe('variant setups', () => {
  it.each([
    [COPENHAGEN, 11, 24, 12],
    [BRANDUBH, 7, 8, 4],
    [TABLUT, 9, 16, 8],
  ])('%s has the right size and piece counts', (variant, size, attackers, defenders) => {
    const board = createInitialBoard(variant);
    expect(board).toHaveLength(size);
    expect(board.every((row) => row.length === size)).toBe(true);
    expect(count(board, 'attacker')).toBe(attackers);
    expect(count(board, 'defender')).toBe(defenders);
    expect(board[variant.throne.row][variant.throne.col]).toBe('king');
  });

  it('is symmetric under 90 degree rotation', () => {
    for (const variant of Object.values(VARIANTS)) {
      const board = createInitialBoard(variant);
      const n = variant.size;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) expect(board[c][n - 1 - r]).toBe(board[r][c]);
    }
  });

  it('games default to Copenhagen', () => {
    expect(new HnefataflGame().variant).toBe(COPENHAGEN);
    expect(new HnefataflGame({ board: createInitialBoard(), turn: 'attacker' }).getBoard()).toHaveLength(11);
  });
});

describe('Brandubh', () => {
  const game = (opts: Parameters<typeof layout>[1], turn: 'attacker' | 'defender') =>
    new HnefataflGame({ board: layout(BRANDUBH, opts), turn, variant: BRANDUBH });

  it('the king escapes only on a corner', () => {
    const edge = game({ attackers: [[5, 5]], king: [0, 3] }, 'defender');
    edge.move(pos(0, 3), pos(0, 2));
    expect(edge.status.kind).toBe('ongoing');
    edge.move(pos(5, 5), pos(5, 4));
    edge.move(pos(0, 2), pos(0, 0));
    expect(edge.status).toEqual({ kind: 'won', winner: 'defender', reason: 'king-escaped' });
  });

  it('two attackers capture the king away from the throne', () => {
    const g = game({ attackers: [[1, 1], [2, 5]], king: [2, 2] }, 'attacker');
    g.move(pos(2, 5), pos(2, 3));
    expect(g.status.kind).toBe('ongoing');
    const h = game({ attackers: [[1, 2], [5, 2]], king: [2, 2] }, 'attacker');
    h.move(pos(5, 2), pos(3, 2));
    expect(h.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });
  });

  it('the king cannot capture itself by moving between two attackers', () => {
    const g = game({ attackers: [[2, 1], [2, 5], [6, 6]], king: [3, 2] }, 'defender');
    g.move(pos(3, 2), pos(2, 2));
    g.move(pos(6, 6), pos(6, 5));
    expect(g.status.kind).toBe('ongoing');
  });

  it('needs four attackers on the throne and three plus the throne next to it', () => {
    const throne = game({ attackers: [[2, 3], [3, 2], [3, 4], [6, 6]], king: [3, 3] }, 'attacker');
    throne.move(pos(6, 6), pos(6, 3));
    expect(throne.status.kind).toBe('ongoing');
    const four = game({ attackers: [[2, 3], [3, 2], [3, 4], [6, 3]], king: [3, 3] }, 'attacker');
    four.move(pos(6, 3), pos(4, 3));
    expect(four.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });

    const next = game({ attackers: [[2, 2], [4, 2], [3, 0]], king: [3, 2] }, 'attacker');
    next.move(pos(3, 0), pos(3, 1));
    expect(next.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });
  });

  it('keeps corners restricted for soldiers', () => {
    const g = game({ attackers: [[0, 3]], king: [3, 3] }, 'attacker');
    expect(g.legalMoves().some((m) => m.to.row === 0 && m.to.col === 0)).toBe(false);
  });
});

describe('Tablut', () => {
  const game = (opts: Parameters<typeof layout>[1], turn: 'attacker' | 'defender') =>
    new HnefataflGame({ board: layout(TABLUT, opts), turn, variant: TABLUT });

  it('the king escapes on any edge square', () => {
    const g = game({ attackers: [[8, 8]], king: [4, 2] }, 'defender');
    g.move(pos(4, 2), pos(4, 0));
    expect(g.status).toEqual({ kind: 'won', winner: 'defender', reason: 'king-escaped' });
  });

  it('corners are ordinary squares for soldiers', () => {
    const g = game({ attackers: [[0, 3]], king: [4, 4] }, 'attacker');
    expect(g.legalMoves().some((m) => m.to.row === 0 && m.to.col === 0)).toBe(true);
  });

  it('two attackers capture the king away from the throne', () => {
    const g = game({ attackers: [[2, 1], [6, 6]], king: [2, 2] }, 'attacker');
    g.move(pos(6, 6), pos(6, 2));
    expect(g.status.kind).toBe('ongoing');
    g.move(pos(2, 2), pos(2, 3));
    g.move(pos(6, 2), pos(6, 3));
    expect(g.status.kind).toBe('ongoing');
    const h = game({ attackers: [[1, 2], [5, 6]], king: [2, 2] }, 'attacker');
    h.move(pos(5, 6), pos(5, 2));
    expect(h.status.kind).toBe('ongoing');
    const k = game({ attackers: [[2, 1], [2, 6]], king: [2, 2] }, 'attacker');
    k.move(pos(2, 6), pos(2, 3));
    expect(k.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });
  });

  it('needs four sides on and next to the throne', () => {
    const next = game({ attackers: [[3, 3], [5, 3], [4, 1]], king: [4, 3] }, 'attacker');
    next.move(pos(4, 1), pos(4, 2));
    expect(next.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });

    const partial = game({ attackers: [[3, 3], [4, 1]], king: [4, 3], defenders: [[5, 3]] }, 'attacker');
    partial.move(pos(4, 1), pos(4, 2));
    expect(partial.status.kind).toBe('ongoing');
  });
});

describe('AI on every variant', () => {
  it.each(Object.values(VARIANTS))('plays legal moves for $id', (variant) => {
    const game = new HnefataflGame({ board: createInitialBoard(variant), turn: 'attacker', variant });
    for (let i = 0; i < 6 && game.status.kind === 'ongoing'; i++) {
      const move = chooseMove(game, { difficulty: 'easy', timeBudgetMs: 200 });
      expect(move).not.toBeNull();
      game.move(move!.from, move!.to);
    }
  });

  it('takes an immediate Tablut edge escape', () => {
    const game = new HnefataflGame({
      board: layout(TABLUT, { attackers: [[8, 8], [0, 0]], king: [4, 2] }),
      turn: 'defender',
      variant: TABLUT,
    });
    const move = chooseMove(game, { difficulty: 'medium' })!;
    game.move(move.from, move.to);
    expect(game.status).toMatchObject({ kind: 'won', winner: 'defender' });
  });
});
