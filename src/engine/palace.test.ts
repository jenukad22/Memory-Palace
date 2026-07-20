import { describe, expect, it } from 'vitest';
import { makeRng } from './assessment';
import {
  buildRouteDrill,
  compactPositions,
  nextPosition,
  normalizeAnswer,
  orderLoci,
  recallOrder,
  reorderPositions,
  scoreRecall,
  type LocusLike,
} from './palace';

const locus = (id: string, position: number): LocusLike => ({ id, position, label: id });

describe('orderLoci / nextPosition', () => {
  it('orders by position without mutating the input', () => {
    const input = [locus('c', 2), locus('a', 0), locus('b', 1)];
    expect(orderLoci(input).map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(input[0]!.id).toBe('c'); // untouched
  });

  it('nextPosition is one past the max, and 0 when empty', () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([locus('a', 0), locus('b', 3)])).toBe(4);
  });
});

describe('compactPositions', () => {
  it('reindexes to contiguous 0..n-1 in order, closing gaps', () => {
    const plan = compactPositions([locus('a', 0), locus('b', 5), locus('c', 9)]);
    expect(plan).toEqual([
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
      { id: 'c', position: 2 },
    ]);
  });
});

describe('reorderPositions', () => {
  const loci = [locus('a', 0), locus('b', 1), locus('c', 2)];

  it('assigns positions from an explicit id order', () => {
    expect(reorderPositions(loci, ['c', 'a', 'b'])).toEqual([
      { id: 'c', position: 0 },
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]);
  });

  it('rejects a partial, padded, or unknown-id order', () => {
    expect(() => reorderPositions(loci, ['a', 'b'])).toThrow(RangeError);
    expect(() => reorderPositions(loci, ['a', 'b', 'b'])).toThrow(RangeError);
    expect(() => reorderPositions(loci, ['a', 'b', 'z'])).toThrow(RangeError);
  });
});

describe('buildRouteDrill', () => {
  const loci = [locus('a', 0), locus('b', 1), locus('c', 2)];

  it('zips items onto stops in position order', () => {
    const placements = buildRouteDrill(loci, ['apple', 'bread', 'candle']);
    expect(placements).toEqual([
      { locusId: 'a', position: 0, item: 'apple' },
      { locusId: 'b', position: 1, item: 'bread' },
      { locusId: 'c', position: 2, item: 'candle' },
    ]);
  });

  it('drops extra items and leaves extra stops empty', () => {
    expect(buildRouteDrill(loci, ['x', 'y', 'z', 'w'])).toHaveLength(3);
    expect(buildRouteDrill(loci, ['x'])).toHaveLength(1);
  });
});

describe('recallOrder', () => {
  it('is a deterministic permutation for a given seed', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const a = recallOrder(items, makeRng(123));
    const b = recallOrder(items, makeRng(123));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items); // same multiset
    expect(items).toEqual([1, 2, 3, 4, 5, 6]); // input untouched
  });
});

describe('scoreRecall / normalizeAnswer', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(scoreRecall('Red Apple', '  red   apple ')).toBe(true);
    expect(scoreRecall('honey', 'HONEY')).toBe(true);
  });

  it('rejects a wrong or empty attempt', () => {
    expect(scoreRecall('honey', 'money')).toBe(false);
    expect(scoreRecall('honey', '   ')).toBe(false);
    expect(scoreRecall('', '')).toBe(false);
  });

  it('normalizeAnswer collapses whitespace and lowercases', () => {
    expect(normalizeAnswer('  A  B  ')).toBe('a b');
  });
});
