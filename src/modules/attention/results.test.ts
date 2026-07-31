import { beforeEach, describe, expect, it } from 'vitest';
import { getAbility, listAbilityHistory } from '@/db/queries/ability';
import { listAssessments } from '@/db/queries/assessments';
import { createTestDb } from '@/db/testing';
import type { Db } from '@/db/types';
import {
  scoreCpt,
  scoreFlicker,
  scorePvt,
  summarizeOnsets,
  type CptTrialResult,
  type FlickerTrialResult,
  type PvtTrial,
  type TimingProfile,
} from '@/engine';
import {
  ATTENTION_MODULE,
  CPT_INSTRUMENT,
  FLICKER_INSTRUMENT,
  PVT_INSTRUMENT,
  attentionPayload,
  latestRawScore,
  rawScoreSamples,
  recordCptRun,
  recordFlickerRun,
  recordPvtRun,
  reseedAttentionElo,
} from './results';

const timing: TimingProfile = summarizeOnsets(
  [
    { requestedMs: 0, paintedMs: 3 },
    { requestedMs: 1000, paintedMs: 1005 },
  ],
  { highResolutionClock: true },
);

const pvtTrials = (rts: number[]): PvtTrial[] => rts.map((rtMs) => ({ rtMs, preStimulus: false }));

const cptTrials: CptTrialResult[] = [
  { isTarget: true, responded: true, rtMs: 380 },
  { isTarget: true, responded: true, rtMs: 400 },
  { isTarget: false, responded: false, rtMs: null },
];

const flickerTrials: FlickerTrialResult[] = [
  { detected: true, detectionMs: 8000, falseTaps: 1 },
  { detected: false, detectionMs: null, falseTaps: 0 },
];

describe('attentionPayload', () => {
  it('round-trips metrics, trials and the timing profile', () => {
    const metrics = scorePvt(pvtTrials([250, 300]));
    const parsed = JSON.parse(attentionPayload(metrics, pvtTrials([250, 300]), timing));
    expect(parsed.metrics.responseSpeed).toBeCloseTo(metrics.responseSpeed!, 10);
    expect(parsed.trials).toHaveLength(2);
    expect(parsed.timing.quality).toBe(timing.quality);
    expect(parsed.timing.rtUncertaintyMs).toBeCloseTo(timing.rtUncertaintyMs, 10);
  });

  it('keeps the per-trial detail the raw score compresses away', () => {
    const trials = pvtTrials([250, 900, 300]);
    const parsed = JSON.parse(attentionPayload(scorePvt(trials), trials, timing));
    expect(parsed.trials.map((t: PvtTrial) => t.rtMs)).toEqual([250, 900, 300]);
  });
});

