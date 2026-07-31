/**
 * "What would disconfirm this?" self-rating scoring (modules/reasoning/SPEC.md
 * §4.3). Pure and content-free — the claim bank lives in
 * `modules/reasoning/disconfirmationBank.ts` (SPEC.md §6).
 *
 * Quality here is **self-rated, not graded**: after typing an answer, the
 * user sees example disconfirming conditions and rates their own answer
 * against them. This file never implies the app verified the answer — the
 * rating vocabulary is `self`, always.
 */

export const DISCONFIRMATION_PROMPTS_PER_RUN = 6;

/**
 * `skipped` — no answer was typed, so there is nothing to self-rate.
 * `no` / `partial` / `yes` — the user's own judgment of whether what they
 * wrote would genuinely test the claim.
 */
export type SelfRating = 'skipped' | 'no' | 'partial' | 'yes';

const RATING_SCORE: Record<Exclude<SelfRating, 'skipped'>, number> = {
  no: 0,
  partial: 0.5,
  yes: 1,
};

export interface DisconfirmationRunMetrics {
  trials: number;
  skipped: number;
  /** trials - skipped. */
  rated: number;
  /** Mean of the rated (non-skipped) scores; null if none were rated. */
  meanSelfScore: number | null;
  yesCount: number;
  partialCount: number;
  noCount: number;
}

/**
 * Aggregates one run's self-ratings. `skipped` entries are excluded from the
 * mean but counted separately — the same null-vs-zero discipline
 * `PvtMetrics` uses for a run with no scorable trials, so quietly skipping
 * every prompt cannot look identical to rating every one "no".
 */
export function scoreDisconfirmationRun(ratings: readonly SelfRating[]): DisconfirmationRunMetrics {
  const rated = ratings.filter((r): r is Exclude<SelfRating, 'skipped'> => r !== 'skipped');
  const meanSelfScore =
    rated.length === 0 ? null : rated.reduce((a, r) => a + RATING_SCORE[r], 0) / rated.length;

  return {
    trials: ratings.length,
    skipped: ratings.length - rated.length,
    rated: rated.length,
    meanSelfScore,
    yesCount: rated.filter((r) => r === 'yes').length,
    partialCount: rated.filter((r) => r === 'partial').length,
    noCount: rated.filter((r) => r === 'no').length,
  };
}
