import { describe, expect, it } from 'vitest';
import { chooseMove, DIFFICULTIES, isDifficulty, type Difficulty } from '../src/ai.js';
import type { Side } from '../src/types.js';
import { HnefataflGame } from '../src/game.js';
import { pos, setup } from './helpers.js';

function playGame(attacker: Difficulty, defender: Difficulty, maxMoves = 120): Side | 'draw' {
  const game = new HnefataflGame();
  for (let i = 0; i < maxMoves && game.status.kind === 'ongoing'; i++) {
    const level = game.turn === 'attacker' ? attacker : defender;
    const move = chooseMove(game, { difficulty: level, timeBudgetMs: 150 });
    if (move === null) break;
    game.move(move.from, move.to);
  }
  return game.status.kind === 'won' ? game.status.winner : 'draw';
}

describe('difficulty', () => {
  it('exposes the difficulty levels and a type guard', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('impossible')).toBe(false);
  });

  it('returns a legal move within a sane time at every level', () => {
    for (const difficulty of DIFFICULTIES) {
      const game = new HnefataflGame();
      const start = Date.now();
      const move = chooseMove(game, { difficulty, timeBudgetMs: 200 });
      expect(Date.now() - start).toBeLessThan(2000);
      expect(game.legalMoves()).toContainEqual(move);
    }
  });

  it('easy can blunder into a random move', () => {
    const game = new HnefataflGame({
      board: setup({ attackers: [[9, 9], [7, 7]], king: [2, 0] }),
      turn: 'defender',
    });
    const move = chooseMove(game, { difficulty: 'easy', random: () => 0 });
    expect(move).toEqual(game.legalMoves()[0]);
  });

  it('hard beats easy in self-play from both sides', () => {
    const results = [playGame('easy', 'hard'), playGame('hard', 'easy')];
    const hardWins = (results[0] === 'defender' ? 1 : 0) + (results[1] === 'attacker' ? 1 : 0);
    expect(hardWins).toBeGreaterThanOrEqual(1);
    expect(results[0] === 'attacker' && results[1] === 'defender').toBe(false);
  }, 120_000);
});

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
