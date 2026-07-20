import { describe, expect, it } from 'vitest';
import {
  BASELINE_DIFFICULTY,
  MAX_PAO_NUMBERS,
  MIN_PALACE_ITEMS,
  MIN_PAO_NUMBERS,
  PAO_EXPOSURE_MAX_MS,
  PAO_EXPOSURE_MIN_MS,
  palaceListLength,
  paoDrillParams,
  sessionDifficulty,
} from './difficulty';

describe('sessionDifficulty', () => {
  it('uses the baseline when there is no history', () => {
    expect(sessionDifficulty(null)).toBe(BASELINE_DIFFICULTY);
  });

  it('eases below and pushes above the target success band', () => {
    expect(sessionDifficulty(0.5)).toBeLessThan(BASELINE_DIFFICULTY); // struggling -> easier
    expect(sessionDifficulty(1)).toBeGreaterThan(BASELINE_DIFFICULTY); // acing -> harder
  });
});

describe('palaceListLength', () => {
  it('never exceeds the number of loci and honours the floor', () => {
    expect(palaceListLength(1, 10)).toBeLessThanOrEqual(10);
    expect(palaceListLength(0, 10)).toBe(MIN_PALACE_ITEMS);
    expect(palaceListLength(1, 2)).toBe(2); // fewer loci than the floor caps at loci count
  });

  it('grows with difficulty', () => {
    expect(palaceListLength(1, 12)).toBeGreaterThan(palaceListLength(0, 12));
  });
});

describe('paoDrillParams', () => {
  it('bounds count and exposure and trades one against the other', () => {
    const easy = paoDrillParams(0);
    const hard = paoDrillParams(1);
    expect(easy.count).toBe(MIN_PAO_NUMBERS);
    expect(hard.count).toBe(MAX_PAO_NUMBERS);
    expect(easy.exposureMs).toBe(PAO_EXPOSURE_MAX_MS);
    expect(hard.exposureMs).toBe(PAO_EXPOSURE_MIN_MS);
    expect(hard.count).toBeGreaterThan(easy.count);
    expect(hard.exposureMs).toBeLessThan(easy.exposureMs);
  });
});
