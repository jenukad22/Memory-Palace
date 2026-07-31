import { describe, expect, it } from 'vitest';
import { makeRng } from '../assessment/sequences';
import {
  BASE_RATE_ITEMS_PER_RUN,
  BASE_RATE_POPULATION,
  BASE_RATE_SCENARIO_KEYS,
  generateBaseRateItem,
  generateBaseRateRun,
  scoreBaseRateAnswer,
  scoreBaseRateRun,
  type BaseRateItem,
} from './baseRate';

describe('generateBaseRateItem', () => {
  it('is deterministic for a seed and different across seeds', () => {
    expect(generateBaseRateItem(makeRng(1))).toEqual(generateBaseRateItem(makeRng(1)));
    expect(generateBaseRateItem(makeRng(1))).not.toEqual(generateBaseRateItem(makeRng(2)));
  });

  it('uses the fixed population', () => {
    expect(generateBaseRateItem(makeRng(3)).n).toBe(BASE_RATE_POPULATION);
  });

  it('derives the correct answer from the rounded counts, not raw Bayes', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const item = generateBaseRateItem(makeRng(seed));
      const expected = (item.truePositives / item.totalPositives) * 100;
      expect(item.truePosteriorPct).toBeCloseTo(expected, 10);
      // Every count is a whole person.
      expect(Number.isInteger(item.conditionCount)).toBe(true);
      expect(Number.isInteger(item.truePositives)).toBe(true);
      expect(Number.isInteger(item.falsePositives)).toBe(true);
    }
  });

  it('never returns an item with a zero denominator', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(generateBaseRateItem(makeRng(seed)).totalPositives).toBeGreaterThan(0);
    }
  });

  it('honours a requested scenario and format', () => {
    const item = generateBaseRateItem(makeRng(5), {
      scenarioKey: 'spamFilter',
      format: 'frequency',
    });
    expect(item.scenarioKey).toBe('spamFilter');
    expect(item.format).toBe('frequency');
  });

  it('draws both formats across seeds', () => {
    const formats = new Set(
      Array.from({ length: 30 }, (_, s) => generateBaseRateItem(makeRng(s)).format),
    );
    expect(formats.has('probability')).toBe(true);
    expect(formats.has('frequency')).toBe(true);
  });

  it('a probability-format item and its frequency-format twin agree on the target answer', () => {
    // Same draw, forced into each format: the underlying counts (and thus the
    // target) must be identical regardless of which format renders them.
    for (let seed = 0; seed < 20; seed += 1) {
      const asProbability = generateBaseRateItem(makeRng(seed), {
        scenarioKey: 'medicalTest',
        format: 'probability',
      });
      const asFrequency = generateBaseRateItem(makeRng(seed), {
        scenarioKey: 'medicalTest',
        format: 'frequency',
      });
      expect(asFrequency.truePosteriorPct).toBeCloseTo(asProbability.truePosteriorPct, 10);
      expect(asFrequency.totalPositives).toBe(asProbability.totalPositives);
    }
  });
});

describe('generateBaseRateRun', () => {
  it('produces the requested count', () => {
    expect(generateBaseRateRun(makeRng(1))).toHaveLength(BASE_RATE_ITEMS_PER_RUN);
    expect(generateBaseRateRun(makeRng(1), 6)).toHaveLength(6);
  });

  it('balances formats within a run', () => {
    const run = generateBaseRateRun(makeRng(7), 10);
    expect(run.filter((i) => i.format === 'probability')).toHaveLength(5);
    expect(run.filter((i) => i.format === 'frequency')).toHaveLength(5);
  });

  it('never repeats the same scenario back to back', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const run = generateBaseRateRun(makeRng(seed), 10);
      for (let i = 1; i < run.length; i += 1) {
        expect(run[i]!.scenarioKey).not.toBe(run[i - 1]!.scenarioKey);
      }
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateBaseRateRun(makeRng(11))).toEqual(generateBaseRateRun(makeRng(11)));
  });

  it('draws on more than one scenario across a run', () => {
    const keys = new Set(generateBaseRateRun(makeRng(4), 10).map((i) => i.scenarioKey));
    expect(keys.size).toBeGreaterThan(1);
    for (const key of keys) expect(BASE_RATE_SCENARIO_KEYS as readonly string[]).toContain(key);
  });
});

