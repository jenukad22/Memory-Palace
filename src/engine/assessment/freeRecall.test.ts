import { describe, expect, it } from 'vitest';
import { makeRng } from './sequences';
import { WORD_BANK } from './wordBank';
import { FREE_RECALL_LIST_LENGTH, sampleWordList, scoreFreeRecall } from './freeRecall';

describe('sampleWordList', () => {
  it('draws the requested number of unique words from the pool', () => {
    const list = sampleWordList(WORD_BANK, FREE_RECALL_LIST_LENGTH, makeRng(1));
    expect(list).toHaveLength(FREE_RECALL_LIST_LENGTH);
    expect(new Set(list).size).toBe(FREE_RECALL_LIST_LENGTH);
    for (const w of list) expect(WORD_BANK).toContain(w);
  });

  it('is deterministic for a given seed and does not mutate the pool', () => {
    const snapshot = [...WORD_BANK];
    const a = sampleWordList(WORD_BANK, 10, makeRng(42));
    const b = sampleWordList(WORD_BANK, 10, makeRng(42));
    expect(a).toEqual(b);
    expect(WORD_BANK).toEqual(snapshot);
  });

  it('excludes a given set, producing a disjoint list', () => {
    const pretest = sampleWordList(WORD_BANK, FREE_RECALL_LIST_LENGTH, makeRng(1));
    const posttest = sampleWordList(
      WORD_BANK,
      FREE_RECALL_LIST_LENGTH,
      makeRng(2),
      new Set(pretest),
    );
    expect(posttest).toHaveLength(FREE_RECALL_LIST_LENGTH);
    for (const w of posttest) expect(pretest).not.toContain(w);
  });

  it('throws when the eligible pool is smaller than the requested length', () => {
    expect(() => sampleWordList(['a', 'b', 'c'], 5, makeRng(1))).toThrow(RangeError);
  });
});

describe('scoreFreeRecall', () => {
  const list = ['Apple', 'Bell', 'Carrot', 'Drum', 'Egg'];

  it('counts case- and whitespace-insensitive matches, order-independent', () => {
    const score = scoreFreeRecall(list, ['  egg ', 'BELL', 'apple']);
    expect(score.count).toBe(3);
    expect(new Set(score.correct)).toEqual(new Set(['Apple', 'Bell', 'Egg']));
    expect(score.missed).toEqual(['Carrot', 'Drum']);
    expect(score.intrusions).toEqual([]);
  });

  it('does not double-count a repeated recall entry', () => {
    const score = scoreFreeRecall(list, ['apple', 'apple', 'Apple']);
    expect(score.count).toBe(1);
  });

  it('reports words not on the list as intrusions, not correct', () => {
    const score = scoreFreeRecall(list, ['apple', 'dragon']);
    expect(score.count).toBe(1);
    expect(score.intrusions).toEqual(['dragon']);
  });

  it('ignores blank entries', () => {
    const score = scoreFreeRecall(list, ['apple', '   ', '']);
    expect(score.count).toBe(1);
    expect(score.intrusions).toEqual([]);
  });

  it('scores an empty attempt as zero recalled, everything missed', () => {
    const score = scoreFreeRecall(list, []);
    expect(score.count).toBe(0);
    expect(score.missed).toEqual(list);
  });
});
