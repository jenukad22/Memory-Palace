import { nextDifficulty } from '@/engine';

/**
 * Session-difficulty mapping for the memory trainers (SPEC.md §4). The engine's
 * `nextDifficulty` staircase owns the adaptation; this module maps its [0,1]
 * output onto concrete session parameters. Difficulty is a session knob only —
 * it never changes what a score means (CLAUDE.md).
 */

/** Starting point before any history exists, and the reference the staircase nudges from. */
export const BASELINE_DIFFICULTY = 0.5;

export const MIN_PALACE_ITEMS = 3;
export const MIN_PAO_NUMBERS = 2;
export const MAX_PAO_NUMBERS = 6;
export const PAO_EXPOSURE_MIN_MS = 2000;
export const PAO_EXPOSURE_MAX_MS = 4000;

/** Next session's difficulty in [0,1] from the module's recent recall accuracy. */
export function sessionDifficulty(rollingAccuracy: number | null): number {
  if (rollingAccuracy === null) return BASELINE_DIFFICULTY;
  return nextDifficulty(BASELINE_DIFFICULTY, rollingAccuracy);
}

/**
 * How many items to place this session: from MIN_PALACE_ITEMS up to the number
 * of loci available, scaled by difficulty. Never exceeds the route length.
 */
export function palaceListLength(difficulty: number, lociCount: number): number {
  const cap = Math.max(MIN_PALACE_ITEMS, lociCount);
  const span = cap - MIN_PALACE_ITEMS;
  const length = Math.round(MIN_PALACE_ITEMS + clamp01(difficulty) * span);
  return Math.min(length, lociCount);
}

/** How many 6-digit numbers, and how long to expose each before hiding. */
export function paoDrillParams(difficulty: number): { count: number; exposureMs: number } {
  const d = clamp01(difficulty);
  const count = Math.round(MIN_PAO_NUMBERS + d * (MAX_PAO_NUMBERS - MIN_PAO_NUMBERS));
  // Harder = shorter exposure.
  const exposureMs = Math.round(
    PAO_EXPOSURE_MAX_MS - d * (PAO_EXPOSURE_MAX_MS - PAO_EXPOSURE_MIN_MS),
  );
  return { count, exposureMs };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
