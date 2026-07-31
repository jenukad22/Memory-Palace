import { describe, expect, it } from 'vitest';
import { makeRng } from '@/engine';
import { HYPOTHESIS_PROMPTS, sampleHypothesisPrompts } from './hypothesesBank';

describe('HYPOTHESIS_PROMPTS', () => {
  it('has enough entries for a run with room to spare', () => {
    expect(HYPOTHESIS_PROMPTS.length).toBeGreaterThanOrEqual(20);
  });

  it('has no duplicate or empty prompts', () => {
    expect(new Set(HYPOTHESIS_PROMPTS).size).toBe(HYPOTHESIS_PROMPTS.length);
    for (const p of HYPOTHESIS_PROMPTS) expect(p.trim().length).toBeGreaterThan(0);
  });
});

describe('sampleHypothesisPrompts', () => {
  it('draws the requested count of distinct prompts', () => {
    const sample = sampleHypothesisPrompts(makeRng(1), 5);
    expect(sample).toHaveLength(5);
    expect(new Set(sample).size).toBe(5);
    for (const p of sample) expect(HYPOTHESIS_PROMPTS).toContain(p);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(sampleHypothesisPrompts(makeRng(9), 5)).toEqual(sampleHypothesisPrompts(makeRng(9), 5));
    expect(sampleHypothesisPrompts(makeRng(9), 5)).not.toEqual(
      sampleHypothesisPrompts(makeRng(10), 5),
    );
  });

  it('throws rather than silently under-filling when asked for more than the bank has', () => {
    expect(() => sampleHypothesisPrompts(makeRng(1), 10_000)).toThrow(RangeError);
  });
});
