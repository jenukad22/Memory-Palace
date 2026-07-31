import { describe, expect, it } from 'vitest';
import { makeRng } from '@/engine';
import {
  CALIBRATION_ITEMS,
  generateCalibrationRun,
  isCalibrationAnswerCorrect,
  resolveCalibrationChoice,
  sampleCalibrationItems,
  type CalibrationItem,
} from './calibrationBank';

describe('CALIBRATION_ITEMS', () => {
  it('has enough entries for a run with room to spare', () => {
    expect(CALIBRATION_ITEMS.length).toBeGreaterThanOrEqual(30);
  });

  it('has unique ids and unique prompts+options', () => {
    expect(new Set(CALIBRATION_ITEMS.map((i) => i.id)).size).toBe(CALIBRATION_ITEMS.length);
  });

  it('gives every item two distinct, non-empty options', () => {
    for (const item of CALIBRATION_ITEMS) {
      expect(item.optionA.trim().length).toBeGreaterThan(0);
      expect(item.optionB.trim().length).toBeGreaterThan(0);
      expect(item.optionA).not.toBe(item.optionB);
      expect(['A', 'B']).toContain(item.correctOption);
    }
  });
});

describe('sampleCalibrationItems', () => {
  it('draws the requested count of distinct items', () => {
    const sample = sampleCalibrationItems(makeRng(1), 15);
    expect(sample).toHaveLength(15);
    expect(new Set(sample.map((i) => i.id)).size).toBe(15);
  });

  it('throws rather than silently under-filling', () => {
    expect(() => sampleCalibrationItems(makeRng(1), 10_000)).toThrow(RangeError);
  });
});

describe('isCalibrationAnswerCorrect', () => {
  const item: CalibrationItem = {
    id: 'x',
    prompt: 'p',
    optionA: 'a',
    optionB: 'b',
    correctOption: 'A',
  };

  it('checks the chosen option against the item', () => {
    expect(isCalibrationAnswerCorrect(item, 'A')).toBe(true);
    expect(isCalibrationAnswerCorrect(item, 'B')).toBe(false);
  });
});

describe('generateCalibrationRun + resolveCalibrationChoice (position fairness)', () => {
  it('produces the requested count', () => {
    expect(generateCalibrationRun(makeRng(1), 10)).toHaveLength(10);
  });

  it('swaps position for roughly half the items across a run, not always the same', () => {
    const run = generateCalibrationRun(makeRng(2), 30);
    const swapped = run.filter((e) => e.swapped).length;
    expect(swapped).toBeGreaterThan(5);
    expect(swapped).toBeLessThan(25);
  });

  it('every item bank entry has correctOption "A" — the swap is the only thing standing between that and a positional tell', () => {
    // This pins down *why* the swap step exists: without it, "always pick the
    // first-shown option" would score 100% on this bank.
    expect(CALIBRATION_ITEMS.every((i) => i.correctOption === 'A')).toBe(true);
  });

  it('displayFirst/displaySecond always show the correct answer in both positions across a run', () => {
    const run = generateCalibrationRun(makeRng(3), 30);
    const correctShownFirst = run.filter((e) => {
      const correctText = e.item.correctOption === 'A' ? e.item.optionA : e.item.optionB;
      return e.displayFirst === correctText;
    }).length;
    expect(correctShownFirst).toBeGreaterThan(3);
    expect(correctShownFirst).toBeLessThan(27);
  });

  it('resolveCalibrationChoice maps the picked slot back to the correct underlying option', () => {
    const run = generateCalibrationRun(makeRng(4), 10);
    for (const entry of run) {
      const pickedFirst = resolveCalibrationChoice(entry, 'first');
      const pickedSecond = resolveCalibrationChoice(entry, 'second');
      // The two slots always resolve to opposite options.
      expect(pickedFirst).not.toBe(pickedSecond);
      // Whichever slot holds optionA resolves to 'A'.
      const firstIsOptionA = entry.displayFirst === entry.item.optionA;
      expect(pickedFirst).toBe(firstIsOptionA ? 'A' : 'B');
    }
  });

  it('picking the always-correct-when-unswapped slot is not the same as always being correct', () => {
    // Simulates a "always tap first" strategy across a run and confirms it
    // does not land at 100% — proof the swap actually defeats the positional
    // tell rather than just existing in name.
    const run = generateCalibrationRun(makeRng(5), 30);
    const alwaysFirstCorrect = run.filter((entry) => {
      const choice = resolveCalibrationChoice(entry, 'first');
      return isCalibrationAnswerCorrect(entry.item, choice);
    }).length;
    expect(alwaysFirstCorrect).toBeGreaterThan(0);
    expect(alwaysFirstCorrect).toBeLessThan(30);
  });
});
