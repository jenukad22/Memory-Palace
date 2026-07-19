/**
 * Pure battery-orchestration helpers (no React, no timing). The battery's
 * done-state derives from assessments rows — resume needs no extra store
 * (SPEC.md sec 1: finish-later checkpoints between instruments).
 */

export const SPAN_INSTRUMENTS = [
  'digitspan_forward',
  'digitspan_backward',
  'corsi_forward',
  'corsi_backward',
] as const;

export const BATTERY_INSTRUMENTS = ['vviq', ...SPAN_INSTRUMENTS] as const;

export type BatteryInstrument = (typeof BATTERY_INSTRUMENTS)[number];

export function doneSet(rows: { instrument: string }[]): Set<string> {
  return new Set(rows.map((r) => r.instrument));
}

export type BatteryRoute =
  '/onboarding/vviq' | '/onboarding/digitspan' | '/onboarding/corsi' | '/onboarding/complete';

/** Next screen in SPEC order: VVIQ -> digit span (F, B) -> Corsi (F, B). */
export function nextRoute(done: Set<string>): BatteryRoute {
  if (!done.has('vviq')) return '/onboarding/vviq';
  if (!done.has('digitspan_forward') || !done.has('digitspan_backward')) {
    return '/onboarding/digitspan';
  }
  if (!done.has('corsi_forward') || !done.has('corsi_backward')) return '/onboarding/corsi';
  return '/onboarding/complete';
}

/**
 * Battery progress as three task segments (DESIGN.md sec 2.8): forward and
 * backward passes half-fill their task's segment.
 */
export function batteryFills(done: Set<string>): [number, number, number] {
  const half = (a: string, b: string) => (done.has(a) ? 0.5 : 0) + (done.has(b) ? 0.5 : 0);
  return [
    done.has('vviq') ? 1 : 0,
    half('digitspan_forward', 'digitspan_backward'),
    half('corsi_forward', 'corsi_backward'),
  ];
}

export interface CheckpointCopy {
  title: string;
  body: string;
  continueLabel: string;
}

/** Copy for the between-instruments checkpoint. Task-specific, never guilt-trips. */
export function checkpointCopy(done: Set<string>): CheckpointCopy {
  const next = nextRoute(done);
  if (next === '/onboarding/digitspan') {
    return {
      title: 'Imagery ratings done',
      body: 'Next: digit span, about 4 minutes. Your progress is saved either way.',
      continueLabel: 'Continue to digit span',
    };
  }
  if (next === '/onboarding/corsi') {
    return {
      title: 'Digit span done',
      body: 'One task left: Corsi block-tapping, about 4 minutes. Your progress is saved either way.',
      continueLabel: 'Continue to Corsi',
    };
  }
  return {
    title: 'Baseline complete',
    body: 'All tasks are done.',
    continueLabel: 'See your results',
  };
}

export interface SpanTrialLogEntry {
  length: number;
  passed: boolean;
}

/** Per-trial detail for assessments.payload (SPEC.md sec 12 follow-up). */
export function spanPayload(trials: SpanTrialLogEntry[]): string {
  return JSON.stringify({ trials });
}
