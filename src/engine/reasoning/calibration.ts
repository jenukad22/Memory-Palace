/**
 * Calibration scoring — Brier score and the reliability (calibration) curve
 * (modules/reasoning/SPEC.md §4.4).
 *
 * The engine never sees item content, the same way `engine/attention/cpt.ts`
 * never sees letter content: a trial is just a stated confidence and whether
 * the chosen answer was correct. Which option was chosen, and whether it was
 * right, is resolved where the factual content lives — the module layer.
 */

export const CONFIDENCE_LEVELS: readonly number[] = [50, 60, 70, 80, 90, 100];

/** Stating below 50% for your own chosen answer in a 2-choice question is
 *  incoherent — it means you think the other option is more likely. */
export const MIN_CONFIDENCE_PCT = 50;

export const CALIBRATION_ITEMS_PER_RUN = 15;

export interface CalibrationTrial {
  confidencePct: number;
  correct: boolean;
}

/**
 * Mean squared error between stated confidence (as a probability) and the
 * outcome — the standard proper scoring rule for a binary forecast. 0 =
 * perfect, 0.25 = always stating exactly 50% regardless of outcome (the
 * "uninformative" floor at this task's confidence range), 1 = maximally
 * confident and wrong every time.
 */
export function brierScore(trials: readonly CalibrationTrial[]): number | null {
  if (trials.length === 0) return null;
  const sum = trials.reduce((a, t) => {
    const p = t.confidencePct / 100;
    const outcome = t.correct ? 1 : 0;
    return a + (p - outcome) ** 2;
  }, 0);
  return sum / trials.length;
}

export interface CalibrationBucket {
  confidencePct: number;
  trials: number;
  correct: number;
  /** Fraction correct within this bucket, 0-100. */
  observedAccuracyPct: number;
}

/**
 * One bucket per confidence level **that has at least one trial** — a level
 * with zero trials is omitted, not shown at 0% observed, which would
 * misrepresent "never asked" as "always wrong" (the same null-not-zero
 * discipline used throughout this codebase).
 *
 * Pure and stateless: a per-session curve is this function fed one run's
 * trials, and a running/lifetime curve is the same function fed every
 * historical trial concatenated — no separate accumulation logic exists
 * (SPEC.md §4.4).
 */
export function calibrationCurve(trials: readonly CalibrationTrial[]): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];
  for (const level of CONFIDENCE_LEVELS) {
    const atLevel = trials.filter((t) => t.confidencePct === level);
    if (atLevel.length === 0) continue;
    const correct = atLevel.filter((t) => t.correct).length;
    buckets.push({
      confidencePct: level,
      trials: atLevel.length,
      correct,
      observedAccuracyPct: (correct / atLevel.length) * 100,
    });
  }
  return buckets;
}

export interface CalibrationRunMetrics {
  trials: number;
  correctCount: number;
  accuracyPct: number | null;
  meanConfidencePct: number | null;
  brierScore: number | null;
  curve: CalibrationBucket[];
}

export function scoreCalibrationRun(trials: readonly CalibrationTrial[]): CalibrationRunMetrics {
  const correctCount = trials.filter((t) => t.correct).length;
  return {
    trials: trials.length,
    correctCount,
    accuracyPct: trials.length === 0 ? null : (correctCount / trials.length) * 100,
    meanConfidencePct:
      trials.length === 0 ? null : trials.reduce((a, t) => a + t.confidencePct, 0) / trials.length,
    brierScore: brierScore(trials),
    curve: calibrationCurve(trials),
  };
}
