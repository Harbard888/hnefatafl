import { describe, expect, it } from 'vitest';
import { createInitialBoard } from '../src/board.js';
import { capturesAfterMove, hasExitFort, isEncircled, isKingCaptured, legalDestinations } from '../src/rules.js';
import { pos, setup } from './helpers.js';

describe('initial position', () => {
  it('has 24 attackers, 12 defenders and the king on the throne', () => {
    const board = createInitialBoard();
    const squares = board.flat();
    expect(squares.filter((s) => s === 'attacker')).toHaveLength(24);
    expect(squares.filter((s) => s === 'defender')).toHaveLength(12);
    expect(board[5][5]).toBe('king');
  });
});

describe('movement', () => {
  it('lets soldiers pass over the empty throne but not stop on it or a corner', () => {
    const board = setup({ attackers: [[5, 3], [0, 3]] });

    const row = legalDestinations(board, pos(5, 3));
    expect(row).toContainEqual(pos(5, 4));
    expect(row).toContainEqual(pos(5, 6));
    expect(row).not.toContainEqual(pos(5, 5));

    const top = legalDestinations(board, pos(0, 3));
    expect(top).toContainEqual(pos(0, 1));
    expect(top).not.toContainEqual(pos(0, 0));
  });
});

describe('soldier captures', () => {
  it('captures a soldier sandwiched by the moving piece', () => {
    const board = setup({ attackers: [[2, 3], [2, 5]], defenders: [[2, 4]] });
    expect(capturesAfterMove(board, pos(2, 5), 'attacker')).toEqual([pos(2, 4)]);
  });

  it('does not capture a piece that moves voluntarily between two enemies', () => {
    const board = setup({ attackers: [[2, 3], [2, 5]], defenders: [[2, 4]] });
    expect(capturesAfterMove(board, pos(2, 4), 'defender')).toEqual([]);
  });

  it('lets the armed king act as a capturing partner', () => {
    const board = setup({ attackers: [[2, 4]], defenders: [[2, 3]], king: [2, 5] });
    expect(capturesAfterMove(board, pos(2, 5), 'defender')).toEqual([pos(2, 4)]);
  });

  it('captures a row of two soldiers on the edge that is closed at both ends', () => {
    const board = setup({ attackers: [[0, 3], [1, 4], [1, 5], [0, 6]], defenders: [[0, 4], [0, 5]] });
    const captured = capturesAfterMove(board, pos(0, 6), 'attacker');
    expect(captured).toHaveLength(2);
    expect(captured).toEqual(expect.arrayContaining([pos(0, 4), pos(0, 5)]));
  });

  it('does not capture an edge row when a soldier has no enemy in front of it', () => {
    const board = setup({ attackers: [[0, 3], [1, 5], [0, 6]], defenders: [[0, 4], [0, 5]] });
    expect(capturesAfterMove(board, pos(0, 6), 'attacker')).toEqual([]);
  });
});

describe('king capture', () => {
  it('needs attackers on all four sides in the open', () => {
    const threeSides = setup({ attackers: [[1, 5], [3, 5], [2, 4]], king: [2, 5] });
    expect(isKingCaptured(threeSides)).toBe(false);

    const fourSides = setup({ attackers: [[1, 5], [3, 5], [2, 4], [2, 6]], king: [2, 5] });
    expect(isKingCaptured(fourSides)).toBe(true);
  });

  it('counts the empty throne as the fourth side next to it', () => {
    const board = setup({ attackers: [[3, 5], [4, 4], [4, 6]], king: [4, 5] });
    expect(isKingCaptured(board)).toBe(true);
  });

  it('can never be captured on the edge', () => {
    const board = setup({ attackers: [[0, 4], [0, 6], [1, 5]], king: [0, 5] });
    expect(isKingCaptured(board)).toBe(false);
  });
});

describe('exit fort', () => {
  const fort: [number, number][] = [[10, 3], [9, 3], [9, 4], [9, 5], [10, 6]];
  const attackers: [number, number][] = [[10, 2], [9, 2], [8, 4], [8, 5], [10, 7]];

  it('is recognised when the king on the edge can move inside a sealed, uncapturable fort', () => {
    expect(hasExitFort(setup({ attackers, defenders: fort, king: [10, 4] }))).toBe(true);
  });

  it('is not recognised when attackers can reach the king\'s area', () => {
    const breached = fort.filter(([r, c]) => !(r === 9 && c === 5));
    expect(hasExitFort(setup({ attackers, defenders: breached, king: [10, 4] }))).toBe(false);
  });

  it('is not recognised when the king cannot move', () => {
    expect(hasExitFort(setup({ attackers, defenders: [...fort, [10, 5]], king: [10, 4] }))).toBe(false);
  });

  it('is not recognised when a wall soldier can be captured', () => {
    const weak: [number, number][] = [[10, 3], [9, 4], [9, 5], [10, 6], [9, 3]];
    const open = weak.filter(([r, c]) => !(r === 9 && c === 4));
    expect(hasExitFort(setup({ attackers, defenders: open, king: [10, 4] }))).toBe(false);
  });
});

describe('encirclement', () => {
  const ring: [number, number][] = [
    [1, 1], [1, 2], [1, 3], [1, 4],
    [3, 1], [3, 2], [3, 3], [3, 4],
    [2, 1], [2, 4],
  ];

  it('is detected when all defenders are enclosed by an unbroken ring', () => {
    expect(isEncircled(setup({ attackers: ring, defenders: [[2, 3]], king: [2, 2] }))).toBe(true);
  });

  it('is not detected when the ring has a gap', () => {
    const gapped = ring.filter(([r, c]) => !(r === 2 && c === 4));
    expect(isEncircled(setup({ attackers: gapped, defenders: [[2, 3]], king: [2, 2] }))).toBe(false);
  });
});
