import { describe, expect, it } from 'vitest';
import { N_MIN, empiricalZ, normalizeSpan, proxyNormalizeSpan } from './normalize';

describe('proxyNormalizeSpan', () => {
  it('maps the structural midpoint to 0 and the range edges to ~±2', () => {
    expect(proxyNormalizeSpan(4.5)).toBeCloseTo(0, 10);
    expect(proxyNormalizeSpan(9)).toBeCloseTo(2, 10);
    expect(proxyNormalizeSpan(0)).toBeCloseTo(-2, 10);
  });

  it('clamps to ±Z_CAP (3)', () => {
    expect(proxyNormalizeSpan(1000)).toBe(3);
    expect(proxyNormalizeSpan(-1000)).toBe(-3);
  });
});

describe('empiricalZ', () => {
  it('is 0 at the sample mean', () => {
    expect(empiricalZ(5, [2, 4, 6, 8])).toBeCloseTo(0, 10);
  });

  it('uses population std: one SD above the mean is z = 1', () => {
    // [3,7]: mean 5, population std 2 -> z(7) = 1
    expect(empiricalZ(7, [3, 7])).toBeCloseTo(1, 10);
  });

  it('returns 0 when the sample has no spread (avoids divide-by-zero)', () => {
    expect(empiricalZ(9, [3, 3, 3])).toBe(0);
  });
});

describe('normalizeSpan (switch at N_MIN)', () => {
  it('N_MIN is 200', () => {
    expect(N_MIN).toBe(200);
  });

  it('uses the monotonic proxy below N_MIN samples', () => {
    const samples = Array(N_MIN - 1).fill(5); // 199 samples
    expect(normalizeSpan(9, samples)).toBeCloseTo(proxyNormalizeSpan(9), 10); // ~2, not empirical
  });

  it('switches to empirical z at N_MIN samples', () => {
    const samples = Array(N_MIN).fill(5); // 200 identical samples -> std 0 -> z 0
    expect(normalizeSpan(9, samples)).toBe(0); // empirical (0), not the proxy (2)
  });
});
