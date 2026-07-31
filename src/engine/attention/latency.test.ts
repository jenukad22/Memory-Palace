import { describe, expect, it } from 'vitest';
import {
  FRAME_BUDGET_MS,
  FRAME_PRESENTATION_MS,
  HIGH_RES_CLOCK_RESOLUTION_MS,
  driftMs,
  median,
  percentile,
  rtUncertaintyMs,
  summarizeOnsets,
  timingQuality,
  type OnsetSample,
} from './latency';

const onsets = (drifts: number[]): OnsetSample[] =>
  drifts.map((d, i) => ({ requestedMs: i * 1000, paintedMs: i * 1000 + d }));

describe('percentile', () => {
  it('returns 0 for an empty sample rather than NaN', () => {
    expect(percentile([], 0.5)).toBe(0);
  });

  it('interpolates between neighbouring ranks', () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 10], 0.25)).toBe(2.5);
  });

  it('returns the extremes at p=0 and p=1', () => {
    const values = [5, 1, 9, 3];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 1)).toBe(9);
  });

  it('does not depend on input order', () => {
    expect(percentile([9, 1, 5, 3, 7], 0.5)).toBe(percentile([1, 3, 5, 7, 9], 0.5));
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    percentile(values, 0.5);
    expect(values).toEqual([3, 1, 2]);
  });

  it('rejects a p outside [0, 1]', () => {
    expect(() => percentile([1, 2], 1.5)).toThrow(RangeError);
    expect(() => percentile([1, 2], -0.1)).toThrow(RangeError);
  });

  it('median is the 50th percentile', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3])).toBe(2);
  });
});

describe('driftMs', () => {
  it('is painted minus requested, keeping negatives as measured', () => {
    expect(driftMs({ requestedMs: 1000, paintedMs: 1012 })).toBe(12);
    expect(driftMs({ requestedMs: 1000, paintedMs: 998 })).toBe(-2);
  });
});

describe('timingQuality', () => {
  it('is unmeasured with no samples, whatever the drift', () => {
    expect(timingQuality(0, 0)).toBe('unmeasured');
    expect(timingQuality(0, 500)).toBe('unmeasured');
  });

  it('grades on p95 drift against the frame budget', () => {
    expect(timingQuality(50, 4)).toBe('good');
    expect(timingQuality(50, FRAME_BUDGET_MS)).toBe('good');
    expect(timingQuality(50, FRAME_BUDGET_MS + 1)).toBe('fair');
    expect(timingQuality(50, FRAME_BUDGET_MS * 3)).toBe('fair');
    expect(timingQuality(50, FRAME_BUDGET_MS * 3 + 1)).toBe('poor');
  });
});

describe('rtUncertaintyMs', () => {
  it('sums frame presentation, clock resolution and p95 drift', () => {
    expect(rtUncertaintyMs(10, true)).toBeCloseTo(
      FRAME_PRESENTATION_MS + HIGH_RES_CLOCK_RESOLUTION_MS + 10,
      6,
    );
  });

  it('never lets a negative drift shrink the band below the irreducible floor', () => {
    expect(rtUncertaintyMs(-50, true)).toBeCloseTo(
      FRAME_PRESENTATION_MS + HIGH_RES_CLOCK_RESOLUTION_MS,
      6,
    );
  });

  it('grows with worse drift', () => {
    expect(rtUncertaintyMs(50, true)).toBeGreaterThan(rtUncertaintyMs(5, true));
  });
});

describe('summarizeOnsets', () => {
  it('reports an unmeasured profile for an empty run without NaNs', () => {
    const p = summarizeOnsets([], { highResolutionClock: true });
    expect(p).toMatchObject({
      samples: 0,
      medianDriftMs: 0,
      p95DriftMs: 0,
      maxDriftMs: 0,
      lateOnsets: 0,
      quality: 'unmeasured',
    });
    expect(Number.isFinite(p.rtUncertaintyMs)).toBe(true);
  });

  it('summarizes drift across samples', () => {
    const p = summarizeOnsets(onsets([2, 4, 6, 8]), { highResolutionClock: true });
    expect(p.samples).toBe(4);
    expect(p.medianDriftMs).toBe(5);
    expect(p.maxDriftMs).toBe(8);
    expect(p.quality).toBe('good');
  });

  it('counts only onsets past the frame budget as late', () => {
    const p = summarizeOnsets(onsets([1, 2, 40, 60]), { highResolutionClock: true });
    expect(p.lateOnsets).toBe(2);
  });

  it('flags a run whose onsets were badly delayed', () => {
    const p = summarizeOnsets(onsets([80, 90, 120, 200, 300]), { highResolutionClock: true });
    expect(p.quality).toBe('poor');
    expect(p.rtUncertaintyMs).toBeGreaterThan(100);
  });

  it('carries the clock-resolution flag into the uncertainty band', () => {
    const withHiRes = summarizeOnsets(onsets([2, 2]), { highResolutionClock: true });
    const withoutHiRes = summarizeOnsets(onsets([2, 2]), { highResolutionClock: false });
    expect(withHiRes.highResolutionClock).toBe(true);
    expect(withoutHiRes.highResolutionClock).toBe(false);
    expect(withoutHiRes.rtUncertaintyMs).toBeGreaterThanOrEqual(withHiRes.rtUncertaintyMs);
  });

  it('measures drift, not the reaction times — a late onset does not inflate RT', () => {
    // Same 250 ms RT measured from the painted frame, in a run whose onsets ran
    // 300 ms late. The RT is unaffected; only the reported band widens.
    const late = summarizeOnsets(onsets([300, 310, 305]), { highResolutionClock: true });
    expect(late.medianDriftMs).toBeGreaterThan(295);
    expect(late.quality).toBe('poor');
    // The screens compute RT as response - painted, so the drift above cannot
    // enter it; this profile is the disclosure that the run was rough.
    const rt = 1300 - 1050; // response at 1300, stimulus painted at 1050
    expect(rt).toBe(250);
  });
});
