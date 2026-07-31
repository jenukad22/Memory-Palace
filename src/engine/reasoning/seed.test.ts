import { describe, expect, it } from 'vitest';
import { N_MIN, Z_CAP } from '../assessment/normalize';
import { ELO_MIDPOINT } from '../assessment/seedElo';
import {
  BASE_RATE_ERROR_MID_PCT,
  CALIBRATION_MID,
  DISCONFIRMATION_MID,
  HYPOTHESES_MID,
  normalizeBaseRateError,
  normalizeCalibration,
  normalizeDisconfirmation,
  normalizeHypotheses,
  proxyNormalizeBaseRateError,
  proxyNormalizeCalibration,
  proxyNormalizeDisconfirmation,
  proxyNormalizeHypotheses,
  reasoningNormalizedScores,
  seedReasoningElo,
} from './seed';

describe('proxy axes are structural, derived from each task', () => {
  it('centres base-rate error on half the achievable-error axis', () => {
    expect(BASE_RATE_ERROR_MID_PCT).toBe(50);
    expect(proxyNormalizeBaseRateError(50)).toBeCloseTo(0, 10);
  });

  it('centres hypothesis fluency on half the per-prompt cap', () => {
    expect(proxyNormalizeHypotheses(HYPOTHESES_MID)).toBeCloseTo(0, 10);
  });

  it('centres disconfirmation on the midpoint of its [0,1] axis', () => {
    expect(proxyNormalizeDisconfirmation(DISCONFIRMATION_MID)).toBeCloseTo(0, 10);
  });

  it('centres calibration on the midpoint of the Brier axis', () => {
    expect(proxyNormalizeCalibration(CALIBRATION_MID)).toBeCloseTo(0, 10);
  });
});

describe('proxy direction and clamping', () => {
  it('scores LOWER base-rate error higher (the axis is inverted)', () => {
    expect(proxyNormalizeBaseRateError(5)).toBeGreaterThan(proxyNormalizeBaseRateError(40));
  });

  it('scores more unique hypotheses higher', () => {
    expect(proxyNormalizeHypotheses(6)).toBeGreaterThan(proxyNormalizeHypotheses(2));
  });

  it('scores a higher self-rated disconfirmation score higher', () => {
    expect(proxyNormalizeDisconfirmation(1)).toBeGreaterThan(proxyNormalizeDisconfirmation(0));
  });

  it('scores a LOWER Brier score higher (the axis is inverted)', () => {
    expect(proxyNormalizeCalibration(0.05)).toBeGreaterThan(proxyNormalizeCalibration(0.4));
  });

  it('clamps every proxy to +/-Z_CAP', () => {
    expect(proxyNormalizeBaseRateError(-1000)).toBe(Z_CAP);
    expect(proxyNormalizeBaseRateError(1000)).toBe(-Z_CAP);
    expect(proxyNormalizeHypotheses(1000)).toBe(Z_CAP);
    expect(proxyNormalizeHypotheses(-1000)).toBe(-Z_CAP);
    expect(proxyNormalizeDisconfirmation(1000)).toBe(Z_CAP);
    expect(proxyNormalizeCalibration(-1000)).toBe(Z_CAP);
    expect(proxyNormalizeCalibration(1000)).toBe(-Z_CAP);
  });
});

describe('proxy -> empirical switch at N_MIN', () => {
  const samples = (n: number, value: number) => Array.from({ length: n }, () => value);

  it('uses the proxy below N_MIN samples', () => {
    expect(normalizeHypotheses(3, samples(N_MIN - 1, 2))).toBeCloseTo(
      proxyNormalizeHypotheses(3),
      10,
    );
    expect(normalizeHypotheses(3, [])).toBeCloseTo(proxyNormalizeHypotheses(3), 10);
  });

  it('switches to empirical z at N_MIN samples', () => {
    const accumulated = [...samples(N_MIN / 2, 2), ...samples(N_MIN / 2, 4)];
    expect(normalizeHypotheses(4, accumulated)).toBeCloseTo(1, 10);
    expect(normalizeDisconfirmation(4, accumulated)).toBeCloseTo(1, 10);
  });

  it('keeps the inverted-axis sign on the empirical branch for base-rate error', () => {
    const accumulated = [...samples(N_MIN / 2, 10), ...samples(N_MIN / 2, 30)];
    // 30pp error is the WORSE end, so its normalized score must be negative.
    expect(normalizeBaseRateError(30, accumulated)).toBeCloseTo(-1, 10);
    expect(normalizeBaseRateError(10, accumulated)).toBeCloseTo(1, 10);
  });

  it('keeps the inverted-axis sign on the empirical branch for calibration', () => {
    const accumulated = [...samples(N_MIN / 2, 0.1), ...samples(N_MIN / 2, 0.3)];
    expect(normalizeCalibration(0.3, accumulated)).toBeCloseTo(-1, 10);
    expect(normalizeCalibration(0.1, accumulated)).toBeCloseTo(1, 10);
  });
});

