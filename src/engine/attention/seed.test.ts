import { describe, expect, it } from 'vitest';
import { N_MIN, Z_CAP } from '../assessment/normalize';
import { ELO_MIDPOINT } from '../assessment/seedElo';
import {
  CPT_DPRIME_CEILING,
  CPT_DPRIME_MID,
  FLICKER_DETECTION_MID_MS,
  PVT_SPEED_MID,
  attentionNormalizedScores,
  normalizeCptDPrime,
  normalizeFlickerDetectionMs,
  normalizePvtSpeed,
  proxyNormalizeCptDPrime,
  proxyNormalizeFlickerDetectionMs,
  proxyNormalizePvtSpeed,
  seedAttentionElo,
} from './seed';
import { FLICKER_TIMEOUT_MS, PVTB_LAPSE_MS } from './timing';

describe('proxy axes are structural, derived from each task', () => {
  it('centres PVT speed on the task’s own lapse threshold', () => {
    expect(PVT_SPEED_MID).toBeCloseTo(1000 / PVTB_LAPSE_MS, 10);
    expect(proxyNormalizePvtSpeed(PVT_SPEED_MID)).toBeCloseTo(0, 10);
  });

  it('centres CPT d′ on half its own ceiling', () => {
    expect(CPT_DPRIME_MID).toBeCloseTo(CPT_DPRIME_CEILING / 2, 10);
    expect(proxyNormalizeCptDPrime(CPT_DPRIME_MID)).toBeCloseTo(0, 10);
    // A flawless run lands near the top of the axis, not off it.
    expect(proxyNormalizeCptDPrime(CPT_DPRIME_CEILING)).toBeCloseTo(2, 10);
    expect(proxyNormalizeCptDPrime(0)).toBeCloseTo(-2, 10);
  });

  it('centres flicker detection on half its own timeout', () => {
    expect(FLICKER_DETECTION_MID_MS).toBe(FLICKER_TIMEOUT_MS / 2);
    expect(proxyNormalizeFlickerDetectionMs(FLICKER_DETECTION_MID_MS)).toBeCloseTo(0, 10);
    expect(proxyNormalizeFlickerDetectionMs(0)).toBeCloseTo(2, 10);
    expect(proxyNormalizeFlickerDetectionMs(FLICKER_TIMEOUT_MS)).toBeCloseTo(-2, 10);
  });
});

describe('proxy direction and clamping', () => {
  it('scores a faster PVT higher', () => {
    expect(proxyNormalizePvtSpeed(4)).toBeGreaterThan(proxyNormalizePvtSpeed(2));
  });

  it('scores a higher d′ higher', () => {
    expect(proxyNormalizeCptDPrime(3)).toBeGreaterThan(proxyNormalizeCptDPrime(1));
  });

  it('scores a FASTER flicker detection higher (the axis is inverted)', () => {
    expect(proxyNormalizeFlickerDetectionMs(5000)).toBeGreaterThan(
      proxyNormalizeFlickerDetectionMs(45000),
    );
  });

  it('clamps every proxy to ±Z_CAP', () => {
    expect(proxyNormalizePvtSpeed(1000)).toBe(Z_CAP);
    expect(proxyNormalizePvtSpeed(-1000)).toBe(-Z_CAP);
    expect(proxyNormalizeCptDPrime(1000)).toBe(Z_CAP);
    expect(proxyNormalizeCptDPrime(-1000)).toBe(-Z_CAP);
    expect(proxyNormalizeFlickerDetectionMs(-1e9)).toBe(Z_CAP);
    expect(proxyNormalizeFlickerDetectionMs(1e9)).toBe(-Z_CAP);
  });
});

