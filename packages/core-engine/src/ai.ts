import { CORNERS } from './board.js';
import { HnefataflGame } from './game.js';
import type { Move } from './types.js';

export interface AiOptions {
  readonly depth?: number;
}

const WIN_SCORE = 100_000;
const DEFAULT_DEPTH = 2;

function cloneGame(game: HnefataflGame): HnefataflGame {
  return new HnefataflGame({ board: game.getBoard(), turn: game.turn });
}

function manhattan(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

// Scores from the defenders' perspective: positive favours defenders, negative favours attackers.
function evaluate(game: HnefataflGame): number {
  let attackers = 0;
  let defenders = 0;
  let king: { row: number; col: number } | null = null;

  const board = game.getBoard();
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const square = board[r][c];
      if (square === 'attacker') attackers++;
      else if (square === 'defender') defenders++;
      else if (square === 'king') king = { row: r, col: c };
    }
  }

  let score = 10 * defenders - 10 * attackers;
  if (king !== null) {
    const kingPos: { row: number; col: number } = king;
    const nearestCorner = Math.min(...CORNERS.map((corner) => manhattan(kingPos, corner)));
    score += (20 - nearestCorner) * 3;
  }
  return score;
}

function search(game: HnefataflGame, depth: number, alpha: number, beta: number, ply: number): number {
  const status = game.status;
  if (status.kind === 'won') {
    const magnitude = WIN_SCORE - ply;
    return status.winner === 'defender' ? magnitude : -magnitude;
  }
  if (depth === 0) return evaluate(game);

  const maximising = game.turn === 'defender';
  let best = maximising ? -Infinity : Infinity;
  for (const move of game.legalMoves()) {
    const child = cloneGame(game);
    child.move(move.from, move.to);
    const score = search(child, depth - 1, alpha, beta, ply + 1);
    if (maximising) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Picks a move for the side to move using alpha-beta search.
 * Returns null when the game is already over.
 * The search does not consider earlier positions, so it cannot see repetition draws.
 */
export function chooseMove(game: HnefataflGame, options: AiOptions = {}): Move | null {
  if (game.status.kind !== 'ongoing') return null;

  const depth = Math.max(1, options.depth ?? DEFAULT_DEPTH);
  const maximising = game.turn === 'defender';
  let bestMove: Move | null = null;
  let bestScore = maximising ? -Infinity : Infinity;

  for (const move of game.legalMoves()) {
    const child = cloneGame(game);
    child.move(move.from, move.to);
    const score = search(child, depth - 1, -Infinity, Infinity, 1);
    if (maximising ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
