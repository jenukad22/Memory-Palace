import { describe, expect, it } from 'vitest';
import {
  CORSI_SPAN_START,
  DIGIT_SPAN_START,
  SPAN_MAX_LENGTH,
  VVIQ_APHANTASIA_THRESHOLD,
  initSpanState,
  isTrialCorrect,
  recordSpanTrial,
  vviqStrategy,
  vviqTotal,
  type SpanState,
} from './scoring';

function runSpan(startLength: number, outcomes: boolean[], maxLength = SPAN_MAX_LENGTH): SpanState {
  let s = initSpanState(startLength);
  for (const passed of outcomes) {
    if (s.finished) break;
    s = recordSpanTrial(s, passed, { maxLength });
  }
  return s;
}

describe('isTrialCorrect', () => {
  it('forward: entered must equal shown', () => {
    expect(isTrialCorrect([1, 2, 3], [1, 2, 3], 'forward')).toBe(true);
    expect(isTrialCorrect([1, 2, 3], [1, 3, 2], 'forward')).toBe(false);
  });

  it('backward: entered must equal the reverse of shown', () => {
    expect(isTrialCorrect([1, 2, 3], [3, 2, 1], 'backward')).toBe(true);
    expect(isTrialCorrect([1, 2, 3], [1, 2, 3], 'backward')).toBe(false);
  });

  it('length mismatch is incorrect', () => {
    expect(isTrialCorrect([1, 2, 3], [1, 2], 'forward')).toBe(false);
  });
});

describe('span administration (two trials/length, 1-of-2 reproduced, discontinue on double-fail)', () => {
  it('span = longest length reproduced before both trials fail', () => {
    // L3 repro, L4 repro, L5 repro, L6 both fail -> span 5
    const s = runSpan(3, [true, false, true, false, true, false, false, false]);
    expect(s.finished).toBe(true);
    expect(s.span).toBe(5);
  });

  it('reproduced needs only 1 of 2 correct', () => {
    // L3 second-trial pass reproduces; L4 both fail -> span 3
    const s = runSpan(3, [false, true, false, false]);
    expect(s.span).toBe(3);
    expect(s.finished).toBe(true);
  });

  it('failing both trials at the start length floors span at startLength - 1', () => {
    const s = runSpan(3, [false, false]);
    expect(s.finished).toBe(true);
    expect(s.span).toBe(2);
  });

  it('requires two trials before advancing or stopping', () => {
    const s = runSpan(3, [true]);
    expect(s.finished).toBe(false);
    expect(s.span).toBe(2); // no length reproduced yet (floor)
    expect(s.currentLength).toBe(3);
  });

  it('reproducing at the max length finishes with span = max', () => {
    // lengths 3..9 all reproduced (both trials) -> span 9, finished at the cap
    const outcomes: boolean[] = [];
    for (let len = 3; len <= 9; len += 1) outcomes.push(true, true);
    const s = runSpan(3, outcomes, 9);
    expect(s.finished).toBe(true);
    expect(s.span).toBe(9);
  });

  it('advances the presented length after a length is reproduced', () => {
    let s = initSpanState(3);
    s = recordSpanTrial(s, true, { maxLength: 9 }); // L3 trial 1
    s = recordSpanTrial(s, true, { maxLength: 9 }); // L3 trial 2 -> advance
    expect(s.currentLength).toBe(4);
    expect(s.finished).toBe(false);
  });
});

describe('span constants', () => {
  it('match the spec starts and cap', () => {
    expect(DIGIT_SPAN_START).toBe(3);
    expect(CORSI_SPAN_START).toBe(2);
    expect(SPAN_MAX_LENGTH).toBe(9);
  });
});

describe('vviqTotal', () => {
  it('sums 16 items in [1,5] to the 16-80 range', () => {
    expect(vviqTotal(Array(16).fill(1))).toBe(16);
    expect(vviqTotal(Array(16).fill(5))).toBe(80);
    const mixed = [5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 5];
    expect(vviqTotal(mixed)).toBe(mixed.reduce((a, b) => a + b, 0));
  });

  it('rejects the wrong item count', () => {
    expect(() => vviqTotal(Array(15).fill(3))).toThrow();
    expect(() => vviqTotal(Array(17).fill(3))).toThrow();
  });

  it('rejects out-of-range responses', () => {
    const bad = Array(16).fill(3);
    bad[0] = 0;
    expect(() => vviqTotal(bad)).toThrow();
    bad[0] = 6;
    expect(() => vviqTotal(bad)).toThrow();
  });
});

describe('vviqStrategy', () => {
  it('routes <= 32 to the non-visual strategy, above to visual', () => {
    expect(VVIQ_APHANTASIA_THRESHOLD).toBe(32);
    expect(vviqStrategy(32)).toBe('non-visual');
    expect(vviqStrategy(16)).toBe('non-visual');
    expect(vviqStrategy(33)).toBe('visual');
    expect(vviqStrategy(80)).toBe('visual');
  });
});
