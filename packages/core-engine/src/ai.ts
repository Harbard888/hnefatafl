import { cornersOf, findKing } from './board.js';
import { HnefataflGame } from './game.js';
import type { Board, Move, Pos } from './types.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

export interface DifficultyProfile {
  /** Maximum search depth in plies. */
  readonly maxDepth: number;
  /** Wall-clock budget per move in milliseconds; deeper iterations are abandoned when exceeded. */
  readonly timeBudgetMs: number;
  /** Probability of playing a uniformly random legal move. */
  readonly blunderRate: number;
  /** When > 0, moves scoring within this margin of the best may be picked at random (adds variety). */
  readonly randomMargin: number;
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = {
  easy: { maxDepth: 1, timeBudgetMs: 100, blunderRate: 0.3, randomMargin: 6 },
  medium: { maxDepth: 2, timeBudgetMs: 500, blunderRate: 0, randomMargin: 0 },
  hard: { maxDepth: 4, timeBudgetMs: 1500, blunderRate: 0, randomMargin: 0 },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

export interface AiOptions {
  /** Preset strength. Defaults to `medium`. */
  readonly difficulty?: Difficulty;
  /** Overrides the difficulty's maximum search depth. */
  readonly depth?: number;
  /** Overrides the difficulty's per-move time budget (ms). */
  readonly timeBudgetMs?: number;
  /** Random source in [0, 1); injectable for deterministic tests. */
  readonly random?: () => number;
}

const WIN_SCORE = 100_000;

class Timeout extends Error {}

function cloneGame(game: HnefataflGame): HnefataflGame {
  return new HnefataflGame({ board: game.getBoard(), turn: game.turn, variant: game.variant });
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

const DIRS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

// Walks from the king until blocked; reports whether the edge was reached and whether it ended on a corner.
function ray(board: Board, king: Pos, dir: { row: number; col: number }, restrictedCorners: boolean): { edge: boolean; corner: boolean } {
  const last = board.length - 1;
  let row = king.row + dir.row;
  let col = king.col + dir.col;
  while (row >= 0 && col >= 0 && row <= last && col <= last) {
    if (board[row][col] !== null) return { edge: false, corner: false };
    const onRowEdge = row === 0 || row === last;
    const onColEdge = col === 0 || col === last;
    if (onRowEdge && onColEdge) return { edge: true, corner: restrictedCorners };
    if (onRowEdge || onColEdge) return { edge: true, corner: false };
    row += dir.row;
    col += dir.col;
  }
  return { edge: false, corner: false };
}

// Scores from the defenders' perspective: positive favours defenders, negative favours attackers.
function evaluate(game: HnefataflGame): number {
  const board = game.getBoard();
  const variant = game.variant;
  const last = variant.size - 1;
  let attackers = 0;
  let defenders = 0;
  let king: Pos | null = null;

  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const square = board[r][c];
      if (square === 'attacker') attackers++;
      else if (square === 'defender') defenders++;
      else if (square === 'king') king = { row: r, col: c };
    }
  }

  let score = 12 * defenders - 8 * attackers;
  if (king === null) return score;

  const kingPos: Pos = king;
  const cornerEscape = variant.escape === 'corner';
  if (cornerEscape) {
    const nearestCorner = Math.min(...cornersOf(variant).map((corner) => manhattan(kingPos, corner)));
    score += (2 * last - nearestCorner) * 2;
  } else {
    const edgeDistance = Math.min(kingPos.row, kingPos.col, last - kingPos.row, last - kingPos.col);
    score += (last / 2 - edgeDistance) * 8;
  }

  let cornerLines = 0;
  let edgeLines = 0;
  let adjacentAttackers = 0;
  for (const dir of DIRS) {
    const result = ray(board, kingPos, dir, variant.restrictedCorners);
    if (result.corner && cornerEscape) cornerLines++;
    else if (result.edge && cornerEscape) edgeLines++;
    else if (result.edge) cornerLines++;
    if (board[kingPos.row + dir.row]?.[kingPos.col + dir.col] === 'attacker') adjacentAttackers++;
  }

  // Two simultaneous corner lines cannot both be blocked in one move.
  score += cornerLines >= 2 ? 5000 : cornerLines * 300;
  score += edgeLines * 25;
  score -= adjacentAttackers * 15;
  return score;
}

interface SearchContext {
  readonly deadline: number;
  nodes: number;
}

function checkTime(ctx: SearchContext): void {
  if ((++ctx.nodes & 63) === 0 && Date.now() > ctx.deadline) throw new Timeout();
}

function sameMove(a: Move | null, b: Move): boolean {
  return a !== null && a.from.row === b.from.row && a.from.col === b.from.col &&
    a.to.row === b.to.row && a.to.col === b.to.col;
}

// Orders likely-strong moves first so alpha-beta prunes more: the previous best, then king moves, then moves near the king.
function orderMoves(game: HnefataflGame, moves: Move[], preferred: Move | null): Move[] {
  const king = findKing(game.getBoard());
  const defending = game.turn === 'defender';
  const cornerEscape = game.variant.escape === 'corner';
  const priority = (move: Move): number => {
    if (sameMove(preferred, move)) return -1e9;
    if (king === null) return 0;
    if (move.from.row === king.row && move.from.col === king.col) {
      const best = cornerEscape
        ? Math.min(...cornersOf(game.variant).map((c) => manhattan(move.to, c)))
        : Math.min(move.to.row, move.to.col, game.variant.size - 1 - move.to.row, game.variant.size - 1 - move.to.col);
      return defending ? best - 100 : best;
    }
    return manhattan(move.to, king);
  };
  return moves
    .map((move) => ({ move, key: priority(move) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.move);
}

function search(
  game: HnefataflGame,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchContext,
): number {
  checkTime(ctx);
  const status = game.status;
  if (status.kind === 'won') {
    const magnitude = WIN_SCORE - ply;
    return status.winner === 'defender' ? magnitude : -magnitude;
  }
  if (depth === 0) return evaluate(game);

  const maximising = game.turn === 'defender';
  let best = maximising ? -Infinity : Infinity;
  for (const move of orderMoves(game, game.legalMoves(), null)) {
    const child = cloneGame(game);
    child.move(move.from, move.to);
    const score = search(child, depth - 1, alpha, beta, ply + 1, ctx);
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

interface Scored {
  readonly move: Move;
  readonly score: number;
}

// With `exact`, every root move gets a full-window score (needed for randomising among near-best moves).
function searchRoot(
  game: HnefataflGame,
  depth: number,
  ctx: SearchContext,
  preferred: Move | null,
  exact: boolean,
): Scored[] {
  const maximising = game.turn === 'defender';
  const scored: Scored[] = [];
  let alpha = -Infinity;
  let beta = Infinity;
  for (const move of orderMoves(game, game.legalMoves(), preferred)) {
    const child = cloneGame(game);
    child.move(move.from, move.to);
    const score = search(child, depth - 1, alpha, beta, 1, ctx);
    scored.push({ move, score });
    if (exact) continue;
    if (maximising) alpha = Math.max(alpha, score);
    else beta = Math.min(beta, score);
  }
  return scored;
}

/**
 * Picks a move for the side to move using iterative-deepening alpha-beta search
 * bounded by the difficulty's depth and time budget.
 * Returns null when the game is already over.
 * The search does not consider earlier positions, so it cannot see repetition draws.
 */
export function chooseMove(game: HnefataflGame, options: AiOptions = {}): Move | null {
  if (game.status.kind !== 'ongoing') return null;

  const profile = DIFFICULTY_PROFILES[options.difficulty ?? DEFAULT_DIFFICULTY];
  const maxDepth = Math.max(1, options.depth ?? profile.maxDepth);
  const budget = options.timeBudgetMs ?? profile.timeBudgetMs;
  const random = options.random ?? Math.random;

  const moves = game.legalMoves();
  if (moves.length === 0) return null;
  if (profile.blunderRate > 0 && random() < profile.blunderRate) {
    return moves[Math.floor(random() * moves.length)];
  }

  const maximising = game.turn === 'defender';
  const better = (a: Scored, b: Scored): Scored => ((maximising ? b.score > a.score : b.score < a.score) ? b : a);
  const exact = profile.randomMargin > 0;
  const ctx: SearchContext = { deadline: Date.now() + budget, nodes: 0 };
  let result: Scored[] = [];
  let preferred: Move | null = null;

  // Depth 1 always completes so a move is available even with a tiny budget.
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      const scored = searchRoot(game, depth, depth === 1 ? { deadline: Infinity, nodes: 0 } : ctx, preferred, exact);
      result = scored;
      const best = scored.reduce(better);
      preferred = best.move;
      if (Math.abs(best.score) > WIN_SCORE / 2) break;
    } catch (error) {
      if (error instanceof Timeout) break;
      throw error;
    }
  }

  const best = result.reduce(better);
  if (exact) {
    const near = result.filter((entry) => Math.abs(entry.score - best.score) <= profile.randomMargin);
    return near[Math.floor(random() * near.length)].move;
  }
  return best.move;
}

