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
import type { Board, Dir, Piece, Pos, Side } from './types.js';
import { COPENHAGEN, type Variant } from './variants.js';

export function opposite(side: Side): Side {
  return side === 'attacker' ? 'defender' : 'attacker';
}

function isFriendly(board: Board, pos: Pos, side: Side, v: Variant): boolean {
  if (!inBounds(pos, v)) return false;
  const piece = at(board, pos);
  return piece !== null && sideOf(piece) === side;
}

/** Restricted corners are hostile to everyone; the throne is hostile to attackers always and to defenders only when empty. */
function isHostileTo(board: Board, pos: Pos, side: Side, v: Variant): boolean {
  if (v.restrictedCorners && isCorner(pos, v)) return true;
  if (isThrone(pos, v)) return side === 'attacker' || at(board, pos) === null;
  return false;
}

function canStopOn(piece: Piece, pos: Pos, v: Variant): boolean {
  if (piece === 'king') return true;
  return !isThrone(pos, v) && !(v.restrictedCorners && isCorner(pos, v));
}

/** Rook-style destinations. Soldiers may slide across the empty throne but never stop on it. */
export function legalDestinations(board: Board, from: Pos, v: Variant = COPENHAGEN): Pos[] {
  const piece = at(board, from);
  if (piece === null) return [];

  const destinations: Pos[] = [];
  for (const dir of ORTHOGONAL) {
    let pos = offset(from, dir);
    while (inBounds(pos, v) && at(board, pos) === null) {
      if (canStopOn(piece, pos, v)) destinations.push(pos);
      pos = offset(pos, dir);
    }
  }
  return destinations;
}

/** Soldier sandwiched between the moved piece and a friendly piece or hostile square. The king is never captured this way. */
function custodialCaptures(board: Board, to: Pos, mover: Side, v: Variant): Pos[] {
  const captured: Pos[] = [];
  const enemy = opposite(mover);
  for (const dir of ORTHOGONAL) {
    const target = offset(to, dir);
    const anchor = offset(target, dir);
    if (!inBounds(target, v) || !inBounds(anchor, v)) continue;
    if (at(board, target) !== enemy) continue;
    if (isFriendly(board, anchor, mover, v) || isHostileTo(board, anchor, enemy, v)) captured.push(target);
  }
  return captured;
}

/** Shield wall: a run of two or more enemy soldiers on the edge, closed at one end by the moved piece (or a corner or friendly piece at the other), each with a friendly piece directly inward. */
function shieldwallCaptures(board: Board, to: Pos, mover: Side, v: Variant): Pos[] {
  if (!v.extendedRules || !isEdge(to, v)) return [];

  const last = v.size - 1;
  const enemy = opposite(mover);
  const along: Dir[] = to.row === 0 || to.row === last
    ? [{ row: 0, col: 1 }, { row: 0, col: -1 }]
    : [{ row: 1, col: 0 }, { row: -1, col: 0 }];
  const inward: Dir = to.row === 0 ? { row: 1, col: 0 }
    : to.row === last ? { row: -1, col: 0 }
    : to.col === 0 ? { row: 0, col: 1 }
    : { row: 0, col: -1 };

  const captured: Pos[] = [];
  for (const dir of along) {
    const run: Pos[] = [];
    let pos = offset(to, dir);
    while (inBounds(pos, v) && at(board, pos) === enemy) {
      run.push(pos);
      pos = offset(pos, dir);
    }
    if (run.length < 2) continue;

    const closed = isCorner(pos, v) || isFriendly(board, pos, mover, v);
    const fronted = run.every((soldier) => isFriendly(board, offset(soldier, inward), mover, v));
    if (closed && fronted) captured.push(...run);
  }
  return captured;
}

/** Call after the moved piece has been placed on `to`. */
export function capturesAfterMove(board: Board, to: Pos, mover: Side, v: Variant = COPENHAGEN): Pos[] {
  const unique = new Map<string, Pos>();
  for (const pos of [...custodialCaptures(board, to, mover, v), ...shieldwallCaptures(board, to, mover, v)]) {
    unique.set(keyOf(pos), pos);
  }
  return [...unique.values()];
}

