/**
 * Base-rate item generation and scoring (modules/reasoning/SPEC.md §2.1, §4.1).
 * The classic Bayesian base-rate paradigm — a prevalence, a hit rate, a
 * false-positive rate — generated and scored from the same rounded counts a
 * frequency-format item actually displays, so a probability-format item and
 * its frequency-format twin always agree on the target answer.
 *
 * No prose lives here — `scenarioKey` is an opaque identifier the module layer
 * renders into a sentence (SPEC.md §6). This file only ever deals in numbers.
 */

import type { Rng } from '../assessment/sequences';

export type BaseRateFormat = 'probability' | 'frequency';

export const BASE_RATE_SCENARIO_KEYS = [
  'medicalTest',
  'qualityControl',
  'airportScanner',
  'spamFilter',
  'weatherAlert',
  'plagiarismCheck',
] as const;
export type BaseRateScenarioKey = (typeof BASE_RATE_SCENARIO_KEYS)[number];

/** Fixed population for the frequency framing — a rendering choice, not a statistic. */
export const BASE_RATE_POPULATION = 1000;

/** "Nice" candidate percentages so frequency counts round to whole people. */
const PREVALENCE_CANDIDATES_PCT = [1, 2, 5, 10, 15, 20, 25, 30] as const;
const SENSITIVITY_CANDIDATES_PCT = [70, 75, 80, 85, 90, 95, 99] as const;
const FALSE_POSITIVE_CANDIDATES_PCT = [1, 2, 5, 10, 15, 20] as const;

const MAX_ATTEMPTS = 50;

export interface BaseRateItem {
  scenarioKey: BaseRateScenarioKey;
  format: BaseRateFormat;
  prevalencePct: number;
  sensitivityPct: number;
  falsePositiveRatePct: number;
  n: number;
  /** People who actually have the condition, out of `n`. */
  conditionCount: number;
  /** Positives among the `conditionCount` who have it. */
  truePositives: number;
  /** Positives among the `n - conditionCount` who don't have it. */
  falsePositives: number;
  /** truePositives + falsePositives — the denominator the question asks about. */
  totalPositives: number;
  /** The correct answer, derived from the rounded counts above, not raw Bayes. */
  truePosteriorPct: number;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0]!;
}

/** Pick an index in [0, count) other than `exclude` (pass -1 for no exclusion). */
function pickIndexExcluding(rng: Rng, count: number, exclude: number): number {
  if (exclude < 0 || exclude >= count) return Math.floor(rng() * count);
  const d = Math.floor(rng() * (count - 1));
  return d >= exclude ? d + 1 : d;
}

export interface GenerateBaseRateItemOptions {
  scenarioKey?: BaseRateScenarioKey;
  format?: BaseRateFormat;
}

/**
 * One item. Draws prevalence/sensitivity/false-positive-rate from "nice"
 * percentage sets, computes rounded counts against a fixed population of
 * `BASE_RATE_POPULATION`, and derives the correct answer from those same
 * rounded counts. A draw with zero total positives (nothing to condition on)
 * is rejected and redrawn — statistically rare with these candidate sets, but
 * handled rather than assumed away, matching `generateDigitSequence`'s
 * bounded-retry shape.
 */
export function generateBaseRateItem(
  rng: Rng,
  options: GenerateBaseRateItemOptions = {},
): BaseRateItem {
  const scenarioKey = options.scenarioKey ?? pick(rng, BASE_RATE_SCENARIO_KEYS);
  const format = options.format ?? (rng() < 0.5 ? 'probability' : 'frequency');
  const n = BASE_RATE_POPULATION;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const prevalencePct = pick(rng, PREVALENCE_CANDIDATES_PCT);
    const sensitivityPct = pick(rng, SENSITIVITY_CANDIDATES_PCT);
    const falsePositiveRatePct = pick(rng, FALSE_POSITIVE_CANDIDATES_PCT);

    const conditionCount = Math.round((prevalencePct / 100) * n);
    const truePositives = Math.round((sensitivityPct / 100) * conditionCount);
    const falsePositives = Math.round((falsePositiveRatePct / 100) * (n - conditionCount));
    const totalPositives = truePositives + falsePositives;
    if (totalPositives === 0) continue;

    return {
      scenarioKey,
      format,
      prevalencePct,
      sensitivityPct,
      falsePositiveRatePct,
      n,
      conditionCount,
      truePositives,
      falsePositives,
      totalPositives,
      truePosteriorPct: (truePositives / totalPositives) * 100,
    };
  }
  // Exhausting attempts is statistically implausible with these candidate
  // sets (only the lowest prevalence/sensitivity paired with the lowest
  // false-positive rate can reach zero, and even that is one specific
  // combination); fail loudly rather than return an item with no answer.
  throw new RangeError('generateBaseRateItem: could not draw an item with a nonzero denominator');
}

