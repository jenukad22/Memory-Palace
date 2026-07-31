import { describe, expect, it } from 'vitest';
import { makeRng } from '../assessment/sequences';
import {
  FLICKER_CHANGE_KINDS,
  FLICKER_COLOR_COUNT,
  FLICKER_COLS,
  FLICKER_MIN_ELEMENTS,
  FLICKER_ROWS,
  FLICKER_SIZE_DELTA,
  FLICKER_SIZE_MAX,
  FLICKER_SHAPES,
  changedCellIndexes,
  detectionCycles,
  generateFlickerTrial,
  scoreFlicker,
  type FlickerTrialResult,
} from './flicker';
import { FLICKER_CYCLE_MS, FLICKER_TIMEOUT_MS } from './timing';

const trial = (seed: number, options = {}) => generateFlickerTrial(makeRng(seed), options);

describe('generateFlickerTrial', () => {
  it('fills the whole grid, row-major', () => {
    const t = trial(1);
    expect(t.base).toHaveLength(FLICKER_COLS * FLICKER_ROWS);
    t.base.forEach((cell, i) => {
      expect(cell.index).toBe(i);
      expect(cell.col).toBe(i % FLICKER_COLS);
      expect(cell.row).toBe(Math.floor(i / FLICKER_COLS));
    });
  });

  it('is deterministic for a seed and different across seeds', () => {
    expect(trial(5)).toEqual(trial(5));
    expect(trial(5)).not.toEqual(trial(6));
  });

  it('differs in exactly one cell', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const t = trial(seed);
      expect(changedCellIndexes(t.base, t.alternate)).toEqual([t.changedIndex]);
    }
  });

  it('changes an element that is actually there to begin with', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const t = trial(seed);
      expect(t.base[t.changedIndex]!.present).toBe(true);
    }
  });

  it('holds at least the element floor in every scene', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const t = trial(seed);
      expect(t.base.filter((c) => c.present).length).toBeGreaterThanOrEqual(FLICKER_MIN_ELEMENTS);
    }
  });

  it('leaves gaps rather than filling every cell', () => {
    const anySparse = Array.from({ length: 20 }, (_, s) => trial(s)).some(
      (t) => t.base.filter((c) => c.present).length < FLICKER_COLS * FLICKER_ROWS,
    );
    expect(anySparse).toBe(true);
  });

  it('emits only valid shapes, palette indexes and sizes', () => {
    for (const cell of trial(3).base) {
      expect(FLICKER_SHAPES as readonly string[]).toContain(cell.shape);
      expect(cell.colorIndex).toBeGreaterThanOrEqual(0);
      expect(cell.colorIndex).toBeLessThan(FLICKER_COLOR_COUNT);
      expect(cell.sizeScale).toBeGreaterThan(0);
      expect(cell.sizeScale).toBeLessThanOrEqual(1);
    }
  });

  it('keeps a grown element inside its cell', () => {
    expect(FLICKER_SIZE_MAX + FLICKER_SIZE_DELTA).toBeLessThanOrEqual(1);
  });

  it('produces each kind of change on request, and only that kind', () => {
    for (const change of FLICKER_CHANGE_KINDS) {
      const t = trial(11, { change });
      expect(t.change).toBe(change);
      const before = t.base[t.changedIndex]!;
      const after = t.alternate[t.changedIndex]!;
      expect(after.shape).toBe(before.shape);
      if (change === 'presence') {
        expect(before.present).toBe(true);
        expect(after.present).toBe(false);
        expect(after.colorIndex).toBe(before.colorIndex);
        expect(after.sizeScale).toBe(before.sizeScale);
      }
      if (change === 'color') {
        expect(after.colorIndex).not.toBe(before.colorIndex);
        expect(after.present).toBe(true);
        expect(after.sizeScale).toBe(before.sizeScale);
      }
      if (change === 'size') {
        expect(after.sizeScale).toBeCloseTo(before.sizeScale + FLICKER_SIZE_DELTA, 10);
        expect(after.sizeScale).toBeLessThanOrEqual(1);
        expect(after.colorIndex).toBe(before.colorIndex);
      }
    }
  });

  it('uses more than one kind of change across trials', () => {
    const kinds = new Set(Array.from({ length: 30 }, (_, s) => trial(s).change));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('does not alias the two scenes — editing one cannot edit the other', () => {
    const t = trial(2);
    t.alternate[0]!.colorIndex = 999;
    expect(t.base[0]!.colorIndex).not.toBe(999);
  });

  it('honours a custom grid size', () => {
    const t = trial(4, { cols: 3, rows: 3 });
    expect(t.base).toHaveLength(9);
    expect(changedCellIndexes(t.base, t.alternate)).toHaveLength(1);
  });
});

describe('detectionCycles', () => {
  it('counts whole alternations', () => {
    expect(detectionCycles(0)).toBe(0);
    expect(detectionCycles(FLICKER_CYCLE_MS * 3 + 10)).toBe(3);
  });
});

describe('scoreFlicker', () => {
  const found = (ms: number, falseTaps = 0): FlickerTrialResult => ({
    detected: true,
    detectionMs: ms,
    falseTaps,
  });
  const missed = (falseTaps = 0): FlickerTrialResult => ({
    detected: false,
    detectionMs: null,
    falseTaps,
  });

  it('returns nulls, not NaNs, for an empty run', () => {
    const m = scoreFlicker([]);
    expect(m.trials).toBe(0);
    expect(m.detectionRate).toBeNull();
    expect(m.medianDetectionMs).toBeNull();
    expect(m.scoreDetectionMs).toBeNull();
  });

  it('summarizes detections', () => {
    const m = scoreFlicker([found(4000), found(8000), found(12000)]);
    expect(m.detected).toBe(3);
    expect(m.detectionRate).toBe(1);
    expect(m.medianDetectionMs).toBe(8000);
    expect(m.meanDetectionMs).toBe(8000);
    expect(m.medianCycles).toBe(Math.floor(8000 / FLICKER_CYCLE_MS));
  });

  it('imputes a miss at the timeout instead of ignoring it', () => {
    const m = scoreFlicker([found(5000), missed()]);
    expect(m.detectionRate).toBe(0.5);
    expect(m.meanDetectionMs).toBe(5000); // detected-only mean
    expect(m.scoreDetectionMs).toBe((5000 + FLICKER_TIMEOUT_MS) / 2);
  });

  it('ranks finding all four slowly above finding one quickly and giving up', () => {
    const thorough = scoreFlicker([found(20000), found(20000), found(20000), found(20000)]);
    const gaveUp = scoreFlicker([found(5000), missed(), missed(), missed()]);
    expect(thorough.scoreDetectionMs!).toBeLessThan(gaveUp.scoreDetectionMs!);
    expect(thorough.meanDetectionMs!).toBeGreaterThan(gaveUp.meanDetectionMs!);
  });

  it('totals false taps across trials', () => {
    expect(scoreFlicker([found(3000, 2), missed(1), found(9000, 0)]).falseTaps).toBe(3);
  });

  it('leaves detection stats null when nothing was found', () => {
    const m = scoreFlicker([missed(), missed()]);
    expect(m.detected).toBe(0);
    expect(m.detectionRate).toBe(0);
    expect(m.medianDetectionMs).toBeNull();
    expect(m.medianCycles).toBeNull();
    expect(m.scoreDetectionMs).toBe(FLICKER_TIMEOUT_MS);
  });
});
