/**
 * Persistence for the three attention tasks (SPEC.md §2). One `assessments` row
 * per completed run, with the full metric set, the per-trial record and the
 * run's measured timing profile in the existing nullable `payload` column — no
 * new tables.
 *
 * Imports the query modules directly rather than the `@/db` barrel: the barrel
 * pulls in DbProvider (React), and this file is unit-tested against a real
 * sql.js database in Node.
 */

import { upsertAbility } from '@/db/queries/ability';
import { insertAssessment, listAssessments } from '@/db/queries/assessments';
import type { Db } from '@/db/types';
import {
  seedAttentionElo,
  type AttentionSamples,
  type CptMetrics,
  type CptTrialResult,
  type FlickerMetrics,
  type FlickerTrialResult,
  type PvtMetrics,
  type PvtTrial,
  type TimingProfile,
} from '@/engine';

export const PVT_INSTRUMENT = 'pvtb';
export const CPT_INSTRUMENT = 'cpt';
export const FLICKER_INSTRUMENT = 'flicker';

export const ATTENTION_INSTRUMENTS = [PVT_INSTRUMENT, CPT_INSTRUMENT, FLICKER_INSTRUMENT] as const;

export const ATTENTION_MODULE = 'attention';

/** What lands in `assessments.payload`, for every attention task. */
export interface AttentionRunPayload<Metrics, Trial> {
  metrics: Metrics;
  trials: readonly Trial[];
  timing: TimingProfile;
}

export function attentionPayload<Metrics, Trial>(
  metrics: Metrics,
  trials: readonly Trial[],
  timing: TimingProfile,
): string {
  const payload: AttentionRunPayload<Metrics, Trial> = { metrics, trials, timing };
  return JSON.stringify(payload);
}

/** Most recent raw score for an instrument, or null if it has never been run. */
export function latestRawScore(db: Db, instrument: string): number | null {
  // listAssessments orders by ts descending.
  return listAssessments(db, instrument)[0]?.rawScore ?? null;
}

/** Every recorded raw score for an instrument — the sample the empirical-z switch reads. */
export function rawScoreSamples(db: Db, instrument: string): number[] {
  return listAssessments(db, instrument).map((row) => row.rawScore);
}

/**
 * Recompute the attention Elo from the latest row of each attention instrument
 * and write it (which also appends to the append-only `ability_log`). Returns
 * null — writing nothing — until at least one attention task has been run.
 */
export function reseedAttentionElo(db: Db, now: Date = new Date()): number | null {
  const samples: AttentionSamples = {
    pvtResponseSpeed: rawScoreSamples(db, PVT_INSTRUMENT),
    cptDPrime: rawScoreSamples(db, CPT_INSTRUMENT),
    flickerDetectionMs: rawScoreSamples(db, FLICKER_INSTRUMENT),
  };
  const elo = seedAttentionElo(
    {
      pvtResponseSpeed: latestRawScore(db, PVT_INSTRUMENT),
      cptDPrime: latestRawScore(db, CPT_INSTRUMENT),
      flickerDetectionMs: latestRawScore(db, FLICKER_INSTRUMENT),
    },
    samples,
  );
  if (elo === null) return null;
  upsertAbility(db, ATTENTION_MODULE, elo, now);
  return elo;
}

export interface RecordedRun {
  rawScore: number;
  /** The attention Elo after this run, or null if none could be computed. */
  elo: number | null;
}

/**
 * PVT-B run. Returns null without writing when the run produced no scorable
 * trial (every press a false start, or the user quit immediately) — an
 * unscorable run must not become a row that looks like a result.
 */
export function recordPvtRun(
  db: Db,
  run: { metrics: PvtMetrics; trials: readonly PvtTrial[]; timing: TimingProfile },
  now?: Date,
): RecordedRun | null {
  if (run.metrics.responseSpeed === null) return null;
  insertAssessment(db, {
    instrument: PVT_INSTRUMENT,
    rawScore: run.metrics.responseSpeed,
    payload: attentionPayload(run.metrics, run.trials, run.timing),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: run.metrics.responseSpeed, elo: reseedAttentionElo(db, now) };
}

/** CPT run. d′ is always defined, but a run with no trials is still not a result. */
export function recordCptRun(
  db: Db,
  run: { metrics: CptMetrics; trials: readonly CptTrialResult[]; timing: TimingProfile },
  now?: Date,
): RecordedRun | null {
  if (run.metrics.trials === 0) return null;
  insertAssessment(db, {
    instrument: CPT_INSTRUMENT,
    rawScore: run.metrics.dPrime,
    payload: attentionPayload(run.metrics, run.trials, run.timing),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: run.metrics.dPrime, elo: reseedAttentionElo(db, now) };
}

/** Flicker run. The raw score already imputes missed trials at the timeout. */
export function recordFlickerRun(
  db: Db,
  run: { metrics: FlickerMetrics; trials: readonly FlickerTrialResult[]; timing: TimingProfile },
  now?: Date,
): RecordedRun | null {
  if (run.metrics.scoreDetectionMs === null) return null;
  insertAssessment(db, {
    instrument: FLICKER_INSTRUMENT,
    rawScore: run.metrics.scoreDetectionMs,
    payload: attentionPayload(run.metrics, run.trials, run.timing),
    ...(now ? { ts: now } : {}),
  });
  return { rawScore: run.metrics.scoreDetectionMs, elo: reseedAttentionElo(db, now) };
}