/**
 * Four-sides variants: the king is never captured on the edge; next to an empty throne, the throne counts as the fourth attacker side.
 * Weak-king variants: four sides on or next to the throne, otherwise two attackers (or hostile squares) on opposite sides.
 */
export function isKingCaptured(board: Board, v: Variant = COPENHAGEN): boolean {
  const king = findKing(board);
  if (king === null) return false;

  if (v.kingCapture === 'four-sides') {
    if (isEdge(king, v)) return false;
    return ORTHOGONAL.every((dir) => {
      const neighbour = offset(king, dir);
      return at(board, neighbour) === 'attacker'
        || (isThrone(neighbour, v) && at(board, neighbour) === null);
    });
  }

  const hostile = (pos: Pos): boolean =>
    inBounds(pos, v) && (at(board, pos) === 'attacker' || isHostileTo(board, pos, 'defender', v));
  const nearThrone = Math.abs(king.row - v.throne.row) + Math.abs(king.col - v.throne.col) <= 1;
  if (nearThrone) return ORTHOGONAL.every((dir) => hostile(offset(king, dir)));
  return [[ORTHOGONAL[0], ORTHOGONAL[1]], [ORTHOGONAL[2], ORTHOGONAL[3]]].some(
    ([a, b]) => hostile(offset(king, a)) && hostile(offset(king, b)),
  );
}

/**
 * Exit fort: the king stands on the edge and can move, and the empty squares it can reach are sealed off
 * from attackers by defenders and the board edge, with no sealing defender capturable.
 */
export function hasExitFort(board: Board, v: Variant = COPENHAGEN): boolean {
  if (!v.extendedRules) return false;
  const king = findKing(board);
  if (king === null || !isEdge(king, v) || legalDestinations(board, king, v).length === 0) return false;

  const region = new Map<string, Pos>([[keyOf(king), king]]);
  const wall = new Map<string, Pos>();
  const stack: Pos[] = [king];
  while (stack.length > 0) {
    const pos = stack.pop()!;
    for (const dir of ORTHOGONAL) {
      const next = offset(pos, dir);
      if (!inBounds(next, v) || region.has(keyOf(next))) continue;
      const piece = at(board, next);
      if (piece === 'attacker') return false;
      if (piece === 'defender') wall.set(keyOf(next), next);
      else if (isCorner(next, v)) return false;
      else {
        region.set(keyOf(next), next);
        stack.push(next);
      }
    }
  }

  // A neighbour protects a defender on an axis if attackers can never occupy it or turn it hostile.
  const protects = (pos: Pos): boolean => {
    if (!inBounds(pos, v)) return true;
    if (region.has(keyOf(pos)) && !isThrone(pos, v)) return true;
    return wall.has(keyOf(pos)) || at(board, pos) === 'king';
  };
  return [...wall.values()].every((soldier) =>
    [[{ row: 0, col: 1 }, { row: 0, col: -1 }], [{ row: 1, col: 0 }, { row: -1, col: 0 }]].every(
      (axis) => axis.some((dir) => protects(offset(soldier, dir))),
    ),
  );
}

/** Flood fill from all defenders through non-attacker squares. Encircled if the fill never reaches the edge. */
export function isEncircled(board: Board, v: Variant = COPENHAGEN): boolean {
  if (!v.extendedRules) return false;
  const seen = new Set<string>();
  const stack: Pos[] = [];
  for (const pos of positionsOf(board, 'defender')) {
    seen.add(keyOf(pos));
    stack.push(pos);
  }

  while (stack.length > 0) {
    const pos = stack.pop()!;
    if (isEdge(pos, v)) return false;
    for (const dir of ORTHOGONAL) {
      const next = offset(pos, dir);
      if (!inBounds(next, v) || at(board, next) === 'attacker' || seen.has(keyOf(next))) continue;
      seen.add(keyOf(next));
      stack.push(next);
    }
  }
  return true;
}

export function hasLegalMoves(board: Board, side: Side, v: Variant = COPENHAGEN): boolean {
  return positionsOf(board, side).some((from) => legalDestinations(board, from, v).length > 0);
}
