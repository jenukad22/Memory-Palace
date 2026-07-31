import { beforeEach, describe, expect, it } from 'vitest';
import { getAbility, listAbilityHistory } from '@/db/queries/ability';
import { listAssessments } from '@/db/queries/assessments';
import { createTestDb } from '@/db/testing';
import type { Db } from '@/db/types';
import {
  calibrationCurve,
  generateBaseRateRun,
  makeRng,
  scoreBaseRateRun,
  scoreCalibrationRun,
  scoreDisconfirmationRun,
  scoreHypothesesRun,
} from '@/engine';
import {
  BASE_RATE_INSTRUMENT,
  CALIBRATION_INSTRUMENT,
  DISCONFIRMATION_INSTRUMENT,
  HYPOTHESES_INSTRUMENT,
  REASONING_MODULE,
  allCalibrationTrials,
  recordBaseRateRun,
  recordCalibrationRun,
  recordDisconfirmationRun,
  recordHypothesesRun,
  reseedReasoningElo,
} from './results';

describe('recording runs', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('writes one row per base-rate run, scored on mean absolute error', () => {
    const items = generateBaseRateRun(makeRng(1), 4);
    // Answer format matches each item's contract (SPEC.md §4.1): a percentage
    // for probability-format items, a count out of totalPositives otherwise.
    const answers = items.map((i) =>
      i.format === 'probability' ? i.truePosteriorPct : i.truePositives,
    );
    const metrics = scoreBaseRateRun(items, answers);
    const recorded = recordBaseRateRun(db, { metrics, items, answers });

    const rows = listAssessments(db, BASE_RATE_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBeCloseTo(metrics.meanAbsoluteErrorPct!, 10);
    expect(recorded!.rawScore).toBeCloseTo(metrics.meanAbsoluteErrorPct!, 10);
    expect(rows[0]!.normalized).toBeNull();
    expect(JSON.parse(rows[0]!.payload!).items).toHaveLength(4);
  });

  it('refuses to write a base-rate run with no items', () => {
    const metrics = scoreBaseRateRun([], []);
    expect(recordBaseRateRun(db, { metrics, items: [], answers: [] })).toBeNull();
    expect(listAssessments(db, BASE_RATE_INSTRUMENT)).toHaveLength(0);
    expect(getAbility(db, REASONING_MODULE)).toBeUndefined();
  });

  it('writes one row per hypotheses run, scored on mean unique per prompt', () => {
    const trials = [
      { prompt: 'p1', entries: ['a', 'b', 'c'] },
      { prompt: 'p2', entries: ['x'] },
    ];
    const metrics = scoreHypothesesRun(trials.map((t) => t.entries));
    recordHypothesesRun(db, { metrics, trials });
    const rows = listAssessments(db, HYPOTHESES_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBe(2); // (3+1)/2
    expect(JSON.parse(rows[0]!.payload!).trials[0].prompt).toBe('p1');
  });

  it('refuses to write a hypotheses run with zero prompts', () => {
    const metrics = scoreHypothesesRun([]);
    expect(recordHypothesesRun(db, { metrics, trials: [] })).toBeNull();
    expect(listAssessments(db, HYPOTHESES_INSTRUMENT)).toHaveLength(0);
  });

  it('writes one row per disconfirmation run, scored on mean self-score', () => {
    const trials = [
      { claim: 'c1', answer: 'a1', rating: 'yes' as const },
      { claim: 'c2', answer: 'a2', rating: 'partial' as const },
    ];
    const metrics = scoreDisconfirmationRun(trials.map((t) => t.rating));
    recordDisconfirmationRun(db, { metrics, trials });
    const rows = listAssessments(db, DISCONFIRMATION_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBeCloseTo(0.75, 10);
  });

  it('refuses to write a disconfirmation run where everything was skipped', () => {
    const metrics = scoreDisconfirmationRun(['skipped', 'skipped']);
    expect(
      recordDisconfirmationRun(db, {
        metrics,
        trials: [
          { claim: 'c1', answer: '', rating: 'skipped' },
          { claim: 'c2', answer: '', rating: 'skipped' },
        ],
      }),
    ).toBeNull();
    expect(listAssessments(db, DISCONFIRMATION_INSTRUMENT)).toHaveLength(0);
  });

  it('writes one row per calibration run, scored on brier score', () => {
    const trials = [
      { itemId: 'i1', confidencePct: 90, correct: true },
      { itemId: 'i2', confidencePct: 60, correct: false },
    ];
    const metrics = scoreCalibrationRun(trials);
    recordCalibrationRun(db, { metrics, trials });
    const rows = listAssessments(db, CALIBRATION_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBeCloseTo(metrics.brierScore!, 10);
    expect(JSON.parse(rows[0]!.payload!).trials[0].itemId).toBe('i1');
  });

  it('refuses to write a calibration run with no trials', () => {
    const metrics = scoreCalibrationRun([]);
    expect(recordCalibrationRun(db, { metrics, trials: [] })).toBeNull();
    expect(listAssessments(db, CALIBRATION_INSTRUMENT)).toHaveLength(0);
  });
});

describe('reasoning Elo', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('writes no Elo until a reasoning task has been run', () => {
    expect(reseedReasoningElo(db)).toBeNull();
    expect(getAbility(db, REASONING_MODULE)).toBeUndefined();
    expect(listAbilityHistory(db, REASONING_MODULE)).toHaveLength(0);
  });

  it('seeds the module Elo from a single completed task', () => {
    const trials = [
      { itemId: 'i1', confidencePct: 100, correct: true },
      { itemId: 'i2', confidencePct: 100, correct: true },
    ];
    const metrics = scoreCalibrationRun(trials);
    const recorded = recordCalibrationRun(db, { metrics, trials });
    expect(recorded!.elo).not.toBeNull();
    expect(getAbility(db, REASONING_MODULE)!.elo).toBeCloseTo(recorded!.elo!, 10);
  });

  it('appends to the ability history on every run, never overwriting it', () => {
    const good = [
      { itemId: 'i1', confidencePct: 100, correct: true },
      { itemId: 'i2', confidencePct: 100, correct: true },
    ];
    recordCalibrationRun(db, { metrics: scoreCalibrationRun(good), trials: good });
    const bad = [
      { itemId: 'i3', confidencePct: 100, correct: false },
      { itemId: 'i4', confidencePct: 100, correct: false },
    ];
    recordCalibrationRun(db, { metrics: scoreCalibrationRun(bad), trials: bad });

    const history = listAbilityHistory(db, REASONING_MODULE);
    expect(history).toHaveLength(2);
    expect(history[1]!.elo).toBeLessThan(history[0]!.elo);
  });

  it('recomputes from the latest row of each instrument as tasks are added', () => {
    const good = [{ itemId: 'i1', confidencePct: 100, correct: true }];
    const afterCalibration = recordCalibrationRun(db, {
      metrics: scoreCalibrationRun(good),
      trials: good,
    })!.elo!;

    const hypoTrials = [{ prompt: 'p', entries: ['a', 'b', 'c'] }]; // below-midpoint fluency
    const afterHypotheses = recordHypothesesRun(db, {
      metrics: scoreHypothesesRun(hypoTrials.map((t) => t.entries)),
      trials: hypoTrials,
    })!.elo!;

    expect(afterHypotheses).not.toBeCloseTo(afterCalibration, 6);
    expect(listAbilityHistory(db, REASONING_MODULE)).toHaveLength(2);
  });

  it('leaves other modules untouched', () => {
    const trials = [{ itemId: 'i1', confidencePct: 100, correct: true }];
    recordCalibrationRun(db, { metrics: scoreCalibrationRun(trials), trials });
    expect(getAbility(db, 'attention')).toBeUndefined();
    expect(getAbility(db, 'memory')).toBeUndefined();
  });
});

describe('allCalibrationTrials (running curve source)', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('is empty before any calibration run', () => {
    expect(allCalibrationTrials(db)).toEqual([]);
  });

  it('concatenates trials across sessions in chronological order', () => {
    const sessionOne = [
      { itemId: 'i1', confidencePct: 80, correct: true },
      { itemId: 'i2', confidencePct: 80, correct: false },
    ];
    recordCalibrationRun(
      db,
      { metrics: scoreCalibrationRun(sessionOne), trials: sessionOne },
      new Date(1000),
    );
    const sessionTwo = [{ itemId: 'i3', confidencePct: 80, correct: true }];
    recordCalibrationRun(
      db,
      { metrics: scoreCalibrationRun(sessionTwo), trials: sessionTwo },
      new Date(2000),
    );

    const all = allCalibrationTrials(db);
    expect(all).toHaveLength(3);
    expect(all.map((t) => t.itemId)).toEqual(['i1', 'i2', 'i3']);
  });

  it('feeds directly into calibrationCurve to produce a running curve — no separate accumulation logic', () => {
    const sessionOne = [
      { itemId: 'i1', confidencePct: 70, correct: true },
      { itemId: 'i2', confidencePct: 70, correct: false },
    ];
    recordCalibrationRun(
      db,
      { metrics: scoreCalibrationRun(sessionOne), trials: sessionOne },
      new Date(1000),
    );
    const sessionTwo = [{ itemId: 'i3', confidencePct: 70, correct: true }];
    recordCalibrationRun(
      db,
      { metrics: scoreCalibrationRun(sessionTwo), trials: sessionTwo },
      new Date(2000),
    );

    const running = calibrationCurve(allCalibrationTrials(db));
    const bucket = running.find((b) => b.confidencePct === 70)!;
    expect(bucket.trials).toBe(3);
    expect(bucket.correct).toBe(2);
  });
});
