/**
 * Seeds a module's starting Elo from its instruments' normalized scores, and
 * exposes the provisional-K schedule for early training (SPEC.md sec 2.3).
 */

import { DEFAULT_K_FACTOR } from '../elo';

export const ELO_MIDPOINT = 1200;
export const ELO_PER_SD = 200;
export const ELO_MIN = 400;
export const ELO_MAX = 2400;

export const K_PROVISIONAL = 48;
export const PROVISIONAL_ITEMS = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Map a normalized score to Elo: midpoint + z·spread, clamped to [ELO_MIN, ELO_MAX]. */
export function eloFromNormalized(z: number): number {
  return clamp(ELO_MIDPOINT + z * ELO_PER_SD, ELO_MIN, ELO_MAX);
}

/** Equal-weight mean of a module's instrument normalized scores. */
export function moduleMean(scores: number[]): number {
  if (scores.length === 0) {
    throw new RangeError('moduleMean requires at least one score');
  }
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Starting Elo for a module: Elo of the equal-weight mean of its instrument scores. */
export function seedModuleElo(normalizedScores: number[]): number {
  return eloFromNormalized(moduleMean(normalizedScores));
}

/**
 * K-factor schedule: the higher provisional K for the first PROVISIONAL_ITEMS
 * rated items in a module (baseline seeds are uncertain), then the stable K.
 */
export function provisionalK(ratedItemCount: number): number {
  return ratedItemCount < PROVISIONAL_ITEMS ? K_PROVISIONAL : DEFAULT_K_FACTOR;
}
