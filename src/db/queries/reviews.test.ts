import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyCardState, schedule, type ReviewRating } from '@/engine';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { createCard } from './cards';
import {
  appendReview,
  listReviewsByCard,
  listReviewsSince,
  moduleReviewStatsSince,
} from './reviews';

const RATINGS: ReviewRating[] = ['again', 'hard', 'good', 'easy'];

describe('review queries', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
    createCard(db, { id: 'c1', module: 'memory', front: 'f', back: 'b' });
  });

  it('appends and reads back a review row', () => {
    const row = appendReview(db, {
      cardId: 'c1',
      rating: 'good',
      elapsedMs: 1200,
      difficulty: 5,
      stability: 1.5,
      retrievability: 0.92,
      ts: new Date('2026-07-18T00:00:00.000Z'),
    });
    expect(listReviewsByCard(db, 'c1')).toEqual([row]);
  });

  it('stores and reads back every ReviewRating literal', () => {
    for (const rating of RATINGS) {
      appendReview(db, {
        cardId: 'c1',
        rating,
        elapsedMs: 1,
        difficulty: 5,
        stability: 1,
        retrievability: 0.9,
      });
    }
    const stored = listReviewsByCard(db, 'c1').map((r) => r.rating);
    expect(new Set(stored)).toEqual(new Set(RATINGS));
  });

  it('maps ratings to distinct, ordered FSRS grades (again < easy)', () => {
    // Proves the text->Grade mapping in fsrs.ts is complete and correctly ordered:
    // a corrupt/off-by-one map would break this ordering or collapse a value.
    const now = new Date('2026-07-18T00:00:00.000Z');
    const base = createEmptyCardState(now);
    const dueByRating = RATINGS.map((r) => schedule(base, r, now).due.getTime());
    expect(dueByRating[0]).toBeLessThan(dueByRating[3]!); // again sooner than easy
    expect(new Set(dueByRating).size).toBe(RATINGS.length); // all four distinct
  });

  it('lists reviews since a timestamp, newest first', () => {
    appendReview(db, {
      cardId: 'c1',
      rating: 'good',
      elapsedMs: 1,
      difficulty: 5,
      stability: 1,
      retrievability: 0.9,
      ts: new Date('2026-07-10T00:00:00Z'),
    });
    appendReview(db, {
      cardId: 'c1',
      rating: 'easy',
      elapsedMs: 1,
      difficulty: 5,
      stability: 1,
      retrievability: 0.9,
      ts: new Date('2026-07-20T00:00:00Z'),
    });
    const since = listReviewsSince(db, new Date('2026-07-15T00:00:00Z'));
    expect(since.map((r) => r.rating)).toEqual(['easy']);
  });

  it("moduleReviewStatsSince counts a module's reviews and hits since a timestamp", () => {
    createCard(db, { id: 'other', module: 'pao', front: 'f', back: 'b' });
    const base = { elapsedMs: 1, difficulty: 5, stability: 1, retrievability: 0.9 };
    appendReview(db, {
      cardId: 'c1',
      rating: 'good',
      ts: new Date('2026-07-10T00:00:00Z'),
      ...base,
    });
    appendReview(db, {
      cardId: 'c1',
      rating: 'again',
      ts: new Date('2026-07-20T00:00:00Z'),
      ...base,
    });
    appendReview(db, {
      cardId: 'c1',
      rating: 'easy',
      ts: new Date('2026-07-21T00:00:00Z'),
      ...base,
    });
    appendReview(db, {
      cardId: 'other',
      rating: 'good',
      ts: new Date('2026-07-21T00:00:00Z'),
      ...base,
    });

    const stats = moduleReviewStatsSince(db, 'memory', new Date('2026-07-15T00:00:00Z'));
    expect(stats).toEqual({ count: 2, hits: 1 });
  });
});