describe('recording runs', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('writes one row per PVT run, scored on response speed', () => {
    const trials = pvtTrials([250, 500]);
    const metrics = scorePvt(trials);
    const recorded = recordPvtRun(db, { metrics, trials, timing });

    const rows = listAssessments(db, PVT_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBeCloseTo(3, 10); // mean(1000/250, 1000/500)
    expect(recorded!.rawScore).toBeCloseTo(3, 10);
    expect(rows[0]!.normalized).toBeNull();
    expect(JSON.parse(rows[0]!.payload!).timing.samples).toBe(2);
  });

  it('refuses to write a PVT run with nothing scorable', () => {
    const trials: PvtTrial[] = [{ rtMs: null, preStimulus: true }];
    expect(recordPvtRun(db, { metrics: scorePvt(trials), trials, timing })).toBeNull();
    expect(listAssessments(db, PVT_INSTRUMENT)).toHaveLength(0);
    expect(getAbility(db, ATTENTION_MODULE)).toBeUndefined();
  });

  it('writes one row per CPT run, scored on d-prime', () => {
    const metrics = scoreCpt(cptTrials);
    recordCptRun(db, { metrics, trials: cptTrials, timing });
    const rows = listAssessments(db, CPT_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBeCloseTo(metrics.dPrime, 10);
    expect(JSON.parse(rows[0]!.payload!).metrics.commissions).toBe(0);
  });

  it('refuses to write a CPT run with no trials', () => {
    const metrics = scoreCpt([]);
    expect(recordCptRun(db, { metrics, trials: [], timing })).toBeNull();
    expect(listAssessments(db, CPT_INSTRUMENT)).toHaveLength(0);
  });

  it('writes one row per flicker run, scored on timeout-imputed detection time', () => {
    const metrics = scoreFlicker(flickerTrials);
    recordFlickerRun(db, { metrics, trials: flickerTrials, timing });
    const rows = listAssessments(db, FLICKER_INSTRUMENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rawScore).toBe((8000 + 60000) / 2);
    expect(JSON.parse(rows[0]!.payload!).metrics.falseTaps).toBe(1);
  });

  it('refuses to write a flicker run with no trials', () => {
    expect(recordFlickerRun(db, { metrics: scoreFlicker([]), trials: [], timing })).toBeNull();
    expect(listAssessments(db, FLICKER_INSTRUMENT)).toHaveLength(0);
  });
});

describe('attention Elo', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('writes no Elo until an attention task has been run', () => {
    expect(reseedAttentionElo(db)).toBeNull();
    expect(getAbility(db, ATTENTION_MODULE)).toBeUndefined();
    expect(listAbilityHistory(db, ATTENTION_MODULE)).toHaveLength(0);
  });

  it('seeds the module Elo from a single completed task', () => {
    const trials = pvtTrials([250, 260]);
    const recorded = recordPvtRun(db, { metrics: scorePvt(trials), trials, timing });
    expect(recorded!.elo).not.toBeNull();
    expect(getAbility(db, ATTENTION_MODULE)!.elo).toBeCloseTo(recorded!.elo!, 10);
  });

  it('appends to the ability history on every run, never overwriting it', () => {
    const fast = pvtTrials([250, 260]);
    recordPvtRun(db, { metrics: scorePvt(fast), trials: fast, timing });
    const slow = pvtTrials([700, 800]);
    recordPvtRun(db, { metrics: scorePvt(slow), trials: slow, timing });

    const history = listAbilityHistory(db, ATTENTION_MODULE);
    expect(history).toHaveLength(2);
    expect(history[1]!.elo).toBeLessThan(history[0]!.elo); // the slower run scored lower
  });

  it('recomputes from the latest row of each instrument as tasks are added', () => {
    const trials = pvtTrials([250, 260]);
    const afterPvt = recordPvtRun(db, { metrics: scorePvt(trials), trials, timing })!.elo!;
    const afterCpt = recordCptRun(db, {
      metrics: scoreCpt(cptTrials),
      trials: cptTrials,
      timing,
    })!.elo!;
    expect(afterCpt).not.toBeCloseTo(afterPvt, 6);
    expect(listAbilityHistory(db, ATTENTION_MODULE)).toHaveLength(2);
  });

  it('leaves the memory module untouched', () => {
    const trials = pvtTrials([250, 260]);
    recordPvtRun(db, { metrics: scorePvt(trials), trials, timing });
    expect(getAbility(db, 'memory')).toBeUndefined();
  });
});

describe('raw-score readers', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('report nothing for an instrument that has never run', () => {
    expect(latestRawScore(db, PVT_INSTRUMENT)).toBeNull();
    expect(rawScoreSamples(db, PVT_INSTRUMENT)).toEqual([]);
  });

  it('return the most recent score and the full accumulated sample', () => {
    const first = pvtTrials([500]);
    recordPvtRun(db, { metrics: scorePvt(first), trials: first, timing }, new Date(1000));
    const second = pvtTrials([250]);
    recordPvtRun(db, { metrics: scorePvt(second), trials: second, timing }, new Date(2000));

    expect(latestRawScore(db, PVT_INSTRUMENT)).toBeCloseTo(4, 10); // 1000/250
    expect(rawScoreSamples(db, PVT_INSTRUMENT).sort()).toEqual([2, 4]);
  });
});