describe('proxy → empirical switch at N_MIN', () => {
  const samples = (n: number, value: number) => Array.from({ length: n }, () => value);

  it('uses the proxy below N_MIN samples', () => {
    expect(normalizePvtSpeed(3, samples(N_MIN - 1, 2))).toBeCloseTo(proxyNormalizePvtSpeed(3), 10);
    expect(normalizePvtSpeed(3, [])).toBeCloseTo(proxyNormalizePvtSpeed(3), 10);
  });

  it('switches to empirical z at N_MIN samples', () => {
    // Half the sample at 2, half at 4: mean 3, so raw 4 is +1 SD.
    const accumulated = [...samples(N_MIN / 2, 2), ...samples(N_MIN / 2, 4)];
    expect(normalizePvtSpeed(4, accumulated)).toBeCloseTo(1, 10);
    expect(normalizeCptDPrime(4, accumulated)).toBeCloseTo(1, 10);
  });

  it('keeps the flicker sign flipped on the empirical branch too', () => {
    const accumulated = [...samples(N_MIN / 2, 10000), ...samples(N_MIN / 2, 30000)];
    // 30000 ms is the SLOW end, so its normalized score must be negative.
    expect(normalizeFlickerDetectionMs(30000, accumulated)).toBeCloseTo(-1, 10);
    expect(normalizeFlickerDetectionMs(10000, accumulated)).toBeCloseTo(1, 10);
  });
});

describe('attentionNormalizedScores', () => {
  it('is empty when nothing has been completed', () => {
    expect(attentionNormalizedScores({})).toEqual([]);
    expect(
      attentionNormalizedScores({
        pvtResponseSpeed: null,
        cptDPrime: null,
        flickerDetectionMs: null,
      }),
    ).toEqual([]);
  });

  it('includes only the tasks with results', () => {
    expect(attentionNormalizedScores({ pvtResponseSpeed: 3 })).toHaveLength(1);
    expect(attentionNormalizedScores({ pvtResponseSpeed: 3, cptDPrime: 2 })).toHaveLength(2);
    expect(
      attentionNormalizedScores({ pvtResponseSpeed: 3, cptDPrime: 2, flickerDetectionMs: 9000 }),
    ).toHaveLength(3);
  });
});

describe('seedAttentionElo', () => {
  it('is null until at least one task is done — no Elo may be written', () => {
    expect(seedAttentionElo({})).toBeNull();
  });

  it('lands at the Elo midpoint for a mid-axis run', () => {
    const elo = seedAttentionElo({
      pvtResponseSpeed: PVT_SPEED_MID,
      cptDPrime: CPT_DPRIME_MID,
      flickerDetectionMs: FLICKER_DETECTION_MID_MS,
    });
    expect(elo).toBeCloseTo(ELO_MIDPOINT, 6);
  });

  it('rises with better performance on every component', () => {
    const weak = seedAttentionElo({
      pvtResponseSpeed: 1.8,
      cptDPrime: 0.5,
      flickerDetectionMs: 50000,
    })!;
    const strong = seedAttentionElo({
      pvtResponseSpeed: 4.2,
      cptDPrime: 3.5,
      flickerDetectionMs: 8000,
    })!;
    expect(strong).toBeGreaterThan(weak);
  });

  it('works from a single completed task', () => {
    const elo = seedAttentionElo({ pvtResponseSpeed: PVT_SPEED_MID });
    expect(elo).toBeCloseTo(ELO_MIDPOINT, 6);
  });

  it('stays inside the Elo bounds at the extremes', () => {
    const floor = seedAttentionElo({
      pvtResponseSpeed: 0,
      cptDPrime: -10,
      flickerDetectionMs: FLICKER_TIMEOUT_MS,
    })!;
    const ceiling = seedAttentionElo({
      pvtResponseSpeed: 100,
      cptDPrime: 100,
      flickerDetectionMs: 0,
    })!;
    expect(floor).toBeGreaterThanOrEqual(400);
    expect(ceiling).toBeLessThanOrEqual(2400);
    expect(ceiling).toBeGreaterThan(floor);
  });
});
