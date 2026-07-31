import { describe, expect, it } from 'vitest';
import { makeRng } from '@/engine';
import { DISCONFIRMATION_CLAIMS, sampleDisconfirmationClaims } from './disconfirmationBank';

describe('DISCONFIRMATION_CLAIMS', () => {
  it('has enough entries for a run with room to spare', () => {
    expect(DISCONFIRMATION_CLAIMS.length).toBeGreaterThanOrEqual(15);
  });

  it('has no duplicate claims', () => {
    const claims = DISCONFIRMATION_CLAIMS.map((c) => c.claim);
    expect(new Set(claims).size).toBe(claims.length);
  });

  it('gives every claim at least two example disconfirming conditions', () => {
    for (const c of DISCONFIRMATION_CLAIMS) {
      expect(c.examples.length).toBeGreaterThanOrEqual(2);
      for (const example of c.examples) expect(example.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('sampleDisconfirmationClaims', () => {
  it('draws the requested count of distinct claims', () => {
    const sample = sampleDisconfirmationClaims(makeRng(1), 6);
    expect(sample).toHaveLength(6);
    expect(new Set(sample.map((c) => c.claim)).size).toBe(6);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(sampleDisconfirmationClaims(makeRng(3), 6)).toEqual(
      sampleDisconfirmationClaims(makeRng(3), 6),
    );
    expect(sampleDisconfirmationClaims(makeRng(3), 6)).not.toEqual(
      sampleDisconfirmationClaims(makeRng(4), 6),
    );
  });

  it('throws rather than silently under-filling', () => {
    expect(() => sampleDisconfirmationClaims(makeRng(1), 10_000)).toThrow(RangeError);
  });
});
