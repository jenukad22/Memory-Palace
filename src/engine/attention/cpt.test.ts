import { describe, expect, it } from 'vitest';
import { makeRng } from '../assessment/sequences';
import {
  CPT_DISTRACTOR_LETTER,
  CPT_GO_LETTERS,
  generateCptStream,
  scoreCpt,
  type CptStimulus,
  type CptTrialResult,
} from './cpt';
import { CPT_DISTRACTOR_RATE, CPT_TRIALS } from './timing';

const streamFor = (seed: number, options = {}) => generateCptStream(makeRng(seed), options);

/** A perfect responder: presses on every target, withholds on every distractor. */
const perfect = (stream: CptStimulus[], rtMs = 400): CptTrialResult[] =>
  stream.map((s) => ({
    isTarget: s.isTarget,
    responded: s.isTarget,
    rtMs: s.isTarget ? rtMs : null,
  }));

describe('generateCptStream', () => {
  it('produces the requested number of trials', () => {
    expect(streamFor(1)).toHaveLength(CPT_TRIALS);
    expect(streamFor(1, { trials: 40 })).toHaveLength(40);
  });

  it('places an exact distractor count', () => {
    const stream = streamFor(3);
    const distractors = stream.filter((s) => !s.isTarget).length;
    expect(distractors).toBe(Math.round(CPT_TRIALS * CPT_DISTRACTOR_RATE));
  });

  it('is deterministic for a seed and different across seeds', () => {
    expect(streamFor(9)).toEqual(streamFor(9));
    expect(streamFor(9)).not.toEqual(streamFor(10));
  });

  it('never starts on a distractor', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      expect(streamFor(seed)[0]!.isTarget).toBe(true);
    }
  });

  it('never puts two distractors in a row', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const stream = streamFor(seed);
      for (let i = 1; i < stream.length; i += 1) {
        expect(stream[i]!.isTarget || stream[i - 1]!.isTarget).toBe(true);
      }
    }
  });

  it('never repeats a go letter back to back', () => {
    for (let seed = 0; seed < 15; seed += 1) {
      const stream = streamFor(seed);
      const gos = stream.filter((s) => s.isTarget);
      // adjacent go letters in the raw stream (a distractor between them is fine)
      for (let i = 1; i < stream.length; i += 1) {
        const a = stream[i - 1]!;
        const b = stream[i]!;
        if (a.isTarget && b.isTarget) expect(a.letter).not.toBe(b.letter);
      }
      expect(gos.length).toBeGreaterThan(0);
    }
  });

  it('uses only go letters for targets and the distractor letter for no-go', () => {
    for (const s of streamFor(5)) {
      if (s.isTarget) expect(CPT_GO_LETTERS as readonly string[]).toContain(s.letter);
      else expect(s.letter).toBe(CPT_DISTRACTOR_LETTER);
    }
  });

  it('keeps the exact count even when the density strains the spacing rule', () => {
    const stream = generateCptStream(makeRng(2), { trials: 20, distractorRate: 0.45 });
    expect(stream).toHaveLength(20);
    expect(stream.filter((s) => !s.isTarget)).toHaveLength(9);
    expect(stream[0]!.isTarget).toBe(true);
  });

  it('draws on most of the go alphabet across a full stream', () => {
    const letters = new Set(
      streamFor(11)
        .filter((s) => s.isTarget)
        .map((s) => s.letter),
    );
    expect(letters.size).toBeGreaterThan(CPT_GO_LETTERS.length / 2);
  });
});

describe('scoreCpt', () => {
  const stream = streamFor(4);

  it('scores a flawless run at its ceiling with no errors', () => {
    const m = scoreCpt(perfect(stream));
    expect(m.omissions).toBe(0);
    expect(m.commissions).toBe(0);
    expect(m.hitRate).toBe(1);
    expect(m.commissionRate).toBe(0);
    expect(m.dPrime).toBeCloseTo(m.maxDPrime, 10);
    expect(m.dPrime).toBeGreaterThan(3);
  });

  it('counts commissions separately from omissions', () => {
    const results: CptTrialResult[] = [
      { isTarget: true, responded: true, rtMs: 380 },
      { isTarget: true, responded: false, rtMs: null }, // omission
      { isTarget: false, responded: true, rtMs: 300 }, // commission
      { isTarget: false, responded: false, rtMs: null }, // correct rejection
    ];
    const m = scoreCpt(results);
    expect(m).toMatchObject({
      trials: 4,
      targets: 2,
      distractors: 2,
      hits: 1,
      omissions: 1,
      commissions: 1,
      correctRejections: 1,
    });
    expect(m.hitRate).toBe(0.5);
    expect(m.omissionRate).toBe(0.5);
    expect(m.commissionRate).toBe(0.5);
  });

  it('does not reward pressing at everything', () => {
    const pressEverything = stream.map((s) => ({
      isTarget: s.isTarget,
      responded: true,
      rtMs: 350,
    }));
    const m = scoreCpt(pressEverything);
    expect(m.hitRate).toBe(1); // a perfect hit rate, and yet:
    // Near the floor, not near the ceiling. Not exactly 0 — see the documented
    // loglinear residual at unequal trial counts in signalDetection.ts.
    expect(m.dPrime / m.maxDPrime).toBeLessThan(0.1);
    expect(m.criterion).toBeLessThan(0); // pressed readily
    expect(m.commissions).toBeGreaterThan(0);
  });

  it('does not reward pressing at nothing', () => {
    const m = scoreCpt(stream.map((s) => ({ isTarget: s.isTarget, responded: false, rtMs: null })));
    expect(m.commissions).toBe(0); // zero commission errors, and yet:
    expect(m.dPrime / m.maxDPrime).toBeLessThan(0.1);
    expect(m.criterion).toBeGreaterThan(0); // withheld readily
    expect(m.meanHitRtMs).toBeNull();
  });

  it('ranks a careful run above a commission-heavy one at the same hit rate', () => {
    const careful = scoreCpt(perfect(stream));
    const leaky = scoreCpt(
      stream.map((s) => ({ isTarget: s.isTarget, responded: true, rtMs: 350 })),
    );
    expect(careful.dPrime).toBeGreaterThan(leaky.dPrime);
  });

  it('reports RT spread only over hits', () => {
    const results: CptTrialResult[] = [
      { isTarget: true, responded: true, rtMs: 300 },
      { isTarget: true, responded: true, rtMs: 500 },
      { isTarget: false, responded: true, rtMs: 100 }, // commission RT is excluded
      { isTarget: true, responded: false, rtMs: null },
    ];
    const m = scoreCpt(results);
    expect(m.meanHitRtMs).toBe(400);
    expect(m.medianHitRtMs).toBe(400);
    expect(m.rtSdMs).toBeCloseTo(Math.sqrt((100 ** 2 + 100 ** 2) / 1), 10);
    expect(m.rtCoefficientOfVariation).toBeCloseTo(m.rtSdMs! / 400, 10);
  });

  it('leaves RT spread null when there is nothing to spread', () => {
    const m = scoreCpt([{ isTarget: true, responded: true, rtMs: 300 }]);
    expect(m.meanHitRtMs).toBe(300);
    expect(m.rtSdMs).toBeNull();
    expect(m.rtCoefficientOfVariation).toBeNull();
  });

  it('returns null rates, not NaN, for an empty run', () => {
    const m = scoreCpt([]);
    expect(m.trials).toBe(0);
    expect(m.hitRate).toBeNull();
    expect(m.commissionRate).toBeNull();
    expect(Number.isFinite(m.dPrime)).toBe(true);
  });
});
