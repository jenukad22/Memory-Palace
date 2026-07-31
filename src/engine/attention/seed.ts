/**
 * raw → normalized → attention Elo (modules/attention/SPEC.md §4.4).
 *
 * Same two-stage rule as the span instruments (assessment/SPEC.md §2.1): a fixed
 * monotonic proxy until N_MIN samples exist for an instrument, then empirical z
 * over the accumulated rows.
 *
 * Every midpoint and spread below is a **structural scaling of the task's own
 * achievable axis** — derived from the task's own thresholds and trial counts,
 * not from any published figure and not from any population. They exist so Elo
 * seeds spread sensibly, and they are superseded per-instrument by empirical z.
 */

import { Z_CAP, empiricalZ, N_MIN } from '../assessment/normalize';
import { eloFromNormalized, moduleMean } from '../assessment/seedElo';
import { maxDPrime } from './signalDetection';
import { CPT_DISTRACTOR_RATE, CPT_TRIALS, FLICKER_TIMEOUT_MS, PVTB_LAPSE_MS } from './timing';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- PVT-B response speed (responses/second, higher is faster) ---------------

/**
 * The axis midpoint is the speed at the task's own lapse threshold: a run whose
 * mean 1/RT sits exactly at 355 ms sits in the middle of the axis.
 */
export const PVT_SPEED_MID = 1000 / PVTB_LAPSE_MS;
/** One extra response per second per unit — a structural step, not an SD. */
export const PVT_SPEED_SPREAD = 1;

export function proxyNormalizePvtSpeed(responseSpeed: number): number {
  return clamp((responseSpeed - PVT_SPEED_MID) / PVT_SPEED_SPREAD, -Z_CAP, Z_CAP);
}

// --- CPT d′ (higher is better) ----------------------------------------------

export const CPT_DISTRACTOR_TRIALS = Math.round(CPT_TRIALS * CPT_DISTRACTOR_RATE);
export const CPT_TARGET_TRIALS = CPT_TRIALS - CPT_DISTRACTOR_TRIALS;

/** The best d′ this trial structure can yield; the axis is [0, ceiling]. */
export const CPT_DPRIME_CEILING = maxDPrime(CPT_TARGET_TRIALS, CPT_DISTRACTOR_TRIALS);
export const CPT_DPRIME_MID = CPT_DPRIME_CEILING / 2;
export const CPT_DPRIME_SPREAD = CPT_DPRIME_CEILING / 4;

export function proxyNormalizeCptDPrime(dPrimeValue: number): number {
  return clamp((dPrimeValue - CPT_DPRIME_MID) / CPT_DPRIME_SPREAD, -Z_CAP, Z_CAP);
}

// --- Flicker detection time (ms, LOWER is better) ----------------------------

/** The axis is [0, timeout]; the sign is flipped so faster detection scores higher. */
export const FLICKER_DETECTION_MID_MS = FLICKER_TIMEOUT_MS / 2;
export const FLICKER_DETECTION_SPREAD_MS = FLICKER_TIMEOUT_MS / 4;

export function proxyNormalizeFlickerDetectionMs(detectionMs: number): number {
  return clamp(
    (FLICKER_DETECTION_MID_MS - detectionMs) / FLICKER_DETECTION_SPREAD_MS,
    -Z_CAP,
    Z_CAP,
  );
}

// --- proxy → empirical switch ------------------------------------------------

export function normalizePvtSpeed(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN ? empiricalZ(raw, [...samples]) : proxyNormalizePvtSpeed(raw);
}

export function normalizeCptDPrime(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN ? empiricalZ(raw, [...samples]) : proxyNormalizeCptDPrime(raw);
}

/** Negated on the empirical branch too — a slower detection must never score higher. */
export function normalizeFlickerDetectionMs(raw: number, samples: readonly number[] = []): number {
  return samples.length >= N_MIN
    ? -empiricalZ(raw, [...samples])
    : proxyNormalizeFlickerDetectionMs(raw);
}

// --- module Elo ---------------------------------------------------------------

/** Latest raw score per attention instrument; any subset may be present. */
export interface AttentionComponents {
  /** PVT-B response speed, responses/second. */
  pvtResponseSpeed?: number | null;
  /** CPT d′. */
  cptDPrime?: number | null;
  /** Flicker mean detection time in ms, misses imputed at the timeout. */
  flickerDetectionMs?: number | null;
}

/** Accumulated raw scores per instrument, for the empirical-z switch. */
export interface AttentionSamples {
  pvtResponseSpeed?: readonly number[];
  cptDPrime?: readonly number[];
  flickerDetectionMs?: readonly number[];
}

/** Normalized scores for whichever tasks have been completed, in a fixed order. */
export function attentionNormalizedScores(
  components: AttentionComponents,
  samples: AttentionSamples = {},
): number[] {
  const scores: number[] = [];
  const { pvtResponseSpeed, cptDPrime, flickerDetectionMs } = components;
  if (pvtResponseSpeed !== undefined && pvtResponseSpeed !== null) {
    scores.push(normalizePvtSpeed(pvtResponseSpeed, samples.pvtResponseSpeed ?? []));
  }
  if (cptDPrime !== undefined && cptDPrime !== null) {
    scores.push(normalizeCptDPrime(cptDPrime, samples.cptDPrime ?? []));
  }
  if (flickerDetectionMs !== undefined && flickerDetectionMs !== null) {
    scores.push(normalizeFlickerDetectionMs(flickerDetectionMs, samples.flickerDetectionMs ?? []));
  }
  return scores;
}

/**
 * Starting Elo for the attention module: the equal-weight mean of whichever
 * tasks have results, mapped through the shared eloFromNormalized. Null when no
 * attention task has been completed — the caller must not write an Elo then.
 */
export function seedAttentionElo(
  components: AttentionComponents,
  samples: AttentionSamples = {},
): number | null {
  const scores = attentionNormalizedScores(components, samples);
  return scores.length === 0 ? null : eloFromNormalized(moduleMean(scores));
}
