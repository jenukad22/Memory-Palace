/**
 * Corsi board geometry and sizing (DESIGN.md sec 2.7) — framework-free so the
 * layout bounds are unit-testable without rendering (CorsiBoard.tsx itself
 * pulls in React Native and can't be imported under plain Vitest/Node).
 *
 * The coordinates are normalized to a unit square; the board renders them into
 * a *bounded* square whose side is `corsiBoardSide(...)`, never a fixed pixel
 * size. This is what keeps all 9 blocks on-screen and tappable at any width:
 * an unbounded `width:100%` + `aspectRatio:1` board overflows the viewport on
 * wide desktop layouts, pushing lower blocks off-screen where they can't be
 * tapped — which would corrupt the recorded span (see CorsiScreen).
 */

export interface NormalizedBlock {
  x: number;
  y: number;
}

/** Fixed normalized top-left coordinates of the 9 blocks (DESIGN.md sec 2.7). */
export const CORSI_BLOCKS: readonly NormalizedBlock[] = [
  { x: 0.06, y: 0.58 },
  { x: 0.26, y: 0.12 },
  { x: 0.28, y: 0.76 },
  { x: 0.42, y: 0.4 },
  { x: 0.55, y: 0.06 },
  { x: 0.6, y: 0.68 },
  { x: 0.72, y: 0.3 },
  { x: 0.82, y: 0.56 },
  { x: 0.06, y: 0.26 },
];

/** Block edge length as a fraction of the board side (DESIGN.md sec 2.7). */
export const CORSI_BLOCK_SIZE = 0.18;

/**
 * Upper bound on the board side in px. Beyond this the board stops growing so it
 * stays a comfortable tap target on large desktop windows rather than filling
 * the whole viewport.
 */
export const CORSI_MAX_SIDE = 420;

/**
 * The board's rendered side: a square that fits inside the available box
 * (min of width and height) and never exceeds `maxSide`. Returns 0 for a
 * not-yet-measured / degenerate box so the caller can skip rendering until a
 * real size is known.
 */
export function corsiBoardSide(
  availableWidth: number,
  availableHeight: number,
  maxSide: number = CORSI_MAX_SIDE,
): number {
  const side = Math.min(availableWidth, availableHeight, maxSide);
  return Number.isFinite(side) && side > 0 ? side : 0;
}
