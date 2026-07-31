/**
 * Recomputing derived state after a merge
 * (docs/superpowers/specs/2026-07-31-supabase-sync-design.md §3.2).
 *
 * `fsrs_state` is not merged — it is *rebuilt* from the card's merged review
 * history. This is the case last-writer-wins gets wrong: when both machines
 * reviewed the same card offline, neither device's final state accounts for the
 * other's review, so whichever state "wins" encodes a schedule that ignores a
 * review the user actually did. Replaying the union of both histories in
 * timestamp order produces the schedule that both reviews imply.
 *
 * This works only because `schedule()` is pure and deterministic — the same
 * property that lets the scheduler be unit-tested without a database is what
 * lets it be re-run over merged history here.
 */

import {
  createEmptyCardState,
  schedule,
  type CardState,
  type ReviewRating,
  type SchedulerConfig,
} from '../fsrs';

/** The fields of a review_log row that actually affect scheduling. */
export interface ReplayableReview {
  ts: Date;
  rating: ReviewRating;
}

/**
 * Rebuild a card's scheduling state from its creation time and its full review
 * history. Reviews are sorted by `ts` here rather than trusted in argument
 * order: a merged history arrives as the union of two devices' rows and has no
 * inherent ordering.
 *
 * Ties on `ts` keep their relative input order (Array.prototype.sort is stable),
 * so a caller that sorts by id first gets a deterministic result across devices.
 */
export function replayCardState(
  createdAt: Date,
  reviews: readonly ReplayableReview[],
  config?: SchedulerConfig,
): CardState {
  const ordered = [...reviews].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  let state = createEmptyCardState(createdAt);
  for (const review of ordered) {
    state = schedule(state, review.rating, review.ts, config);
  }
  return state;
}

/**
 * Whether a replayed state differs from the stored one in a way worth writing.
 * Compared field by field rather than by reference so a no-op merge doesn't
 * dirty every card on the device and push it all back.
 */
export function cardStateDiffers(a: CardState, b: CardState): boolean {
  return (
    a.due.getTime() !== b.due.getTime() ||
    a.stability !== b.stability ||
    a.difficulty !== b.difficulty ||
    a.reps !== b.reps ||
    a.lapses !== b.lapses ||
    a.phase !== b.phase ||
    a.scheduledDays !== b.scheduledDays ||
    a.learningSteps !== b.learningSteps ||
    (a.lastReview?.getTime() ?? null) !== (b.lastReview?.getTime() ?? null)
  );
}

/** One module's current Elo, as recorded in the append-only ability_log. */
export interface AbilityLogEntry {
  module: string;
  elo: number;
  ts: Date;
}

/**
 * `ability_ratings` is a cache of the newest `ability_log` entry per module, so
 * after the log merges it is recomputed rather than reconciled.
 *
 * Unlike `fsrs_state` this is *not* a replay: ability_log entries come from two
 * different sources (graded reviews and assessment-driven reseeds), so there is
 * no single function to re-run. Taking the latest entry per module is therefore
 * last-writer-wins in effect — acceptable because Elo is a running estimate
 * rather than a conserved quantity, but it is a merge artifact and the design
 * doc says so rather than implying an exact reconciliation.
 */
export function latestEloByModule(
  entries: readonly AbilityLogEntry[],
): Map<string, AbilityLogEntry> {
  const latest = new Map<string, AbilityLogEntry>();
  for (const entry of entries) {
    const current = latest.get(entry.module);
    if (
      current === undefined ||
      entry.ts.getTime() > current.ts.getTime() ||
      // Deterministic tie-break so both devices agree on a simultaneous write.
      (entry.ts.getTime() === current.ts.getTime() && entry.elo > current.elo)
    ) {
      latest.set(entry.module, entry);
    }
  }
  return latest;
}