describe('scoreBaseRateAnswer', () => {
  const probabilityItem: BaseRateItem = {
    scenarioKey: 'medicalTest',
    format: 'probability',
    prevalencePct: 2,
    sensitivityPct: 90,
    falsePositiveRatePct: 5,
    n: 1000,
    conditionCount: 20,
    truePositives: 18,
    falsePositives: 49,
    totalPositives: 67,
    truePosteriorPct: (18 / 67) * 100,
  };
  const frequencyItem: BaseRateItem = { ...probabilityItem, format: 'frequency' };

  it('reads a probability-format answer as a percentage directly', () => {
    const score = scoreBaseRateAnswer(probabilityItem, 30);
    expect(score.answerPct).toBe(30);
    expect(score.absoluteErrorPct).toBeCloseTo(Math.abs(30 - probabilityItem.truePosteriorPct), 10);
  });

  it('converts a frequency-format answer from a count out of totalPositives', () => {
    const score = scoreBaseRateAnswer(frequencyItem, 18); // the exactly-correct count
    expect(score.answerPct).toBeCloseTo(frequencyItem.truePosteriorPct, 10);
    expect(score.absoluteErrorPct).toBeCloseTo(0, 10);
  });

  it('scores a wrong frequency-format count as a proportional percentage error', () => {
    const score = scoreBaseRateAnswer(frequencyItem, 67); // "everyone who tested positive has it"
    expect(score.answerPct).toBeCloseTo(100, 10);
  });

  it('scores a perfect probability-format answer as zero error', () => {
    const score = scoreBaseRateAnswer(probabilityItem, probabilityItem.truePosteriorPct);
    expect(score.absoluteErrorPct).toBeCloseTo(0, 10);
  });
});

describe('scoreBaseRateRun', () => {
  it('returns null means for an empty run rather than NaN', () => {
    const m = scoreBaseRateRun([], []);
    expect(m.trials).toBe(0);
    expect(m.meanAbsoluteErrorPct).toBeNull();
    expect(m.byFormat.probability.meanAbsoluteErrorPct).toBeNull();
    expect(m.byFormat.frequency.meanAbsoluteErrorPct).toBeNull();
  });

  it('aggregates overall and split by format', () => {
    const run = generateBaseRateRun(makeRng(9), 4); // 2 probability, 2 frequency
    // Answer everything with the true posterior in the format-appropriate unit.
    const answers = run.map((item) =>
      item.format === 'probability' ? item.truePosteriorPct : item.truePositives,
    );
    const m = scoreBaseRateRun(run, answers);
    expect(m.trials).toBe(4);
    expect(m.meanAbsoluteErrorPct).toBeCloseTo(0, 6);
    expect(m.byFormat.probability.trials).toBe(2);
    expect(m.byFormat.frequency.trials).toBe(2);
    expect(m.byFormat.probability.meanAbsoluteErrorPct).toBeCloseTo(0, 6);
    expect(m.byFormat.frequency.meanAbsoluteErrorPct).toBeCloseTo(0, 6);
  });

  it('reports a worse format separately from a better one', () => {
    const run = generateBaseRateRun(makeRng(13), 4);
    const answers = run.map(
      (item) =>
        item.format === 'probability'
          ? item.truePosteriorPct // perfect
          : 0, // way off
    );
    const m = scoreBaseRateRun(run, answers);
    expect(m.byFormat.probability.meanAbsoluteErrorPct!).toBeLessThan(
      m.byFormat.frequency.meanAbsoluteErrorPct!,
    );
  });

  it('treats a missing answer as zero rather than throwing', () => {
    const run = generateBaseRateRun(makeRng(2), 3);
    const m = scoreBaseRateRun(run, [50]); // two answers missing
    expect(m.trials).toBe(3);
    expect(m.meanAbsoluteErrorPct).not.toBeNull();
  });
});
