/**
 * Result and instruction copy for the reasoning tasks (SPEC.md §0).
 *
 * Every string here describes performance on the specific run and task —
 * an estimate's error, a count of distinct entries, a self-rating, a
 * confidence-vs-accuracy statistic. None of these may imply a general
 * capacity for "reasoning," "rationality," or "critical thinking" as a
 * trait. Guarded here by copy.test.ts and repo-wide by
 * assessment/copy-honesty.test.ts (scans src/modules).
 */

export const BASE_RATE_HONESTY =
  'This reports how close your estimate was to the correct answer on these items, and whether ' +
  'that changed depending on how the question was phrased. It describes this run on these ' +
  'items only.';

export const HYPOTHESES_HONESTY =
  'This counts how many distinct explanations you wrote down — it does not judge whether any of ' +
  'them are good explanations. Exact-text duplicates are removed; the same idea in different ' +
  'words counts twice.';

export const DISCONFIRMATION_HONESTY =
  'You rate your own answer against example disconfirming conditions — the app does not verify ' +
  'or grade it. This reports your self-ratings, not a measure of how good your reasoning was.';

export const CALIBRATION_HONESTY =
  'This reports how well your stated confidence matched your actual accuracy on these questions ' +
  '— a narrow, well-defined statistic about this set of ratings, not a reading of your judgment ' +
  'in general.';

export const BASE_RATE_FORMAT_EXPLANATION =
  'Some of these items are phrased as percentages, others as counts out of a stated total. Both ' +
  'ask the same underlying question — comparing your accuracy on each phrasing is the point.';

export const HYPOTHESES_DEDUPE_EXPLANATION =
  'Two entries are only merged if they are the same text (after trimming and case). Rewording ' +
  'the same idea is counted as a second entry.';

export const DISCONFIRMATION_SELF_RATE_EXPLANATION =
  'Rate your own answer once you see the examples: would it have genuinely put the claim to a ' +
  'test, even partly, or would it have been consistent no matter what actually happened?';

export const BRIER_EXPLANATION =
  'The Brier score compares your stated confidence to what actually happened, averaged over every ' +
  'question. 0 is perfect. 0.25 is what you would get by always saying "50/50," regardless of the ' +
  'outcome. 1 is being completely confident and wrong every time.';

export const CALIBRATION_CURVE_EXPLANATION =
  'For each confidence level you used, this shows what share of those answers were actually ' +
  'correct. On the diagonal line, your confidence matched your accuracy. Above it, you were ' +
  'under-confident for that level; below it, over-confident.';

/** Why a confidence level with zero answers doesn't appear on the curve. */
export const CALIBRATION_CURVE_OMISSION_EXPLANATION =
  'A confidence level you never used isn’t shown — that’s different from showing it at 0% correct.';

// --- formatting ------------------------------------------------------------

/** A percentage-point value, or an em dash when there's nothing to show. */
export function formatPct(value: number | null, digits: number = 0): string {
  return value === null ? '—' : `${value.toFixed(digits)}%`;
}

/** Absolute error in percentage points. */
export function formatErrorPct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} pp`;
}

/** A count with one decimal when it isn't whole, e.g. mean unique per prompt. */
export function formatCount(value: number | null, digits: number = 1): string {
  return value === null ? '—' : value.toFixed(digits);
}

/** A Brier score, always shown to 3 decimals (its useful range is small). */
export function formatBrier(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

/** A fraction like "3 of 5", never bare numbers that could be misread as a percent. */
export function formatFraction(count: number, total: number): string {
  return `${count} of ${total}`;
}
