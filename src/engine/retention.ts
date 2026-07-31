/**
 * Per-module predicted retrievability curve (docs/superpowers/specs/
 * 2026-07-31-progress-dashboard-design.md §3) — the forward-looking decay
 * curve implied by a module's cards' current FSRS state, not a replay of past
 * review outcomes. Reuses getRetrievability so the curve matches the exact
 * formula/parameters used everywhere else FSRS runs in this app.
 */

import { getRetrievability, type CardState, type SchedulerConfig } from './fsrs';

const MS_PER_DAY = 86_400_000;

export interface RetrievabilityPoint {
  daysFromNow: number;
  retrievability: number;
}

/**
 * Average retrievability across a module's reviewed (non-"new") cards, sampled
 * from `now` out to `horizonDays` every `stepDays`. Cards still in the "new"
 * phase have no retention signal yet and are excluded. Empty input (or an
 * all-new module) yields [].
 */
export function moduleRetrievabilityCurve(
  cardStates: CardState[],
  now: Date,
  horizonDays = 30,
  stepDays = 1,
  config?: SchedulerConfig,
): RetrievabilityPoint[] {
  const reviewed = cardStates.filter((c) => c.phase !== 'new');
  if (reviewed.length === 0) return [];

  const points: RetrievabilityPoint[] = [];
  for (let d = 0; d <= horizonDays; d += stepDays) {
    const futureNow = new Date(now.getTime() + d * MS_PER_DAY);
    const total = reviewed.reduce(
      (sum, card) => sum + getRetrievability(card, futureNow, config),
      0,
    );
    points.push({ daysFromNow: d, retrievability: total / reviewed.length });
  }
  return points;
}