export const BASE_RATE_ITEMS_PER_RUN = 10;

/**
 * A run of items: format balanced (half probability, half frequency, shuffled)
 * and scenario chosen without an immediate repeat, so a run doesn't retell the
 * same scenario twice in a row.
 */
export function generateBaseRateRun(
  rng: Rng,
  count: number = BASE_RATE_ITEMS_PER_RUN,
): BaseRateItem[] {
  const half = Math.floor(count / 2);
  const formats: BaseRateFormat[] = [
    ...Array<BaseRateFormat>(half).fill('probability'),
    ...Array<BaseRateFormat>(count - half).fill('frequency'),
  ];
  for (let i = formats.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [formats[i], formats[j]] = [formats[j]!, formats[i]!];
  }

  const items: BaseRateItem[] = [];
  let lastScenarioIndex = -1;
  for (let i = 0; i < count; i += 1) {
    const scenarioIndex = pickIndexExcluding(
      rng,
      BASE_RATE_SCENARIO_KEYS.length,
      lastScenarioIndex,
    );
    lastScenarioIndex = scenarioIndex;
    items.push(
      generateBaseRateItem(rng, {
        scenarioKey: BASE_RATE_SCENARIO_KEYS[scenarioIndex]!,
        format: formats[i]!,
      }),
    );
  }
  return items;
}

export interface BaseRateAnswerScore {
  /** The user's answer, converted to a percentage regardless of format. */
  answerPct: number;
  absoluteErrorPct: number;
}

/**
 * Scores one answer. The answer's *unit* depends on the item's format — this
 * is the one place that distinction has to be handled correctly:
 * - `probability` format: `answer` is a percentage, 0–100, directly.
 * - `frequency` format: `answer` is a **count** out of `item.totalPositives`,
 *   converted to a percentage before comparing.
 *
 * Both branches land on the same percentage-point error scale, which is what
 * makes the cross-format comparison in `scoreBaseRateRun` meaningful.
 */
export function scoreBaseRateAnswer(item: BaseRateItem, answer: number): BaseRateAnswerScore {
  const answerPct =
    item.format === 'probability'
      ? answer
      : item.totalPositives === 0
        ? 0
        : (answer / item.totalPositives) * 100;
  return { answerPct, absoluteErrorPct: Math.abs(answerPct - item.truePosteriorPct) };
}

export interface BaseRateFormatMetrics {
  trials: number;
  meanAbsoluteErrorPct: number | null;
}

export interface BaseRateRunMetrics {
  trials: number;
  meanAbsoluteErrorPct: number | null;
  byFormat: Record<BaseRateFormat, BaseRateFormatMetrics>;
}

function meanErrorOf(errors: number[]): number | null {
  return errors.length === 0 ? null : errors.reduce((a, b) => a + b, 0) / errors.length;
}

/**
 * Aggregates a run's answers, overall and **split by format** — the format
 * split is the reportable finding this task exists to produce, not a side
 * statistic (SPEC.md §4.1).
 */
export function scoreBaseRateRun(
  items: readonly BaseRateItem[],
  answers: readonly number[],
): BaseRateRunMetrics {
  const errors = items.map(
    (item, i) => scoreBaseRateAnswer(item, answers[i] ?? 0).absoluteErrorPct,
  );
  const errorsByFormat: Record<BaseRateFormat, number[]> = { probability: [], frequency: [] };
  items.forEach((item, i) => errorsByFormat[item.format].push(errors[i]!));

  return {
    trials: items.length,
    meanAbsoluteErrorPct: meanErrorOf(errors),
    byFormat: {
      probability: {
        trials: errorsByFormat.probability.length,
        meanAbsoluteErrorPct: meanErrorOf(errorsByFormat.probability),
      },
      frequency: {
        trials: errorsByFormat.frequency.length,
        meanAbsoluteErrorPct: meanErrorOf(errorsByFormat.frequency),
      },
    },
  };
}
