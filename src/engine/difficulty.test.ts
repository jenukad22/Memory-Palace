import { describe, expect, it } from 'vitest';
import { DEFAULT_TARGET_HIGH, DEFAULT_TARGET_LOW, nextDifficulty } from './difficulty';

describe('nextDifficulty: inside the target band', () => {
  it('holds difficulty steady when accuracy is within [0.80, 0.90]', () => {
    for (const accuracy of [0.8, 0.85, 0.9]) {
      expect(nextDifficulty(0.5, accuracy)).toBe(0.5);
    }
  });

  it('treats the band edges as inclusive', () => {
    expect(nextDifficulty(0.4, DEFAULT_TARGET_LOW)).toBe(0.4);
    expect(nextDifficulty(0.4, DEFAULT_TARGET_HIGH)).toBe(0.4);
  });
});

describe('nextDifficulty: outside the target band', () => {
  it('raises difficulty when accuracy is above the band', () => {
    expect(nextDifficulty(0.5, 0.95)).toBeGreaterThan(0.5);
    expect(nextDifficulty(0.5, 1)).toBeGreaterThan(0.5);
  });

  it('lowers difficulty when accuracy is below the band', () => {
    expect(nextDifficulty(0.5, 0.7)).toBeLessThan(0.5);
    expect(nextDifficulty(0.5, 0)).toBeLessThan(0.5);
  });

  it('adjusts more aggressively the further accuracy is from the band', () => {
    const mild = 0.5 - nextDifficulty(0.5, 0.75);
    const severe = 0.5 - nextDifficulty(0.5, 0.4);
    expect(severe).toBeGreaterThan(mild);
  });
});

describe('nextDifficulty: accuracy extremes', () => {
  it('handles perfect accuracy (1.0) and clamps at the maximum', () => {
    expect(nextDifficulty(0.98, 1)).toBeLessThanOrEqual(1);
    expect(nextDifficulty(1, 1)).toBe(1);
  });

  it('handles zero accuracy and clamps at the minimum', () => {
    expect(nextDifficulty(0.02, 0)).toBeGreaterThanOrEqual(0);
    expect(nextDifficulty(0, 0)).toBe(0);
  });
});

describe('nextDifficulty: input validation', () => {
  it('rejects accuracy outside [0, 1]', () => {
    expect(() => nextDifficulty(0.5, -0.1)).toThrow();
    expect(() => nextDifficulty(0.5, 1.1)).toThrow();
    expect(() => nextDifficulty(0.5, Number.NaN)).toThrow();
  });
});

describe('nextDifficulty: configuration', () => {
  it('respects a custom target band', () => {
    const config = { targetLow: 0.6, targetHigh: 0.7 };
    expect(nextDifficulty(0.5, 0.65, config)).toBe(0.5);
    expect(nextDifficulty(0.5, 0.85, config)).toBeGreaterThan(0.5);
  });

  it('scales the adjustment with the gain', () => {
    const gentle = nextDifficulty(0.5, 1, { gain: 0.1 });
    const sharp = nextDifficulty(0.5, 1, { gain: 1 });
    expect(sharp - 0.5).toBeGreaterThan(gentle - 0.5);
  });

  it('clamps to custom bounds', () => {
    expect(nextDifficulty(9.9, 1, { min: 1, max: 10, gain: 5 })).toBeLessThanOrEqual(10);
    expect(nextDifficulty(1.1, 0, { min: 1, max: 10, gain: 5 })).toBeGreaterThanOrEqual(1);
  });
});

describe('nextDifficulty: determinism', () => {
  it('returns the same output for the same input', () => {
    expect(nextDifficulty(0.42, 0.95)).toBe(nextDifficulty(0.42, 0.95));
  });
});