describe('reasoningNormalizedScores', () => {
  it('is empty when nothing has been completed', () => {
    expect(reasoningNormalizedScores({})).toEqual([]);
    expect(
      reasoningNormalizedScores({
        baseRateMeanErrorPct: null,
        hypothesesMeanUniquePerPrompt: null,
        disconfirmationMeanSelfScore: null,
        calibrationBrierScore: null,
      }),
    ).toEqual([]);
  });

  it('includes only the tasks with results', () => {
    expect(reasoningNormalizedScores({ baseRateMeanErrorPct: 10 })).toHaveLength(1);
    expect(
      reasoningNormalizedScores({ baseRateMeanErrorPct: 10, hypothesesMeanUniquePerPrompt: 3 }),
    ).toHaveLength(2);
    expect(
      reasoningNormalizedScores({
        baseRateMeanErrorPct: 10,
        hypothesesMeanUniquePerPrompt: 3,
        disconfirmationMeanSelfScore: 0.5,
        calibrationBrierScore: 0.2,
      }),
    ).toHaveLength(4);
  });
});

describe('seedReasoningElo', () => {
  it('is null until at least one task is done', () => {
    expect(seedReasoningElo({})).toBeNull();
  });

  it('lands at the Elo midpoint for a mid-axis run on every component', () => {
    const elo = seedReasoningElo({
      baseRateMeanErrorPct: BASE_RATE_ERROR_MID_PCT,
      hypothesesMeanUniquePerPrompt: HYPOTHESES_MID,
      disconfirmationMeanSelfScore: DISCONFIRMATION_MID,
      calibrationBrierScore: CALIBRATION_MID,
    });
    expect(elo).toBeCloseTo(ELO_MIDPOINT, 6);
  });

  it('rises with better performance on every component', () => {
    const weak = seedReasoningElo({
      baseRateMeanErrorPct: 45,
      hypothesesMeanUniquePerPrompt: 1,
      disconfirmationMeanSelfScore: 0,
      calibrationBrierScore: 0.45,
    })!;
    const strong = seedReasoningElo({
      baseRateMeanErrorPct: 3,
      hypothesesMeanUniquePerPrompt: 7,
      disconfirmationMeanSelfScore: 1,
      calibrationBrierScore: 0.02,
    })!;
    expect(strong).toBeGreaterThan(weak);
  });

  it('works from a single completed task', () => {
    expect(seedReasoningElo({ calibrationBrierScore: CALIBRATION_MID })).toBeCloseTo(
      ELO_MIDPOINT,
      6,
    );
  });

  it('stays inside the Elo bounds at the extremes', () => {
    const floor = seedReasoningElo({
      baseRateMeanErrorPct: 100,
      hypothesesMeanUniquePerPrompt: 0,
      disconfirmationMeanSelfScore: 0,
      calibrationBrierScore: 1,
    })!;
    const ceiling = seedReasoningElo({
      baseRateMeanErrorPct: 0,
      hypothesesMeanUniquePerPrompt: 100,
      disconfirmationMeanSelfScore: 1,
      calibrationBrierScore: 0,
    })!;
    expect(floor).toBeGreaterThanOrEqual(400);
    expect(ceiling).toBeLessThanOrEqual(2400);
    expect(ceiling).toBeGreaterThan(floor);
  });
});
