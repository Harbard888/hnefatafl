import type { Pos } from './types.js';

export type VariantId = 'copenhagen' | 'brandubh' | 'tablut';

type Coord = readonly [number, number];

export interface Variant {
  readonly id: VariantId;
  readonly size: number;
  readonly throne: Pos;
  /** `corner`: king must reach a corner. `edge`: any edge square wins. */
  readonly escape: 'corner' | 'edge';
  /** Corners may only be entered by the king and are hostile to everyone (otherwise they are ordinary squares). */
  readonly restrictedCorners: boolean;
  /**
   * `four-sides`: king needs four attackers (never captured on the edge).
   * `weak`: four sides on or next to the throne, otherwise two attackers on opposite sides.
   */
  readonly kingCapture: 'four-sides' | 'weak';
  /** Copenhagen-only extras: shield wall captures, exit forts and encirclement. */
  readonly extendedRules: boolean;
  readonly attackers: readonly Coord[];
  readonly defenders: readonly Coord[];
}

export const COPENHAGEN: Variant = {
  id: 'copenhagen',
  size: 11,
  throne: { row: 5, col: 5 },
  escape: 'corner',
  restrictedCorners: true,
  kingCapture: 'four-sides',
  extendedRules: true,
  attackers: [
    [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 5],
    [10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [9, 5],
    [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [5, 1],
    [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [5, 9],
  ],
  defenders: [
    [3, 5], [4, 4], [4, 5], [4, 6], [5, 3], [5, 4],
    [5, 6], [5, 7], [6, 4], [6, 5], [6, 6], [7, 5],
  ],
};

export const BRANDUBH: Variant = {
  id: 'brandubh',
  size: 7,
  throne: { row: 3, col: 3 },
  escape: 'corner',
  restrictedCorners: true,
  kingCapture: 'weak',
  extendedRules: false,
  attackers: [[0, 3], [1, 3], [6, 3], [5, 3], [3, 0], [3, 1], [3, 6], [3, 5]],
  defenders: [[2, 3], [4, 3], [3, 2], [3, 4]],
};

export const TABLUT: Variant = {
  id: 'tablut',
  size: 9,
  throne: { row: 4, col: 4 },
  escape: 'edge',
  restrictedCorners: false,
  kingCapture: 'weak',
  extendedRules: false,
  attackers: [
    [0, 3], [0, 4], [0, 5], [1, 4],
    [8, 3], [8, 4], [8, 5], [7, 4],
    [3, 0], [4, 0], [5, 0], [4, 1],
    [3, 8], [4, 8], [5, 8], [4, 7],
  ],
  defenders: [[2, 4], [3, 4], [5, 4], [6, 4], [4, 2], [4, 3], [4, 5], [4, 6]],
};

export const VARIANTS: Readonly<Record<VariantId, Variant>> = {
  copenhagen: COPENHAGEN,
  brandubh: BRANDUBH,
  tablut: TABLUT,
};

export const VARIANT_IDS: readonly VariantId[] = ['copenhagen', 'brandubh', 'tablut'];

export const DEFAULT_VARIANT: VariantId = 'copenhagen';

export function isVariantId(value: unknown): value is VariantId {
  return typeof value === 'string' && (VARIANT_IDS as readonly string[]).includes(value);
}

export function getVariant(id: VariantId = DEFAULT_VARIANT): Variant {
  return VARIANTS[id];
}
