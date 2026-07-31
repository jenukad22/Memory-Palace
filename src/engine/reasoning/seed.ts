/**
 * raw → normalized → reasoning Elo (modules/reasoning/SPEC.md §5). Mirrors
 * `engine/attention/seed.ts` exactly: a fixed monotonic proxy until N_MIN
 * samples exist per instrument, then empirical z; every proxy axis is a
 * structural scaling of that task's own achievable range, not a population
 * statistic.
 */

import { N_MIN, Z_CAP, empiricalZ } from '../assessment/normalize';
import { eloFromNormalized, moduleMean } from '../assessment/seedElo';
import { MAX_HYPOTHESES_PER_PROMPT } from './hypotheses';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- base-rate mean absolute error, pp (lower is better) --------------------

/** Half the achievable-error axis [0,100] — a structural center, not a norm. */
export const BASE_RATE_ERROR_MID_PCT = 50;
export const BASE_RATE_ERROR_SPREAD_PCT = 25;

export function proxyNormalizeBaseRateError(meanAbsoluteErrorPct: number): number {
  return clamp(
    (BASE_RATE_ERROR_MID_PCT - meanAbsoluteErrorPct) / BASE_RATE_ERROR_SPREAD_PCT,
    -Z_CAP,
    Z_CAP,
  );
}

// --- hypothesis fluency, unique/prompt (higher is better) -------------------

export const HYPOTHESES_MID = MAX_HYPOTHESES_PER_PROMPT / 2;
export const HYPOTHESES_SPREAD = MAX_HYPOTHESES_PER_PROMPT / 4;

export function proxyNormalizeHypotheses(meanUniquePerPrompt: number): number {
  return clamp((meanUniquePerPrompt - HYPOTHESES_MID) / HYPOTHESES_SPREAD, -Z_CAP, Z_CAP);
}

// --- disconfirmation self-score, [0,1] (higher is better) -------------------

export const DISCONFIRMATION_MID = 0.5;
export const DISCONFIRMATION_SPREAD = 0.25;

export function proxyNormalizeDisconfirmation(meanSelfScore: number): number {
  return clamp((meanSelfScore - DISCONFIRMATION_MID) / DISCONFIRMATION_SPREAD, -Z_CAP, Z_CAP);
}

// --- calibration Brier score, [0,1] (LOWER is better) ------------------------

export const CALIBRATION_MID = 0.5;
export const CALIBRATION_SPREAD = 0.25;

export function proxyNormalizeCalibration(brierScoreValue: number): number {
  return clamp((CALIBRATION_MID - brierScoreValue) / CALIBRATION_SPREAD, -Z_CAP, Z_CAP);
}

// --- proxy -> empirical switch ------------------------------------------------

export function normalizeBaseRateError(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN
    ? -empiricalZ(raw, [...samples])
    : proxyNormalizeBaseRateError(raw);
}

export function normalizeHypotheses(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN ? empiricalZ(raw, [...samples]) : proxyNormalizeHypotheses(raw);
}

export function normalizeDisconfirmation(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN
    ? empiricalZ(raw, [...samples])
    : proxyNormalizeDisconfirmation(raw);
}

export function normalizeCalibration(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN ? -empiricalZ(raw, [...samples]) : proxyNormalizeCalibration(raw);
}

// --- module Elo ---------------------------------------------------------------

/** Latest raw score per reasoning instrument; any subset may be present. */
export interface ReasoningComponents {
  baseRateMeanErrorPct?: number | null;
  hypothesesMeanUniquePerPrompt?: number | null;
  disconfirmationMeanSelfScore?: number | null;
  calibrationBrierScore?: number | null;
}

/** Accumulated raw scores per instrument, for the empirical-z switch. */
export interface ReasoningSamples {
  baseRateMeanErrorPct?: readonly number[];
  hypothesesMeanUniquePerPrompt?: readonly number[];
  disconfirmationMeanSelfScore?: readonly number[];
  calibrationBrierScore?: readonly number[];
}

/** Normalized scores for whichever tasks have been completed, in a fixed order. */
export function reasoningNormalizedScores(
  components: ReasoningComponents,
  samples: ReasoningSamples = {},
): number[] {
  const scores: number[] = [];
  const {
    baseRateMeanErrorPct,
    hypothesesMeanUniquePerPrompt,
    disconfirmationMeanSelfScore,
    calibrationBrierScore,
  } = components;
  if (baseRateMeanErrorPct !== undefined && baseRateMeanErrorPct !== null) {
    scores.push(normalizeBaseRateError(baseRateMeanErrorPct, samples.baseRateMeanErrorPct ?? []));
  }
  if (hypothesesMeanUniquePerPrompt !== undefined && hypothesesMeanUniquePerPrompt !== null) {
    scores.push(
      normalizeHypotheses(
        hypothesesMeanUniquePerPrompt,
        samples.hypothesesMeanUniquePerPrompt ?? [],
      ),
    );
  }
  if (disconfirmationMeanSelfScore !== undefined && disconfirmationMeanSelfScore !== null) {
    scores.push(
      normalizeDisconfirmation(
        disconfirmationMeanSelfScore,
        samples.disconfirmationMeanSelfScore ?? [],
      ),
    );
  }
  if (calibrationBrierScore !== undefined && calibrationBrierScore !== null) {
    scores.push(normalizeCalibration(calibrationBrierScore, samples.calibrationBrierScore ?? []));
  }
  return scores;
}

/**
 * Starting Elo for the reasoning module: the equal-weight mean of whichever
 * tasks have results, mapped through the shared eloFromNormalized. Null when
 * no reasoning task has been completed — the caller must not write an Elo then.
 */
export function seedReasoningElo(
  components: ReasoningComponents,
  samples: ReasoningSamples = {},
): number | null {
  const scores = reasoningNormalizedScores(components, samples);
  return scores.length === 0 ? null : eloFromNormalized(moduleMean(scores));
}
