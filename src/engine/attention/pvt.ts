/**
 * PVT-B administration rules and scoring (modules/attention/SPEC.md §4.1).
 * Pure: the screen presents stimuli and records timestamps, everything that
 * decides what a run *means* is here.
 */

import type { Rng } from '../assessment/sequences';
import { median } from './latency';
import {
  PVTB_DURATION_MS,
  PVTB_FALSE_START_MS,
  PVTB_ISI_MAX_MS,
  PVTB_ISI_MIN_MS,
  PVTB_LAPSE_MS,
  PVTB_MAX_STIMULUS_MS,
} from './timing';

/** One recorded trial. `rtMs` is measured from the frame that painted the stimulus. */
export interface PvtTrial {
  /** ms from painted onset to the response; null when nothing was pressed. */
  rtMs: number | null;
  /** True when the press landed during the interval, with no stimulus showing. */
  preStimulus: boolean;
}

export type PvtTrialClass = 'valid' | 'lapse' | 'falseStart' | 'noResponse';

/** Uniform interval in [PVTB_ISI_MIN_MS, PVTB_ISI_MAX_MS]. */
export function nextIsiMs(rng: Rng): number {
  return Math.round(PVTB_ISI_MIN_MS + rng() * (PVTB_ISI_MAX_MS - PVTB_ISI_MIN_MS));
}

/** The run ends once the elapsed time reaches the task duration; the trial in flight finishes. */
export function isPvtRunOver(elapsedMs: number): boolean {
  return elapsedMs >= PVTB_DURATION_MS;
}

export function classifyPvtTrial(trial: PvtTrial): PvtTrialClass {
  if (trial.preStimulus) return 'falseStart';
  if (trial.rtMs === null) return 'noResponse';
  if (trial.rtMs < PVTB_FALSE_START_MS) return 'falseStart';
  if (trial.rtMs >= PVTB_LAPSE_MS) return 'lapse';
  return 'valid';
}

/**
 * The RT a trial contributes to the reaction-time statistics, or null if it
 * contributes none.
 *
 * False starts are excluded (assessment/SPEC.md §7) — an anticipation is not a
 * response to a stimulus. Non-responses are **imputed at the stimulus timeout**
 * rather than dropped: dropping them would let a run that stopped responding
 * score identically to a shorter, fully-attended run. The imputation is stated
 * wherever the numbers are shown, and `noResponses` is reported separately.
 */
export function rtForStats(trial: PvtTrial): number | null {
  switch (classifyPvtTrial(trial)) {
    case 'falseStart':
      return null;
    case 'noResponse':
      return PVTB_MAX_STIMULUS_MS;
    default:
      return trial.rtMs;
  }
}

/** Where a press landed, as far as the presenting screen knows. */
export type PvtPressPhase = 'interval' | 'stimulus' | 'inactive';

/** Either a trial to record, or nothing — a press outside a trial is not data. */
export type PvtPress = { kind: 'ignored' } | { kind: 'trial'; trial: PvtTrial };

/**
 * What a press means, given the phase it landed in and whether the stimulus'
 * frame has actually been painted yet.
 *
 * `paintedAtMs === null` during the stimulus phase is the narrow but real case
 * where the app has asked for the stimulus and the frame showing it has not run
 * yet — roughly one frame. The user cannot have reacted to something not yet on
 * screen, so it is an anticipation, and crucially it is **not** timed from the
 * request: doing that would invent a reaction time out of render latency.
 */
export function classifyPvtPress(
  phase: PvtPressPhase,
  pressedAtMs: number,
  paintedAtMs: number | null,
): PvtPress {
  if (phase === 'inactive') return { kind: 'ignored' };
  if (phase === 'interval' || paintedAtMs === null) {
    return { kind: 'trial', trial: { rtMs: null, preStimulus: true } };
  }
  return { kind: 'trial', trial: { rtMs: pressedAtMs - paintedAtMs, preStimulus: false } };
}

export interface PvtMetrics {
  trials: number;
  /** Trials contributing an RT: responses plus timeout-imputed non-responses. */
  scoredTrials: number;
  /** Responses faster than the lapse threshold. */
  validTrials: number;
  lapses: number;
  /** Lapses per scored trial; null when nothing was scored. */
  lapseRate: number | null;
  falseStarts: number;
  /** False starts per trial; null when there were no trials. */
  falseStartRate: number | null;
  noResponses: number;
  meanRtMs: number | null;
  medianRtMs: number | null;
  /** Primary score: mean of 1/RT in responses per second. Higher is faster. */
  responseSpeed: number | null;
  fastest10PctMeanRtMs: number | null;
  slowest10PctMeanRtMs: number | null;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Mean of the fastest (`slowest = false`) or slowest tenth, at least one trial. */
function tailMean(sortedAsc: number[], slowest: boolean): number {
  const n = Math.max(1, Math.ceil(sortedAsc.length * 0.1));
  return mean(slowest ? sortedAsc.slice(-n) : sortedAsc.slice(0, n));
}

export function scorePvt(trials: readonly PvtTrial[]): PvtMetrics {
  const classes = trials.map(classifyPvtTrial);
  const rts = trials.map(rtForStats).filter((rt): rt is number => rt !== null);
  const sorted = [...rts].sort((a, b) => a - b);
  const count = (c: PvtTrialClass) => classes.filter((k) => k === c).length;
  const lapses = count('lapse');
  const falseStarts = count('falseStart');

  const empty = sorted.length === 0;
  return {
    trials: trials.length,
    scoredTrials: sorted.length,
    validTrials: count('valid'),
    lapses,
    lapseRate: empty ? null : lapses / sorted.length,
    falseStarts,
    falseStartRate: trials.length === 0 ? null : falseStarts / trials.length,
    noResponses: count('noResponse'),
    meanRtMs: empty ? null : mean(sorted),
    medianRtMs: empty ? null : median(sorted),
    responseSpeed: empty ? null : mean(sorted.map((rt) => 1000 / rt)),
    fastest10PctMeanRtMs: empty ? null : tailMean(sorted, false),
    slowest10PctMeanRtMs: empty ? null : tailMean(sorted, true),
  };
}
