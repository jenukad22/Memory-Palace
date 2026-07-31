import { describe, expect, it } from 'vitest';
import {
  BASE_RATE_FORMAT_EXPLANATION,
  BASE_RATE_HONESTY,
  BRIER_EXPLANATION,
  CALIBRATION_CURVE_EXPLANATION,
  CALIBRATION_CURVE_OMISSION_EXPLANATION,
  CALIBRATION_HONESTY,
  DISCONFIRMATION_HONESTY,
  DISCONFIRMATION_SELF_RATE_EXPLANATION,
  HYPOTHESES_DEDUPE_EXPLANATION,
  HYPOTHESES_HONESTY,
  formatBrier,
  formatCount,
  formatErrorPct,
  formatFraction,
  formatPct,
} from './copy';

const ALL_COPY = [
  BASE_RATE_HONESTY,
  HYPOTHESES_HONESTY,
  DISCONFIRMATION_HONESTY,
  CALIBRATION_HONESTY,
  BASE_RATE_FORMAT_EXPLANATION,
  HYPOTHESES_DEDUPE_EXPLANATION,
  DISCONFIRMATION_SELF_RATE_EXPLANATION,
  BRIER_EXPLANATION,
  CALIBRATION_CURVE_EXPLANATION,
  CALIBRATION_CURVE_OMISSION_EXPLANATION,
];

describe('reasoning copy honesty', () => {
  it('is all non-empty', () => {
    for (const s of ALL_COPY) expect(s.trim().length).toBeGreaterThan(0);
  });

  it('never claims a general reasoning, rationality, or intelligence capacity', () => {
    const banned = [
      /\biq\b/i,
      /intellig/i,
      /\b(?:brain|cognitive|memory|mental)[\s-]+age\b/i,
      /diagnos/i,
      /\bclinical/i,
      /general[\s-]+abilit/i,
      /\bsmarter\b/i,
      /\bcritical[\s-]thinking\s+skill\b/i,
      /\brationality\s+score\b/i,
      /\breasoning\s+ability\b/i,
    ];
    for (const s of ALL_COPY) {
      for (const re of banned) expect(s).not.toMatch(re);
    }
  });

  it('states the hypotheses count is fluency, not a correctness judgment', () => {
    expect(HYPOTHESES_HONESTY).toMatch(/does not judge/i);
  });

  it('states disconfirmation ratings are self-assessed, not graded by the app', () => {
    expect(DISCONFIRMATION_HONESTY).toMatch(/self/i);
    expect(DISCONFIRMATION_HONESTY).toMatch(/does not verify|not grade/i);
  });

  it('frames calibration as a narrow statistic, not a general judgment reading', () => {
    expect(CALIBRATION_HONESTY).toMatch(/narrow/i);
  });

  it('discloses the exact-text dedupe limitation', () => {
    expect(HYPOTHESES_DEDUPE_EXPLANATION).toMatch(/same text/i);
  });

  it('explains the Brier score floor and bounds', () => {
    expect(BRIER_EXPLANATION).toContain('0.25');
    expect(BRIER_EXPLANATION).toMatch(/perfect/i);
  });

  it('explains omitted calibration buckets are not the same as a 0% bucket', () => {
    expect(CALIBRATION_CURVE_OMISSION_EXPLANATION).toMatch(/0%/i);
  });
});

describe('formatters', () => {
  it('render an em dash for null rather than "null" or "NaN"', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatErrorPct(null)).toBe('—');
    expect(formatCount(null)).toBe('—');
    expect(formatBrier(null)).toBe('—');
  });

  it('formats a percentage to the requested precision', () => {
    expect(formatPct(42)).toBe('42%');
    expect(formatPct(42.456, 1)).toBe('42.5%');
  });

  it('formats an error in percentage points', () => {
    expect(formatErrorPct(8.36)).toBe('8.4 pp');
  });

  it('formats a count to one decimal by default', () => {
    expect(formatCount(2.666)).toBe('2.7');
    expect(formatCount(3)).toBe('3.0');
  });

  it('formats a brier score to three decimals', () => {
    expect(formatBrier(0.25)).toBe('0.250');
    expect(formatBrier(0)).toBe('0.000');
  });

  it('formats a fraction plainly, never as a bare ratio that could be misread as a percent', () => {
    expect(formatFraction(3, 5)).toBe('3 of 5');
  });
});
