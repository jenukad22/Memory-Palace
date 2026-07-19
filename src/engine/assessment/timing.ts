/**
 * Stimulus presentation timing (SPEC.md sec 4-5). Engine-owned so screens
 * carry no timing literals: digits at ~1/sec, Corsi blocks slightly slower.
 */

export const DIGIT_ON_MS = 800;
export const DIGIT_GAP_MS = 200;

export const CORSI_ON_MS = 1000;
export const CORSI_GAP_MS = 250;

/** Lead-in pause before the first stimulus of a trial (screens' settle time). */
export const TRIAL_LEAD_IN_MS = 500;
