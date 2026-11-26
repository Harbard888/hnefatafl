import type { GameView, MoveRecord, Pos } from './api';

export function key(pos: Pos): string {
  return `${pos.row},${pos.col}`;
}

/** Moves recorded by one server response (the player's move and an optional computer reply). */
export function movesOf(view: GameView): MoveRecord[] {
  return [view.playerMove, view.computerMove].filter((m): m is MoveRecord => m !== null);
}

export function describeMove(move: MoveRecord): string {
  const captures = move.captured?.length ? ` ×${move.captured.length}` : '';
  return `${key(move.from)} → ${key(move.to)}${captures}`;
}

export interface Highlights {
  last: Set<string>;
  captured: Set<string>;
}

export function highlightsFor(batch: MoveRecord[]): Highlights {
  const last = new Set<string>();
  const captured = new Set<string>();
  const final = batch[batch.length - 1];
  if (final) {
    last.add(key(final.from));
    last.add(key(final.to));
  }
  for (const move of batch) for (const pos of move.captured ?? []) captured.add(key(pos));
  return { last, captured };
}
