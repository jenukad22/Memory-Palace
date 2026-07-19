/**
 * Scoring and stopping-rule logic for the span instruments and VVIQ. Pure — the
 * screens feed in trial outcomes and responses; this module owns the span
 * administration rule and the raw-score math (SPEC.md sec 3-5, 8).
 */

export const DIGIT_SPAN_START = 3;
export const CORSI_SPAN_START = 2;
export const SPAN_MAX_LENGTH = 9;

export type SpanDirection = 'forward' | 'backward';

/** A trial is correct when the entered order matches the shown order (reversed for backward). */
export function isTrialCorrect(
  shown: number[],
  entered: number[],
  direction: SpanDirection,
): boolean {
  const expected = direction === 'backward' ? [...shown].reverse() : shown;
  if (entered.length !== expected.length) return false;
  return expected.every((v, i) => entered[i] === v);
}

export interface SpanState {
  /** Length currently being presented. */
  currentLength: number;
  /** Pass/fail of trials recorded at the current length (max 2). */
  trialsAtLength: boolean[];
  /** Longest length reproduced so far; floors at startLength - 1. */
  span: number;
  finished: boolean;
}

export function initSpanState(startLength: number): SpanState {
  return {
    currentLength: startLength,
    trialsAtLength: [],
    span: startLength - 1,
    finished: false,
  };
}

const TRIALS_PER_LENGTH = 2;

/**
 * Record one trial outcome. Two trials per length: after both, if at least one
 * passed the length is reproduced (advance, or finish at the cap); if both fail,
 * discontinue. Returns the state unchanged once finished.
 */
export function recordSpanTrial(
  state: SpanState,
  passed: boolean,
  opts: { maxLength: number },
): SpanState {
  if (state.finished) return state;

  const trialsAtLength = [...state.trialsAtLength, passed];
  if (trialsAtLength.length < TRIALS_PER_LENGTH) {
    return { ...state, trialsAtLength };
  }

  const reproduced = trialsAtLength.some(Boolean);
  if (!reproduced) {
    return { ...state, trialsAtLength, finished: true };
  }

  const span = state.currentLength;
  if (state.currentLength >= opts.maxLength) {
    return { ...state, trialsAtLength, span, finished: true };
  }
  return {
    currentLength: state.currentLength + 1,
    trialsAtLength: [],
    span,
    finished: false,
  };
}

export const VVIQ_ITEM_COUNT = 16;
export const VVIQ_APHANTASIA_THRESHOLD = 32;

/** Sum of the 16 VVIQ items (each 1-5), range 16-80. Higher = more vivid. */
export function vviqTotal(responses: number[]): number {
  if (responses.length !== VVIQ_ITEM_COUNT) {
    throw new RangeError(
      `VVIQ needs exactly ${VVIQ_ITEM_COUNT} responses, got ${responses.length}`,
    );
  }
  for (const r of responses) {
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new RangeError(`VVIQ responses must be integers in [1, 5], got ${r}`);
    }
  }
  return responses.reduce((a, b) => a + b, 0);
}

export type MemoryStrategy = 'visual' | 'non-visual';

/** Route low-imagery users (total <= 32) to the non-visual encoding strategy (SPEC.md sec 8). */
export function vviqStrategy(total: number): MemoryStrategy {
  return total <= VVIQ_APHANTASIA_THRESHOLD ? 'non-visual' : 'visual';
}
