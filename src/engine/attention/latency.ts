/**
 * Presentation-timing measurement for the attention tasks
 * (modules/attention/SPEC.md §3). Pure: the screens capture the timestamps,
 * this reduces them to a profile and to the uncertainty band the module is
 * willing to claim on a single reaction time.
 *
 * The structure that matters is in the screens, not here: stimulus onset is
 * timestamped on the frame that paints it, so scheduler drift moves *when* a
 * trial starts and never leaks into the RT it records. Drift is therefore
 * reported as its own number rather than folded into the reaction times.
 */

/**
 * One stimulus presentation: when the app asked for it, and when the frame
 * that showed it actually ran.
 *
 * `requestedMs` is read immediately before the state update that shows the
 * stimulus — *not* the timer's intended fire time. The delay between the two is
 * commit-to-paint latency, which is what bounds the error on a reaction time: a
 * JS thread busy enough to delay a paint delays event dispatch too. Timer
 * lateness is deliberately excluded: it shifts when a trial begins, and the
 * PVT's interval is random by design, so it corrupts nothing.
 */
export interface OnsetSample {
  /** Monotonic clock read just before the update that shows the stimulus. */
  requestedMs: number;
  /** Observed onset — the clock read inside the frame that painted the stimulus. */
  paintedMs: number;
}

/** One 60 Hz frame. Onsets later than this missed their frame. */
export const FRAME_BUDGET_MS = 1000 / 60;

/**
 * requestAnimationFrame runs at the start of the frame that paints the stimulus;
 * the photons follow up to one refresh interval later. Not observable from JS,
 * so it is carried as uncertainty rather than corrected for.
 */
export const FRAME_PRESENTATION_MS = FRAME_BUDGET_MS;

/** Assumed floor on clock resolution — browsers deliberately coarsen performance.now(). */
export const HIGH_RES_CLOCK_RESOLUTION_MS = 1;

/** Date.now() resolution, the fallback when no high-resolution clock exists. */
export const LOW_RES_CLOCK_RESOLUTION_MS = 1;

export type TimingQuality = 'good' | 'fair' | 'poor' | 'unmeasured';

/** p95 drift at or below this is `good`; at or below FAIR it is `fair`. */
export const QUALITY_GOOD_MAX_MS = FRAME_BUDGET_MS;
export const QUALITY_FAIR_MAX_MS = FRAME_BUDGET_MS * 3;

export interface TimingProfile {
  /** Number of stimulus onsets measured. */
  samples: number;
  medianDriftMs: number;
  p95DriftMs: number;
  maxDriftMs: number;
  /** Onsets that missed the frame budget. */
  lateOnsets: number;
  /** False when the run fell back to Date.now(). */
  highResolutionClock: boolean;
  quality: TimingQuality;
  /** The ± band claimable on any single reaction time in this run. */
  rtUncertaintyMs: number;
}

/**
 * Linear-interpolated percentile of an unsorted sample, p in [0, 1].
 * Returns 0 for an empty sample so callers get a number, not a NaN, in a
 * profile that already reports `samples: 0`.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  if (!(p >= 0 && p <= 1)) throw new RangeError(`percentile expects p in [0, 1], got ${p}`);
  const sorted = [...values].sort((a, b) => a - b);
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const value = sorted[lo]!;
  return lo === hi ? value : value + (sorted[hi]! - value) * (rank - lo);
}

export function median(values: readonly number[]): number {
  return percentile(values, 0.5);
}

/** Painted-minus-requested delay of one onset. Negative values are kept as measured. */
export function driftMs(sample: OnsetSample): number {
  return sample.paintedMs - sample.requestedMs;
}

export function timingQuality(samples: number, p95DriftMs: number): TimingQuality {
  if (samples === 0) return 'unmeasured';
  if (p95DriftMs <= QUALITY_GOOD_MAX_MS) return 'good';
  if (p95DriftMs <= QUALITY_FAIR_MAX_MS) return 'fair';
  return 'poor';
}

/**
 * The ± band on a single RT. Frame presentation and clock resolution are
 * irreducible; p95 drift is carried because a JS thread busy enough to delay a
 * frame also delays the event dispatch that stops the clock.
 *
 * It deliberately excludes device input latency (touchscreen scan, OS input
 * pipeline), which is a positive bias of tens of ms that cannot be measured from
 * inside the app. That is disclosed in copy instead of being guessed at here.
 */
export function rtUncertaintyMs(p95DriftMs: number, highResolutionClock: boolean): number {
  const clock = highResolutionClock ? HIGH_RES_CLOCK_RESOLUTION_MS : LOW_RES_CLOCK_RESOLUTION_MS;
  return FRAME_PRESENTATION_MS + clock + Math.max(0, p95DriftMs);
}

export interface SummarizeOnsetsOptions {
  highResolutionClock: boolean;
}

/** Reduce a run's onset samples to the profile reported alongside its scores. */
export function summarizeOnsets(
  samples: readonly OnsetSample[],
  options: SummarizeOnsetsOptions,
): TimingProfile {
  const drifts = samples.map(driftMs);
  const p95 = percentile(drifts, 0.95);
  return {
    samples: samples.length,
    medianDriftMs: median(drifts),
    p95DriftMs: p95,
    maxDriftMs: drifts.length === 0 ? 0 : Math.max(...drifts),
    lateOnsets: drifts.filter((d) => d > FRAME_BUDGET_MS).length,
    highResolutionClock: options.highResolutionClock,
    quality: timingQuality(samples.length, p95),
    rtUncertaintyMs: rtUncertaintyMs(p95, options.highResolutionClock),
  };
}
