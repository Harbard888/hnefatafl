import { describe, expect, it } from 'vitest';
import { chooseMove } from '../src/ai.js';
import { HnefataflGame } from '../src/game.js';
import { pos, setup } from './helpers.js';

describe('chooseMove', () => {
  it('lets the defenders take an immediate escape to a corner', () => {
    const game = new HnefataflGame({
      board: setup({ attackers: [[9, 9], [7, 7]], king: [2, 0] }),
      turn: 'defender',
    });
    expect(chooseMove(game)).toEqual({ from: pos(2, 0), to: pos(0, 0) });
  });

  it('lets the attackers take an immediate king capture', () => {
    const game = new HnefataflGame({
      board: setup({ attackers: [[1, 5], [3, 5], [2, 4], [2, 9]], king: [2, 5] }),
      turn: 'attacker',
    });
    expect(chooseMove(game)).toEqual({ from: pos(2, 9), to: pos(2, 6) });
  });
});
