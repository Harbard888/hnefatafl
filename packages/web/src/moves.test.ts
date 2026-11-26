import { describe, expect, it } from 'vitest';
import type { MoveRecord } from './api';
import { describeMove, highlightsFor, specialSquares } from './moves';

const move = (captured: MoveRecord['captured']): MoveRecord => ({
  side: 'attacker',
  from: { row: 0, col: 3 },
  to: { row: 0, col: 4 },
  captured,
});

describe('describeMove', () => {
  it('shows capture count only when pieces were captured', () => {
    expect(describeMove(move([]))).toBe('0,3 → 0,4');
    expect(describeMove(move([{ row: 1, col: 4 }, { row: 0, col: 5 }]))).toBe('0,3 → 0,4 ×2');
  });
});

describe('highlightsFor', () => {
  it('marks the last move and all captured squares of the batch', () => {
    const first = move([{ row: 1, col: 4 }]);
    const second = { ...move([{ row: 2, col: 2 }]), from: { row: 5, col: 5 }, to: { row: 5, col: 6 } };
    const h = highlightsFor([first, second]);
    expect([...h.last]).toEqual(['5,5', '5,6']);
    expect([...h.captured].sort()).toEqual(['1,4', '2,2']);
  });

  it('is empty without moves', () => {
    expect(highlightsFor([])).toEqual({ last: new Set(), captured: new Set() });
  });
});

describe('specialSquares', () => {
  it('puts the throne in the centre and restricts corners per variant', () => {
    expect(specialSquares(11)).toEqual({ throne: { row: 5, col: 5 }, corners: new Set(['0,0', '0,10', '10,0', '10,10']) });
    expect(specialSquares(7, 'brandubh').throne).toEqual({ row: 3, col: 3 });
    expect(specialSquares(7, 'brandubh').corners.has('6,6')).toBe(true);
    expect(specialSquares(9, 'tablut').throne).toEqual({ row: 4, col: 4 });
    expect(specialSquares(9, 'tablut').corners.size).toBe(0);
  });
});
