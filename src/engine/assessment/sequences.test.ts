import { describe, expect, it } from 'vitest';
import { generateCorsiSequence, generateDigitSequence, makeRng } from './sequences';

describe('makeRng', () => {
  it('is deterministic: same seed yields the same value stream', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const streamA = [a(), a(), a(), a()];
    const streamB = [b(), b(), b(), b()];
    expect(streamA).toEqual(streamB);
  });

  it('produces values in [0, 1)', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 100; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe('generateDigitSequence', () => {
  it('returns the requested length with digits 0-9', () => {
    const seq = generateDigitSequence(5, makeRng(1));
    expect(seq).toHaveLength(5);
    for (const d of seq) {
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(9);
    }
  });

  it('is deterministic under a seed', () => {
    expect(generateDigitSequence(6, makeRng(123))).toEqual(generateDigitSequence(6, makeRng(123)));
  });

  it('never repeats a digit immediately, and is never a strict monotonic run (length >= 3)', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const seq = generateDigitSequence(5, makeRng(seed));
      for (let i = 1; i < seq.length; i += 1) {
        expect(seq[i]).not.toBe(seq[i - 1]);
      }
      const allUp = seq.every((d, i) => i === 0 || d > seq[i - 1]!);
      const allDown = seq.every((d, i) => i === 0 || d < seq[i - 1]!);
      expect(allUp).toBe(false);
      expect(allDown).toBe(false);
    }
  });

  it('allows a 2-length sequence even if consecutive (run rule only applies at length >= 3)', () => {
    // Just assert it produces valid 2-length sequences without throwing.
    const seq = generateDigitSequence(2, makeRng(5));
    expect(seq).toHaveLength(2);
    expect(seq[0]).not.toBe(seq[1]);
  });
});

describe('generateCorsiSequence', () => {
  it('returns the requested length with block positions 0-8', () => {
    const seq = generateCorsiSequence(5, makeRng(1));
    expect(seq).toHaveLength(5);
    for (const p of seq) {
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(8);
    }
  });

  it('is deterministic under a seed', () => {
    expect(generateCorsiSequence(6, makeRng(99))).toEqual(generateCorsiSequence(6, makeRng(99)));
  });

  it('never repeats a block immediately (arbitrary jumps otherwise allowed)', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const seq = generateCorsiSequence(6, makeRng(seed));
      for (let i = 1; i < seq.length; i += 1) {
        expect(seq[i]).not.toBe(seq[i - 1]);
      }
    }
  });
});
