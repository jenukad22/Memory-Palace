/**
 * Stimulus presentation timing for the attention tasks (modules/attention/SPEC.md
 * §4). Engine-owned so the screens carry no timing literals — the numbers that
 * define each paradigm live here, next to the scoring rules that consume them.
 */

// ---------------------------------------------------------------------------
// PVT-B (SPEC §4.1) — the 3-minute brief variant.
// ---------------------------------------------------------------------------

/** Total task duration. A trial that has already started always finishes. */
export const PVTB_DURATION_MS = 180_000;

/**
 * Inter-stimulus interval, uniform in [min, max]. 1-4 s is the PVT-B interval
 * (the 2-10 s recorded in assessment/SPEC.md §7 belongs to the 10-minute PVT and
 * would yield roughly a third of the trials in 3 minutes — see SPEC §1).
 */
export const PVTB_ISI_MIN_MS = 1000;
export const PVTB_ISI_MAX_MS = 4000;

/** A stimulus left unanswered this long ends the trial as a non-response. */
export const PVTB_MAX_STIMULUS_MS = 3000;

/** RT at or above this counts as a lapse (assessment/SPEC.md §7). */
export const PVTB_LAPSE_MS = 355;

/** Below this an "RT" is an anticipation, not a response to the stimulus. */
export const PVTB_FALSE_START_MS = 100;

/** How long the post-response readout (the RT, or "too soon") stays up. */
export const PVTB_FEEDBACK_MS = 700;

// ---------------------------------------------------------------------------
// CPT go/no-go (SPEC §4.2)
// ---------------------------------------------------------------------------

export const CPT_TRIALS = 120;
export const CPT_STIMULUS_MS = 250;
export const CPT_BLANK_MS = 1000;

/** Responses are accepted from onset until the end of the following blank. */
export const CPT_RESPONSE_WINDOW_MS = CPT_STIMULUS_MS + CPT_BLANK_MS;

/**
 * Share of trials that are the withhold-on distractor. High enough that the
 * commission rate rests on ~30 no-go trials, low enough that the go response
 * stays prepotent — which is the only thing that makes withholding measurable.
 */
export const CPT_DISTRACTOR_RATE = 0.25;

// ---------------------------------------------------------------------------
// Change-blindness flicker (SPEC §4.3)
// ---------------------------------------------------------------------------

export const FLICKER_SCENE_MS = 500;
export const FLICKER_BLANK_MS = 80;

/** One full A -> blank -> A' -> blank alternation. */
export const FLICKER_CYCLE_MS = (FLICKER_SCENE_MS + FLICKER_BLANK_MS) * 2;

/** A trial the user hasn't solved by here is recorded as a miss. */
export const FLICKER_TIMEOUT_MS = 60_000;

export const FLICKER_TRIALS = 4;

/** Whole alternations elapsed after `ms` of flickering. */
export function flickerCycles(ms: number): number {
  return Math.floor(Math.max(0, ms) / FLICKER_CYCLE_MS);
}
