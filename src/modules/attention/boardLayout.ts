/**
 * Flicker board geometry — framework-free so the layout bounds are unit-testable
 * without rendering, exactly as `ui/corsiLayout.ts` is and for the same reason:
 * on this board a mistimed or missed tap is not cosmetic, it is a wrong trial.
 *
 * The Corsi lesson applies directly. An unbounded `width:100%` grid overflows
 * wide desktop viewports and pushes cells off-screen where they cannot be
 * tapped, which silently corrupts the recorded result. The board therefore sizes
 * itself to *fit* the box it is given and never grows past `maxBoardSide`.
 */

import { hit } from '@/ui/tokens';

/** Upper bound on the board's long edge, so it stays tappable on large windows. */
export const FLICKER_MAX_BOARD_SIDE = 460;

/**
 * The largest square cell that fits a `cols × rows` grid inside the available
 * box, capped so the whole board never exceeds `maxBoardSide` on either axis.
 * Returns 0 for a not-yet-measured or degenerate box, so the caller can skip
 * rendering until a real size is known.
 */
export function flickerCellSide(
  availableWidth: number,
  availableHeight: number,
  cols: number,
  rows: number,
  maxBoardSide: number = FLICKER_MAX_BOARD_SIDE,
): number {
  if (cols <= 0 || rows <= 0) return 0;
  const side = Math.min(
    availableWidth / cols,
    availableHeight / rows,
    maxBoardSide / Math.max(cols, rows),
  );
  return Number.isFinite(side) && side > 0 ? side : 0;
}

/**
 * Whether a cell has been squeezed below the design system's minimum tap target
 * (DESIGN.md `hit.minTarget`).
 *
 * Fitting wins over the minimum when the box is genuinely too small — an
 * overflowing board hides cells completely, which is strictly worse than a small
 * one. This predicate exists so that state is visible rather than silent: the
 * board reports it, and it is asserted at the viewport sizes we care about.
 */
export function isBelowMinTapTarget(cellSide: number): boolean {
  return cellSide > 0 && cellSide < hit.minTarget;
}
