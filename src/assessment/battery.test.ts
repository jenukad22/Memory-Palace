import { describe, expect, it } from 'vitest';
import { batteryFills, checkpointCopy, doneSet, nextRoute, spanPayload } from './battery';

describe('nextRoute (SPEC order: VVIQ -> digit span -> Corsi)', () => {
  it('walks the battery in order as instruments complete', () => {
    expect(nextRoute(new Set())).toBe('/onboarding/vviq');
    expect(nextRoute(new Set(['vviq']))).toBe('/onboarding/digitspan');
    expect(nextRoute(new Set(['vviq', 'digitspan_forward']))).toBe('/onboarding/digitspan');
    expect(nextRoute(new Set(['vviq', 'digitspan_forward', 'digitspan_backward']))).toBe(
      '/onboarding/corsi',
    );
    expect(
      nextRoute(new Set(['vviq', 'digitspan_forward', 'digitspan_backward', 'corsi_forward'])),
    ).toBe('/onboarding/corsi');
    expect(
      nextRoute(
        new Set([
          'vviq',
          'digitspan_forward',
          'digitspan_backward',
          'corsi_forward',
          'corsi_backward',
        ]),
      ),
    ).toBe('/onboarding/complete');
  });

  it('doneSet derives from assessments rows', () => {
    expect(doneSet([{ instrument: 'vviq' }, { instrument: 'vviq' }])).toEqual(new Set(['vviq']));
  });
});

describe('batteryFills (half-fill per pass)', () => {
  it('fills segments 0 / 0.5 / 1 as passes complete', () => {
    expect(batteryFills(new Set())).toEqual([0, 0, 0]);
    expect(batteryFills(new Set(['vviq', 'digitspan_forward']))).toEqual([1, 0.5, 0]);
    expect(
      batteryFills(
        new Set([
          'vviq',
          'digitspan_forward',
          'digitspan_backward',
          'corsi_forward',
          'corsi_backward',
        ]),
      ),
    ).toEqual([1, 1, 1]);
  });
});

describe('checkpointCopy', () => {
  it('names the next task after VVIQ and after digit span', () => {
    expect(checkpointCopy(new Set(['vviq'])).continueLabel).toBe('Continue to digit span');
    expect(
      checkpointCopy(new Set(['vviq', 'digitspan_forward', 'digitspan_backward'])).continueLabel,
    ).toBe('Continue to Corsi');
  });
});

describe('spanPayload', () => {
  it('round-trips per-trial detail as JSON', () => {
    const json = spanPayload([
      { length: 3, passed: true },
      { length: 3, passed: false },
    ]);
    expect(JSON.parse(json)).toEqual({
      trials: [
        { length: 3, passed: true },
        { length: 3, passed: false },
      ],
    });
  });
});
