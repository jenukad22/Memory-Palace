/**
 * Result and instruction copy for the attention tasks (SPEC.md §0).
 *
 * Every string here describes the run the user just did — milliseconds, counts,
 * rates on that task. None of them may imply a capacity beyond the task, a
 * health reading, or a trait. Guarded by copy.test.ts here and by the
 * repo-wide scanner in assessment/copy-honesty.test.ts.
 */

import type { TimingQuality } from '@/engine';

/**
 * Shown with every set of reaction times. The unmeasurable part — the device's
 * own input delay — is stated rather than estimated away, and the comparison
 * the numbers actually support is spelled out (SPEC.md §3.3).
 */
export const TIMING_DISCLOSURE =
  'Times run from the frame that painted the stimulus to the moment your press reached the app. ' +
  'They include your device’s own input delay — usually tens of milliseconds — which cannot be ' +
  'measured from inside the app. Compare your runs on this device with each other, not with ' +
  'numbers from anywhere else.';

/** One line per task, shown under its score. Task-specific by construction. */
export const PVT_HONESTY =
  'This reports how quickly you pressed during these three minutes: response speed, reaction ' +
  'time, and lapses. It describes this run on this task and nothing else — it is not a sleep, ' +
  'health, or attention-condition reading.';

export const CPT_HONESTY =
  'This reports what you did with one stream of letters: targets you caught, targets you missed, ' +
  'and presses on the letter you were meant to withhold on. A commission error is a press on that ' +
  'letter — nothing more is claimed from it.';

export const FLICKER_HONESTY =
  'This reports how long you took to find the changed element in these scenes, and how often you ' +
  'found it at all. Missing a change in a flickering scene is ordinary vision working normally; a ' +
  'slow trial means that change was hard to spot.';

/** What the headline number on each result screen actually counts. */
export const LAPSE_EXPLANATION =
  'A lapse is a response at or slower than 355 ms in this task — the task’s own threshold, not a ' +
  'boundary between kinds of people.';

export const DPRIME_EXPLANATION =
  'd′ combines catching targets with withholding on the distractor, so pressing at everything and ' +
  'pressing at nothing both score near the bottom. It is shown against the highest value this ' +
  'run’s trial counts allow.';

export const DETECTION_EXPLANATION =
  'Trials you never solved count as the full 60-second limit, so giving up early cannot look ' +
  'faster than searching and finding.';

export const NON_RESPONSE_EXPLANATION =
  'Stimuli you never answered count as the 3-second timeout rather than being dropped, so a run ' +
  'that stopped responding cannot score like a shorter, fully-attended one.';

/** Plain-language reading of the measured presentation timing (SPEC.md §3.2). */
export function timingQualityCopy(quality: TimingQuality): string {
  switch (quality) {
    case 'good':
      return 'Stimuli appeared within one frame of when they were due.';
    case 'fair':
      return 'Stimuli appeared up to a few frames late. Reaction times carry a wider band than usual.';
    case 'poor':
      return 'This device had trouble presenting stimuli on schedule. Treat this run as rough — the band on each reaction time is wide.';
    case 'unmeasured':
      return 'No presentation timing was captured for this run.';
  }
}

/**
 * Why late stimuli do not become slow reaction times. Worth stating on the
 * screen: the natural assumption is that a stuttering run inflates the scores.
 */
export const DRIFT_EXPLANATION =
  'Each reaction time is measured from the frame that actually painted the stimulus, so a stimulus ' +
  'arriving late shifts when the trial started — it is not added to your reaction time.';

// --- formatting ------------------------------------------------------------

/** Whole milliseconds, or an em dash when there is no number to show. */
export function formatMs(ms: number | null): string {
  return ms === null ? '—' : `${Math.round(ms)} ms`;
}

/** Seconds to one decimal, for the longer flicker durations. */
export function formatSeconds(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`;
}

/** Response speed in responses per second, two decimals. */
export function formatSpeed(speed: number | null): string {
  return speed === null ? '—' : `${speed.toFixed(2)}/s`;
}

/** A rate in [0,1] as a whole percentage. */
export function formatPercent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** A d′ against the ceiling its trial counts allow, e.g. "3.12 of 4.68". */
export function formatDPrime(value: number, ceiling: number): string {
  return `${value.toFixed(2)} of ${ceiling.toFixed(2)}`;
}

/** A count with its denominator, e.g. "4 of 96". */
export function formatCount(count: number, total: number): string {
  return `${count} of ${total}`;
}
