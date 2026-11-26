import {
  at,
  findKing,
  inBounds,
  isCorner,
  isEdge,
  isThrone,
  keyOf,
  offset,
  ORTHOGONAL,
  positionsOf,
  sideOf,
} from './board.js';
import { BOARD_SIZE, type Board, type Dir, type Piece, type Pos, type Side } from './types.js';

const LAST = BOARD_SIZE - 1;

export function opposite(side: Side): Side {
  return side === 'attacker' ? 'defender' : 'attacker';
}

function isFriendly(board: Board, pos: Pos, side: Side): boolean {
  if (!inBounds(pos)) return false;
  const piece = at(board, pos);
  return piece !== null && sideOf(piece) === side;
}

/** Corners are hostile to everyone; the throne is hostile to attackers always and to defenders only when empty. */
function isHostileTo(board: Board, pos: Pos, side: Side): boolean {
  if (isCorner(pos)) return true;
  if (isThrone(pos)) return side === 'attacker' || at(board, pos) === null;
  return false;
}

function canStopOn(piece: Piece, pos: Pos): boolean {
  if (piece === 'king') return true;
  return !isThrone(pos) && !isCorner(pos);
}

/** Rook-style destinations. Soldiers may slide across the empty throne but never stop on it. */
export function legalDestinations(board: Board, from: Pos): Pos[] {
  const piece = at(board, from);
  if (piece === null) return [];

  const destinations: Pos[] = [];
  for (const dir of ORTHOGONAL) {
    let pos = offset(from, dir);
    while (inBounds(pos) && at(board, pos) === null) {
      if (canStopOn(piece, pos)) destinations.push(pos);
      pos = offset(pos, dir);
    }
  }
  return destinations;
}

/** Soldier sandwiched between the moved piece and a friendly piece or hostile square. The king is never captured this way. */
function custodialCaptures(board: Board, to: Pos, mover: Side): Pos[] {
  const captured: Pos[] = [];
  const enemy = opposite(mover);
  for (const dir of ORTHOGONAL) {
    const target = offset(to, dir);
    const anchor = offset(target, dir);
    if (!inBounds(target) || !inBounds(anchor)) continue;
    if (at(board, target) !== enemy) continue;
    if (isFriendly(board, anchor, mover) || isHostileTo(board, anchor, enemy)) captured.push(target);
  }
  return captured;
}

/** Shield wall: a run of two or more enemy soldiers on the edge, closed at one end by the moved piece (or a corner or friendly piece at the other), each with a friendly piece directly inward. */
function shieldwallCaptures(board: Board, to: Pos, mover: Side): Pos[] {
  if (!isEdge(to)) return [];

  const enemy = opposite(mover);
  const along: Dir[] = to.row === 0 || to.row === LAST
    ? [{ row: 0, col: 1 }, { row: 0, col: -1 }]
    : [{ row: 1, col: 0 }, { row: -1, col: 0 }];
  const inward: Dir = to.row === 0 ? { row: 1, col: 0 }
    : to.row === LAST ? { row: -1, col: 0 }
    : to.col === 0 ? { row: 0, col: 1 }
    : { row: 0, col: -1 };

  const captured: Pos[] = [];
  for (const dir of along) {
    const run: Pos[] = [];
    let pos = offset(to, dir);
    while (inBounds(pos) && at(board, pos) === enemy) {
      run.push(pos);
      pos = offset(pos, dir);
    }
    if (run.length < 2) continue;

    const closed = isCorner(pos) || isFriendly(board, pos, mover);
    const fronted = run.every((soldier) => isFriendly(board, offset(soldier, inward), mover));
    if (closed && fronted) captured.push(...run);
  }
  return captured;
}

/** Call after the moved piece has been placed on `to`. */
export function capturesAfterMove(board: Board, to: Pos, mover: Side): Pos[] {
  const unique = new Map<string, Pos>();
  for (const pos of [...custodialCaptures(board, to, mover), ...shieldwallCaptures(board, to, mover)]) {
    unique.set(keyOf(pos), pos);
  }
  return [...unique.values()];
}

/** The king is never captured on the edge. Next to an empty throne, the throne counts as the fourth attacker side. */
export function isKingCaptured(board: Board): boolean {
  const king = findKing(board);
  if (king === null || isEdge(king)) return false;

  return ORTHOGONAL.every((dir) => {
    const neighbour = offset(king, dir);
    return at(board, neighbour) === 'attacker'
      || (isThrone(neighbour) && at(board, neighbour) === null);
  });
}

/** Flood fill from all defenders through non-attacker squares. Encircled if the fill never reaches the edge. */
export function isEncircled(board: Board): boolean {
  const seen = new Set<string>();
  const stack: Pos[] = [];
  for (const pos of positionsOf(board, 'defender')) {
    seen.add(keyOf(pos));
    stack.push(pos);
  }

  while (stack.length > 0) {
    const pos = stack.pop()!;
    if (isEdge(pos)) return false;
    for (const dir of ORTHOGONAL) {
      const next = offset(pos, dir);
      if (!inBounds(next) || at(board, next) === 'attacker' || seen.has(keyOf(next))) continue;
      seen.add(keyOf(next));
      stack.push(next);
    }
  }
  return true;
}

export function hasLegalMoves(board: Board, side: Side): boolean {
  return positionsOf(board, side).some((from) => legalDestinations(board, from).length > 0);
}
