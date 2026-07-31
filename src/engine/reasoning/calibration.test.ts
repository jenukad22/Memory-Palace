import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_LEVELS,
  brierScore,
  calibrationCurve,
  scoreCalibrationRun,
  type CalibrationTrial,
} from './calibration';

const trial = (confidencePct: number, correct: boolean): CalibrationTrial => ({
  confidencePct,
  correct,
});

describe('brierScore', () => {
  it('is null for no trials', () => {
    expect(brierScore([])).toBeNull();
  });

  it('is 0 for perfect, fully-confident forecasting', () => {
    expect(brierScore([trial(100, true), trial(100, true)])).toBeCloseTo(0, 10);
  });

  it('is 1 for maximally confident and always wrong', () => {
    expect(brierScore([trial(100, false), trial(100, false)])).toBeCloseTo(1, 10);
  });

  it('is 0.25 at the uninformative 50% floor regardless of outcome', () => {
    expect(brierScore([trial(50, true)])).toBeCloseTo(0.25, 10);
    expect(brierScore([trial(50, false)])).toBeCloseTo(0.25, 10);
    expect(brierScore([trial(50, true), trial(50, false)])).toBeCloseTo(0.25, 10);
  });

  it('rewards higher confidence when correct and punishes it when wrong', () => {
    expect(brierScore([trial(90, true)])!).toBeLessThan(brierScore([trial(60, true)])!);
    expect(brierScore([trial(90, false)])!).toBeGreaterThan(brierScore([trial(60, false)])!);
  });

  it('computes the exact formula for a known case', () => {
    // (0.7 - 1)^2 = 0.09, (0.8 - 0)^2 = 0.64 -> mean 0.365
    expect(brierScore([trial(70, true), trial(80, false)])).toBeCloseTo(0.365, 10);
  });
});

describe('calibrationCurve', () => {
  it('is empty for no trials', () => {
    expect(calibrationCurve([])).toEqual([]);
  });

  it('omits a confidence level with zero trials rather than showing 0%', () => {
    const curve = calibrationCurve([trial(90, true)]);
    expect(curve).toHaveLength(1);
    expect(curve.map((b) => b.confidencePct)).toEqual([90]);
    // Every other level (50,60,70,80,100) never appears — not as 0% observed.
    for (const level of CONFIDENCE_LEVELS) {
      if (level === 90) continue;
      expect(curve.find((b) => b.confidencePct === level)).toBeUndefined();
    }
  });

  it('buckets by exact confidence level and computes observed accuracy', () => {
    const curve = calibrationCurve([
      trial(70, true),
      trial(70, true),
      trial(70, false),
      trial(70, false),
      trial(90, true),
    ]);
    const seventy = curve.find((b) => b.confidencePct === 70)!;
    expect(seventy.trials).toBe(4);
    expect(seventy.correct).toBe(2);
    expect(seventy.observedAccuracyPct).toBe(50);
    const ninety = curve.find((b) => b.confidencePct === 90)!;
    expect(ninety.observedAccuracyPct).toBe(100);
  });

  it('returns buckets in ascending confidence order', () => {
    const curve = calibrationCurve([trial(100, true), trial(50, false), trial(70, true)]);
    expect(curve.map((b) => b.confidencePct)).toEqual([50, 70, 100]);
  });

  it('is the same pure function whether fed one session or many concatenated — "running" is not a separate code path', () => {
    const sessionOne = [trial(80, true), trial(80, false)];
    const sessionTwo = [trial(80, true), trial(90, true)];
    const running = calibrationCurve([...sessionOne, ...sessionTwo]);
    const eighty = running.find((b) => b.confidencePct === 80)!;
    expect(eighty.trials).toBe(3); // 2 from session one, 1 from session two
    expect(eighty.correct).toBe(2);
  });
});

describe('scoreCalibrationRun', () => {
  it('returns nulls, not NaN, for an empty run', () => {
    const m = scoreCalibrationRun([]);
    expect(m.trials).toBe(0);
    expect(m.accuracyPct).toBeNull();
    expect(m.meanConfidencePct).toBeNull();
    expect(m.brierScore).toBeNull();
    expect(m.curve).toEqual([]);
  });

  it('aggregates accuracy, mean confidence, brier score and the curve together', () => {
    const trials = [trial(90, true), trial(60, false), trial(100, true)];
    const m = scoreCalibrationRun(trials);
    expect(m.trials).toBe(3);
    expect(m.correctCount).toBe(2);
    expect(m.accuracyPct).toBeCloseTo((2 / 3) * 100, 6);
    expect(m.meanConfidencePct).toBeCloseTo((90 + 60 + 100) / 3, 6);
    expect(m.brierScore).toBeCloseTo(brierScore(trials)!, 10);
    expect(m.curve).toEqual(calibrationCurve(trials));
  });

  it('a well-calibrated run gets a low brier score without being perfectly accurate', () => {
    // Genuinely calibrated: 50% confidence trials split roughly 50/50 correct.
    const wellCalibrated = scoreCalibrationRun([
      trial(50, true),
      trial(50, false),
      trial(50, true),
      trial(50, false),
    ]);
    // Overconfident: 100% confidence but only half correct.
    const overconfident = scoreCalibrationRun([
      trial(100, true),
      trial(100, false),
      trial(100, true),
      trial(100, false),
    ]);
    expect(wellCalibrated.accuracyPct).toBe(overconfident.accuracyPct); // same accuracy
    expect(wellCalibrated.brierScore!).toBeLessThan(overconfident.brierScore!); // very different Brier
  });
});
