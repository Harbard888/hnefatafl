import { describe, expect, it } from 'vitest';
import { HnefataflGame } from '../src/game.js';
import { pos, setup } from './helpers.js';

describe('turn order', () => {
  it('starts with attackers and alternates turns', () => {
    const game = new HnefataflGame();
    expect(game.turn).toBe('attacker');

    game.move(pos(0, 3), pos(0, 2));
    expect(game.turn).toBe('defender');
    expect(() => game.move(pos(0, 2), pos(0, 1))).toThrow('No defender piece');
  });

  it('rejects moves that are not straight lines', () => {
    const game = new HnefataflGame();
    expect(() => game.move(pos(0, 3), pos(1, 2))).toThrow('Illegal move');
  });
});

describe('game endings', () => {
  it('defenders win when the king reaches a corner', () => {
    const game = new HnefataflGame({
      board: setup({ attackers: [[9, 9]], king: [2, 0] }),
      turn: 'defender',
    });
    game.move(pos(2, 0), pos(0, 0));
    expect(game.status).toEqual({ kind: 'won', winner: 'defender', reason: 'king-escaped' });
  });

  it('attackers win when the king is captured', () => {
    const game = new HnefataflGame({
      board: setup({ attackers: [[1, 5], [3, 5], [2, 4], [2, 9]], king: [2, 5] }),
      turn: 'attacker',
    });
    game.move(pos(2, 9), pos(2, 6));
    expect(game.status).toEqual({ kind: 'won', winner: 'attacker', reason: 'king-captured' });
  });

  it('the side without a legal move loses', () => {
    const game = new HnefataflGame({
      board: setup({ attackers: [[0, 1]], defenders: [[1, 1], [0, 2]], king: [5, 5] }),
      turn: 'defender',
    });
    game.move(pos(5, 5), pos(5, 4));
    expect(game.status).toEqual({ kind: 'won', winner: 'defender', reason: 'no-legal-moves' });
  });

  it('forbids a move that repeats a position for the third time', () => {
    const game = new HnefataflGame();
    const shuffle = [
      [pos(0, 3), pos(0, 2)],
      [pos(3, 5), pos(3, 4)],
      [pos(0, 2), pos(0, 3)],
      [pos(3, 4), pos(3, 5)],
    ] as const;

    for (const [from, to] of [...shuffle, ...shuffle.slice(0, 3)]) game.move(from, to);
    expect(game.status).toEqual({ kind: 'ongoing' });

    const [from, to] = shuffle[3];
    expect(game.legalMoves()).not.toContainEqual({ from, to });
    expect(() => game.move(from, to)).toThrow('third time');
    expect(game.status).toEqual({ kind: 'ongoing' });
  });
});
