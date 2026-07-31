import { describe, expect, it } from 'vitest';
import { scoreDisconfirmationRun } from './disconfirmation';

describe('scoreDisconfirmationRun', () => {
  it('returns null mean, not NaN, for an empty run', () => {
    const m = scoreDisconfirmationRun([]);
    expect(m.trials).toBe(0);
    expect(m.meanSelfScore).toBeNull();
    expect(m.rated).toBe(0);
    expect(m.skipped).toBe(0);
  });

  it('excludes skipped prompts from the mean but counts them', () => {
    const m = scoreDisconfirmationRun(['yes', 'skipped', 'skipped']);
    expect(m.trials).toBe(3);
    expect(m.skipped).toBe(2);
    expect(m.rated).toBe(1);
    expect(m.meanSelfScore).toBe(1);
  });

  it('does not let all-skipped read the same as all-rated-no', () => {
    const allSkipped = scoreDisconfirmationRun(['skipped', 'skipped']);
    const allNo = scoreDisconfirmationRun(['no', 'no']);
    expect(allSkipped.meanSelfScore).toBeNull();
    expect(allNo.meanSelfScore).toBe(0);
    expect(allSkipped.meanSelfScore).not.toBe(allNo.meanSelfScore);
  });

  it('maps the three ratings to 0 / 0.5 / 1', () => {
    const m = scoreDisconfirmationRun(['no', 'partial', 'yes']);
    expect(m.meanSelfScore).toBeCloseTo(0.5, 10);
    expect(m.noCount).toBe(1);
    expect(m.partialCount).toBe(1);
    expect(m.yesCount).toBe(1);
  });

  it('averages a run of all the same rating', () => {
    expect(scoreDisconfirmationRun(['yes', 'yes', 'yes']).meanSelfScore).toBe(1);
    expect(scoreDisconfirmationRun(['partial', 'partial']).meanSelfScore).toBe(0.5);
  });

  it('counts trials including skipped ones', () => {
    const m = scoreDisconfirmationRun(['yes', 'no', 'skipped', 'partial']);
    expect(m.trials).toBe(4);
    expect(m.rated).toBe(3);
  });
});
