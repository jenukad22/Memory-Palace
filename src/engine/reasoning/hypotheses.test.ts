import { describe, expect, it } from 'vitest';
import { scoreHypothesesEntry, scoreHypothesesRun } from './hypotheses';

describe('scoreHypothesesEntry', () => {
  it('counts non-empty entries', () => {
    const s = scoreHypothesesEntry(['low signups from a broken form', 'a competitor launched']);
    expect(s.entries).toBe(2);
    expect(s.uniqueCount).toBe(2);
    expect(s.duplicateCount).toBe(0);
  });

  it('drops empty and whitespace-only entries without counting them', () => {
    const s = scoreHypothesesEntry(['a real idea', '', '   ', '\n']);
    expect(s.entries).toBe(1);
    expect(s.uniqueCount).toBe(1);
  });

  it('deduplicates exact text after trim and case-fold', () => {
    const s = scoreHypothesesEntry(['Broken checkout', '  broken checkout  ', 'BROKEN CHECKOUT']);
    expect(s.entries).toBe(3);
    expect(s.uniqueCount).toBe(1);
    expect(s.duplicateCount).toBe(2);
  });

  it('counts different phrasings of the same idea separately (documented limitation)', () => {
    const s = scoreHypothesesEntry(['the checkout is broken', 'checkout has a bug']);
    expect(s.uniqueCount).toBe(2); // exact-text only, not semantic
  });

  it('returns zeros for no entries', () => {
    const s = scoreHypothesesEntry([]);
    expect(s).toEqual({ entries: 0, uniqueCount: 0, duplicateCount: 0 });
  });
});

describe('scoreHypothesesRun', () => {
  it('returns null mean, not NaN, for zero prompts', () => {
    const m = scoreHypothesesRun([]);
    expect(m.trials).toBe(0);
    expect(m.meanUniquePerPrompt).toBeNull();
    expect(m.totalUnique).toBe(0);
  });

  it('averages unique entries across prompts', () => {
    const m = scoreHypothesesRun([
      ['a', 'b', 'c'], // 3 unique
      ['x'], // 1 unique
    ]);
    expect(m.trials).toBe(2);
    expect(m.totalUnique).toBe(4);
    expect(m.meanUniquePerPrompt).toBe(2);
  });

  it('handles a prompt with zero entries as zero, not as excluded', () => {
    const m = scoreHypothesesRun([['a', 'b'], []]);
    expect(m.trials).toBe(2);
    expect(m.meanUniquePerPrompt).toBe(1);
  });

  it('totals duplicates across prompts', () => {
    const m = scoreHypothesesRun([
      ['a', 'a', 'b'],
      ['c', 'c', 'c'],
    ]);
    expect(m.totalDuplicates).toBe(3); // one dup in prompt 1, two in prompt 2
    expect(m.totalUnique).toBe(3); // a, b, c
  });
});
