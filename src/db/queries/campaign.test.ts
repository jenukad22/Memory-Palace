import { beforeEach, describe, expect, it } from 'vitest';
import { MIN_LOCI_TO_START, MIN_REVIEWS_PER_CAMPAIGN_DAY } from '@/engine';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { addLocus, createPalace } from './palaces';
import { insertAssessment } from './assessments';
import { createCard } from './cards';
import { recordReview } from './reviews';
import {
  bestPalaceForCampaign,
  canFinishToday,
  countCampaignDaysCompleted,
  finishCampaignDay,
  FREE_RECALL_POSTTEST_INSTRUMENT,
  FREE_RECALL_PRETEST_INSTRUMENT,
  getFreeRecallPosttest,
  getFreeRecallPretest,
  hasCampaignSessionToday,
  isSetupReady,
} from './campaign';

const NOW = new Date('2026-07-21T12:00:00.000Z');

function addLociCount(db: Db, palaceId: string, n: number): void {
  for (let i = 0; i < n; i += 1) addLocus(db, { palaceId, label: `stop ${i}` });
}

function logReviews(db: Db, count: number, hits: number, now: Date = NOW): void {
  for (let i = 0; i < count; i += 1) {
    const card = createCard(db, { module: 'memory', front: 'f', back: 'b', now });
    recordReview(db, {
      cardId: card.id,
      module: 'memory',
      rating: i < hits ? 'good' : 'again',
      now,
    });
  }
}

describe('bestPalaceForCampaign / isSetupReady', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('is null / not ready with no palaces', () => {
    expect(bestPalaceForCampaign(db)).toBeNull();
    expect(isSetupReady(db)).toBe(false);
  });

  it('picks the palace with the most loci across several palaces', () => {
    const small = createPalace(db, { name: 'Small' });
    addLociCount(db, small.id, 3);
    const big = createPalace(db, { name: 'Big' });
    addLociCount(db, big.id, MIN_LOCI_TO_START);

    const best = bestPalaceForCampaign(db);
    expect(best?.palace.id).toBe(big.id);
    expect(best?.lociCount).toBe(MIN_LOCI_TO_START);
  });

  it('is ready only once the best palace reaches MIN_LOCI_TO_START', () => {
    const palace = createPalace(db, { name: 'P' });
    addLociCount(db, palace.id, MIN_LOCI_TO_START - 1);
    expect(isSetupReady(db)).toBe(false);
    addLocus(db, { palaceId: palace.id, label: 'one more' });
    expect(isSetupReady(db)).toBe(true);
  });
});

describe('campaign day tracking', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('starts with zero days completed and no session recorded today', () => {
    expect(countCampaignDaysCompleted(db)).toBe(0);
    expect(hasCampaignSessionToday(db, NOW)).toBe(false);
  });

  it('canFinishToday is false below the review threshold', () => {
    logReviews(db, MIN_REVIEWS_PER_CAMPAIGN_DAY - 1, MIN_REVIEWS_PER_CAMPAIGN_DAY - 1);
    expect(canFinishToday(db, NOW)).toBe(false);
  });

  it('finishCampaignDay throws below threshold, and records items/accuracy once eligible', () => {
    expect(() => finishCampaignDay(db, NOW)).toThrow();

    logReviews(db, MIN_REVIEWS_PER_CAMPAIGN_DAY, MIN_REVIEWS_PER_CAMPAIGN_DAY - 3);
    expect(canFinishToday(db, NOW)).toBe(true);

    finishCampaignDay(db, NOW);
    expect(countCampaignDaysCompleted(db)).toBe(1);
    expect(hasCampaignSessionToday(db, NOW)).toBe(true);
  });

  it('allows only one campaign day per calendar day', () => {
    logReviews(db, MIN_REVIEWS_PER_CAMPAIGN_DAY, MIN_REVIEWS_PER_CAMPAIGN_DAY);
    finishCampaignDay(db, NOW);
    expect(canFinishToday(db, NOW)).toBe(false);
    expect(() => finishCampaignDay(db, NOW)).toThrow();

    // A later calendar day, with fresh reviews, is eligible again.
    const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    logReviews(db, MIN_REVIEWS_PER_CAMPAIGN_DAY, MIN_REVIEWS_PER_CAMPAIGN_DAY, nextDay);
    expect(canFinishToday(db, nextDay)).toBe(true);
    finishCampaignDay(db, nextDay);
    expect(countCampaignDaysCompleted(db)).toBe(2);
  });
});

describe('free-recall pretest/posttest lookup', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('is undefined before either test is taken', () => {
    expect(getFreeRecallPretest(db)).toBeUndefined();
    expect(getFreeRecallPosttest(db)).toBeUndefined();
  });

  it('reads back the latest row per instrument', () => {
    insertAssessment(db, { instrument: FREE_RECALL_PRETEST_INSTRUMENT, rawScore: 18 });
    insertAssessment(db, { instrument: FREE_RECALL_POSTTEST_INSTRUMENT, rawScore: 31 });
    expect(getFreeRecallPretest(db)?.rawScore).toBe(18);
    expect(getFreeRecallPosttest(db)?.rawScore).toBe(31);
  });
});
