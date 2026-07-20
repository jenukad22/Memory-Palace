import { describe, expect, it } from 'vitest';
import { ELO_MAX, ELO_MIN, K_PROVISIONAL, PROVISIONAL_ITEMS } from './assessment';
import { DEFAULT_K_FACTOR } from './elo';
import { createEmptyCardState, schedule } from './fsrs';
import { gradeReview, isRecalled, itemEloFromDifficulty } from './review';

const NOW = new Date('2026-07-20T00:00:00.000Z');

describe('itemEloFromDifficulty', () => {
  it('maps the FSRS difficulty band [1,10] onto the Elo band', () => {
    expect(itemEloFromDifficulty(1)).toBe(ELO_MIN);
    expect(itemEloFromDifficulty(10)).toBe(ELO_MAX);
    expect(itemEloFromDifficulty(5.5)).toBeCloseTo((ELO_MIN + ELO_MAX) / 2, 5);
  });

  it('clamps out-of-band difficulty', () => {
    expect(itemEloFromDifficulty(0)).toBe(ELO_MIN);
    expect(itemEloFromDifficulty(99)).toBe(ELO_MAX);
  });
});

describe('isRecalled', () => {
  it('treats every grade above "again" as a successful retrieval', () => {
    expect(isRecalled('again')).toBe(false);
    expect(isRecalled('hard')).toBe(true);
    expect(isRecalled('good')).toBe(true);
    expect(isRecalled('easy')).toBe(true);
  });
});

describe('gradeReview', () => {
  const base = () => ({
    cardState: createEmptyCardState(NOW),
    moduleElo: 1200,
    ratedItemCount: 0,
    now: NOW,
    elapsedMs: 1500,
  });

  it('advances FSRS exactly as schedule() would', () => {
    const input = { ...base(), rating: 'good' as const };
    const graded = gradeReview(input);
    expect(graded.nextCardState).toEqual(schedule(input.cardState, 'good', NOW));
  });

  it('raises module Elo on a hit and lowers it on a miss', () => {
    const hit = gradeReview({ ...base(), rating: 'good' });
    const miss = gradeReview({ ...base(), rating: 'again' });
    expect(hit.nextModuleElo).toBeGreaterThan(1200);
    expect(miss.nextModuleElo).toBeLessThan(1200);
  });

  it('applies the higher provisional K early, then the stable K', () => {
    // Same review, same card — only the module's rated-item count differs. The
    // early move must be larger, in exactly the K_PROVISIONAL : DEFAULT ratio.
    const reviewed = schedule(createEmptyCardState(NOW), 'good', NOW);
    const grade = (ratedItemCount: number) =>
      gradeReview({
        cardState: reviewed,
        moduleElo: 1200,
        ratedItemCount,
        rating: 'good',
        now: new Date(NOW.getTime() + 60_000),
        elapsedMs: 10,
      }).nextModuleElo - 1200;

    const early = grade(PROVISIONAL_ITEMS - 1);
    const stable = grade(PROVISIONAL_ITEMS);
    expect(early).toBeGreaterThan(stable);
    expect(early / stable).toBeCloseTo(K_PROVISIONAL / DEFAULT_K_FACTOR, 6);
  });

  it('logs the post-review difficulty/stability and the pre-review retrievability', () => {
    const input = { ...base(), rating: 'good' as const };
    const graded = gradeReview(input);
    expect(graded.log.rating).toBe('good');
    expect(graded.log.elapsedMs).toBe(1500);
    expect(graded.log.difficulty).toBe(graded.nextCardState.difficulty);
    expect(graded.log.stability).toBe(graded.nextCardState.stability);
    expect(graded.log.retrievability).toBe(graded.retrievability);
    expect(graded.retrievability).toBeGreaterThanOrEqual(0);
    expect(graded.retrievability).toBeLessThanOrEqual(1);
  });
});
