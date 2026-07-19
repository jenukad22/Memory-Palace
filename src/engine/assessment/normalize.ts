/**
 * Span raw-score normalization (SPEC.md sec 2.1). Deferred design: until N_MIN
 * valid samples exist for an instrument, seed Elo from a fixed monotonic proxy;
 * after that, switch to an empirical z-score over the accumulated samples.
 *
 * SPAN_MID / SPAN_SPREAD are structural scalings of the achievable-span axis
 * [0, 9] — NOT population statistics and NOT derived from any lab norm.
 */

export const SPAN_MID = 4.5;
export const SPAN_SPREAD = 2.25;
export const Z_CAP = 3;
export const N_MIN = 200;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fixed monotonic map from a span to a normalized proxy in [-Z_CAP, +Z_CAP]. */
export function proxyNormalizeSpan(span: number): number {
  return clamp((span - SPAN_MID) / SPAN_SPREAD, -Z_CAP, Z_CAP);
}

/** Population z-score of `raw` against `samples`; 0 when the sample has no spread. */
export function empiricalZ(raw: number, samples: number[]): number {
  if (samples.length === 0) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (raw - mean) / std;
}

/**
 * Normalized span score: the monotonic proxy while `samples.length < N_MIN`,
 * empirical z once enough samples have accumulated for the instrument.
 */
export function normalizeSpan(raw: number, samples: number[]): number {
  return samples.length >= N_MIN ? empiricalZ(raw, samples) : proxyNormalizeSpan(raw);
}
