import { describe, expect, it } from 'vitest';
import {
  CPT_HONESTY,
  DETECTION_EXPLANATION,
  DPRIME_EXPLANATION,
  DRIFT_EXPLANATION,
  FLICKER_HONESTY,
  LAPSE_EXPLANATION,
  NON_RESPONSE_EXPLANATION,
  PVT_HONESTY,
  TIMING_DISCLOSURE,
  formatCount,
  formatDPrime,
  formatMs,
  formatPercent,
  formatSeconds,
  formatSpeed,
  timingQualityCopy,
} from './copy';

const ALL_COPY = [
  TIMING_DISCLOSURE,
  PVT_HONESTY,
  CPT_HONESTY,
  FLICKER_HONESTY,
  LAPSE_EXPLANATION,
  DPRIME_EXPLANATION,
  DETECTION_EXPLANATION,
  NON_RESPONSE_EXPLANATION,
  DRIFT_EXPLANATION,
  ...(['good', 'fair', 'poor', 'unmeasured'] as const).map(timingQualityCopy),
];

describe('attention copy honesty', () => {
  it('is all non-empty', () => {
    for (const s of ALL_COPY) expect(s.trim().length).toBeGreaterThan(0);
  });

  it('never claims anything beyond the task just performed', () => {
    // Deliberately spelled out here (test files are exempt from the repo-wide
    // scanner) so this module's own strings are checked at their source.
    const banned = [
      /\biq\b/i,
      /intellig/i,
      /\b(?:brain|cognitive|memory|mental)[\s-]+age\b/i,
      /diagnos/i,
      /\bclinical/i,
      /general[\s-]+abilit/i,
      /\bsmarter\b/i,
      /\bfocus\s+score\b/i,
      /\battention\s+span\b/i,
      /\bimpulsiv/i,
      /\bADHD\b/i,
      /\bdisorder\b/i,
      /\bsleep[\s-]deprived\b/i,
      /\bbrain\s+train/i,
    ];
    for (const s of ALL_COPY) {
      for (const re of banned) expect(s).not.toMatch(re);
    }
  });

  it('states that reaction times include an unmeasurable device delay', () => {
    expect(TIMING_DISCLOSURE).toMatch(/input delay/i);
    expect(TIMING_DISCLOSURE).toMatch(/cannot be\s+measured/i);
  });

  it('scopes the comparison the numbers support to the same device', () => {
    expect(TIMING_DISCLOSURE).toMatch(/this device/i);
  });

  it('explains that a late stimulus is not added to the reaction time', () => {
    expect(DRIFT_EXPLANATION).toMatch(/painted/i);
    expect(DRIFT_EXPLANATION).toMatch(/not added|not be added/i);
  });

  it('discloses both score imputations rather than hiding them', () => {
    expect(NON_RESPONSE_EXPLANATION).toMatch(/timeout|3-second/i);
    expect(DETECTION_EXPLANATION).toMatch(/60-second|limit/i);
  });

  it('ties the lapse threshold to the task, not to a kind of person', () => {
    expect(LAPSE_EXPLANATION).toContain('355');
    expect(LAPSE_EXPLANATION).toMatch(/this task/i);
  });

  it('warns that a rough run is rough', () => {
    expect(timingQualityCopy('poor')).toMatch(/rough|wide/i);
    expect(timingQualityCopy('unmeasured')).toMatch(/no presentation timing/i);
    expect(timingQualityCopy('good')).not.toMatch(/rough/i);
  });

  it('gives a distinct line per timing grade', () => {
    const lines = (['good', 'fair', 'poor', 'unmeasured'] as const).map(timingQualityCopy);
    expect(new Set(lines).size).toBe(4);
  });
});

describe('formatters', () => {
  it('renders an em dash rather than "null" or "NaN" when there is no number', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatSeconds(null)).toBe('—');
    expect(formatSpeed(null)).toBe('—');
    expect(formatPercent(null)).toBe('—');
  });

  it('rounds milliseconds to whole units', () => {
    expect(formatMs(283.6)).toBe('284 ms');
    expect(formatMs(0)).toBe('0 ms');
  });

  it('renders seconds to one decimal', () => {
    expect(formatSeconds(12340)).toBe('12.3 s');
  });

  it('renders response speed per second', () => {
    expect(formatSpeed(3.456)).toBe('3.46/s');
  });

  it('renders rates as whole percentages', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.256)).toBe('26%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('shows d-prime against its ceiling, never bare', () => {
    expect(formatDPrime(3.1234, 4.6842)).toBe('3.12 of 4.68');
  });

  it('shows counts with their denominator', () => {
    expect(formatCount(4, 96)).toBe('4 of 96');
  });
});
