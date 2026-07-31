/**
 * Persistence for the four reasoning tasks (SPEC.md §2, §3). One `assessments`
 * row per completed run, full per-trial detail in the existing nullable
 * `payload` column — no new tables. Mirrors `modules/attention/results.ts`;
 * unlike attention, none of these tasks are timed, so there is no
 * `TimingProfile` here.
 *
 * Imports the query modules directly rather than the `@/db` barrel: the
 * barrel pulls in DbProvider (React), and this file is unit-tested against a
 * real sql.js database in Node.
 */

import { upsertAbility } from '@/db/queries/ability';
import { insertAssessment, listAssessments } from '@/db/queries/assessments';
import type { Db } from '@/db/types';
import {
  seedReasoningElo,
  type BaseRateItem,
  type BaseRateRunMetrics,
  type CalibrationRunMetrics,
  type CalibrationTrial,
  type DisconfirmationRunMetrics,
  type HypothesesRunMetrics,
  type ReasoningSamples,
  type SelfRating,
} from '@/engine';

export const BASE_RATE_INSTRUMENT = 'reasoning_baserate';
export const HYPOTHESES_INSTRUMENT = 'reasoning_hypotheses';
export const DISCONFIRMATION_INSTRUMENT = 'reasoning_disconfirmation';
export const CALIBRATION_INSTRUMENT = 'reasoning_calibration';

export const REASONING_INSTRUMENTS = [
  BASE_RATE_INSTRUMENT,
  HYPOTHESES_INSTRUMENT,
  DISCONFIRMATION_INSTRUMENT,
  CALIBRATION_INSTRUMENT,
] as const;

export const REASONING_MODULE = 'reasoning';

function toJson(payload: unknown): string {
  return JSON.stringify(payload);
}

/** Most recent raw score for an instrument, or null if it has never been run. */
export function latestRawScore(db: Db, instrument: string): number | null {
  return listAssessments(db, instrument)[0]?.rawScore ?? null;
}

/** Every recorded raw score for an instrument — the sample the empirical-z switch reads. */
export function rawScoreSamples(db: Db, instrument: string): number[] {
  return listAssessments(db, instrument).map((row) => row.rawScore);
}

/**
 * Recompute the reasoning Elo from the latest row of each reasoning
 * instrument and write it. Returns null — writing nothing — until at least
 * one reasoning task has been run.
 */
export function reseedReasoningElo(db: Db, now: Date = new Date()): number | null {
  const samples: ReasoningSamples = {
    baseRateMeanErrorPct: rawScoreSamples(db, BASE_RATE_INSTRUMENT),
    hypothesesMeanUniquePerPrompt: rawScoreSamples(db, HYPOTHESES_INSTRUMENT),
    disconfirmationMeanSelfScore: rawScoreSamples(db, DISCONFIRMATION_INSTRUMENT),
    calibrationBrierScore: rawScoreSamples(db, CALIBRATION_INSTRUMENT),
  };
  const elo = seedReasoningElo(
    {
      baseRateMeanErrorPct: latestRawScore(db, BASE_RATE_INSTRUMENT),
      hypothesesMeanUniquePerPrompt: latestRawScore(db, HYPOTHESES_INSTRUMENT),
      disconfirmationMeanSelfScore: latestRawScore(db, DISCONFIRMATION_INSTRUMENT),
      calibrationBrierScore: latestRawScore(db, CALIBRATION_INSTRUMENT),
    },
    samples,
  );
  if (elo === null) return null;
  upsertAbility(db, REASONING_MODULE, elo, now);
  return elo;
}

export interface RecordedRun {
  rawScore: number;
  /** The reasoning Elo after this run, or null if none could be computed. */
  elo: number | null;
}

// --- base-rate ---------------------------------------------------------------

export interface BaseRatePayload {
  metrics: BaseRateRunMetrics;
  items: readonly BaseRateItem[];
  answers: readonly number[];
}

/** Refuses to write a run with no items — an empty run is not a result. */
export function recordBaseRateRun(
  db: Db,
  payload: BaseRatePayload,
  now?: Date,
): RecordedRun | null {
  if (payload.metrics.meanAbsoluteErrorPct === null) return null;
  insertAssessment(db, {
    instrument: BASE_RATE_INSTRUMENT,
    rawScore: payload.metrics.meanAbsoluteErrorPct,
    payload: toJson(payload),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: payload.metrics.meanAbsoluteErrorPct, elo: reseedReasoningElo(db, now) };
}

// --- hypotheses ----------------------------------------------------------------

export interface HypothesesTrialRecord {
  prompt: string;
  entries: readonly string[];
}

export interface HypothesesPayload {
  metrics: HypothesesRunMetrics;
  trials: readonly HypothesesTrialRecord[];
}

export function recordHypothesesRun(
  db: Db,
  payload: HypothesesPayload,
  now?: Date,
): RecordedRun | null {
  if (payload.metrics.meanUniquePerPrompt === null) return null;
  insertAssessment(db, {
    instrument: HYPOTHESES_INSTRUMENT,
    rawScore: payload.metrics.meanUniquePerPrompt,
    payload: toJson(payload),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: payload.metrics.meanUniquePerPrompt, elo: reseedReasoningElo(db, now) };
}

// --- disconfirmation -------------------------------------------------------

export interface DisconfirmationTrialRecord {
  claim: string;
  answer: string;
  rating: SelfRating;
}

export interface DisconfirmationPayload {
  metrics: DisconfirmationRunMetrics;
  trials: readonly DisconfirmationTrialRecord[];
}

/** Refuses to write a run where every prompt was skipped — nothing was self-rated. */
export function recordDisconfirmationRun(
  db: Db,
  payload: DisconfirmationPayload,
  now?: Date,
): RecordedRun | null {
  if (payload.metrics.meanSelfScore === null) return null;
  insertAssessment(db, {
    instrument: DISCONFIRMATION_INSTRUMENT,
    rawScore: payload.metrics.meanSelfScore,
    payload: toJson(payload),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: payload.metrics.meanSelfScore, elo: reseedReasoningElo(db, now) };
}

// --- calibration ---------------------------------------------------------------

export interface CalibrationPayloadTrial extends CalibrationTrial {
  itemId: string;
}

export interface CalibrationPayload {
  metrics: CalibrationRunMetrics;
  trials: readonly CalibrationPayloadTrial[];
}

export function recordCalibrationRun(
  db: Db,
  payload: CalibrationPayload,
  now?: Date,
): RecordedRun | null {
  if (payload.metrics.brierScore === null) return null;
  insertAssessment(db, {
    instrument: CALIBRATION_INSTRUMENT,
    rawScore: payload.metrics.brierScore,
    payload: toJson(payload),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: payload.metrics.brierScore, elo: reseedReasoningElo(db, now) };
}

/**
 * Every calibration trial ever recorded, oldest first — the raw material for
 * the *running* calibration curve (SPEC.md §4.4). `calibrationCurve` is a pure
 * function of a trial array; feeding it this instead of one run's trials is
 * the entire "running" behavior, no separate accumulation path.
 */
export function allCalibrationTrials(db: Db): CalibrationPayloadTrial[] {
  const rows = listAssessments(db, CALIBRATION_INSTRUMENT);
  const trials: CalibrationPayloadTrial[] = [];
  for (const row of [...rows].reverse()) {
    if (row.payload === null) continue;
    const parsed = JSON.parse(row.payload) as CalibrationPayload;
    trials.push(...parsed.trials);
  }
  return trials;
}
