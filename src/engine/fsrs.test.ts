import { describe, expect, it } from 'vitest';
import {
  createEmptyCardState,
  getRetrievability,
  schedule,
  type CardState,
  type ReviewRating,
} from './fsrs';

const NOW = new Date('2026-07-18T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const RATINGS: ReviewRating[] = ['again', 'hard', 'good', 'easy'];

/** Drive a fresh card into the long-term review phase with three spaced 'good' reviews. */
function matureCard(): { card: CardState; now: Date } {
  let card = schedule(createEmptyCardState(NOW), 'good', NOW);
  let now = card.due;
  card = schedule(card, 'good', now);
  now = card.due;
  card = schedule(card, 'good', now);
  return { card, now };
}

describe('createEmptyCardState', () => {
  it('creates an unreviewed card due immediately', () => {
    const card = createEmptyCardState(NOW);
    expect(card.phase).toBe('new');
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.due.getTime()).toBe(NOW.getTime());
    expect(card.lastReview).toBeNull();
  });
});

describe('schedule: first-ever review', () => {
  it('moves the card out of the new phase and records the review', () => {
    const next = schedule(createEmptyCardState(NOW), 'good', NOW);
    expect(next.phase).not.toBe('new');
    expect(next.reps).toBe(1);
    expect(next.lastReview?.getTime()).toBe(NOW.getTime());
  });

  it('produces positive stability and a difficulty in FSRS range 1-10', () => {
    for (const rating of RATINGS) {
      const next = schedule(createEmptyCardState(NOW), rating, NOW);
      expect(next.stability).toBeGreaterThan(0);
      expect(next.difficulty).toBeGreaterThanOrEqual(1);
      expect(next.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('schedules the next due date strictly after the review time', () => {
    for (const rating of RATINGS) {
      const next = schedule(createEmptyCardState(NOW), rating, NOW);
      expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('does not count a first failed review as a lapse', () => {
    const next = schedule(createEmptyCardState(NOW), 'again', NOW);
    expect(next.lapses).toBe(0);
  });
});

describe('schedule: rating boundaries', () => {
  it('orders due dates monotonically: again <= hard <= good <= easy', () => {
    const dueFor = (rating: ReviewRating) =>
      schedule(createEmptyCardState(NOW), rating, NOW).due.getTime();
    expect(dueFor('hard')).toBeGreaterThanOrEqual(dueFor('again'));
    expect(dueFor('good')).toBeGreaterThanOrEqual(dueFor('hard'));
    expect(dueFor('easy')).toBeGreaterThanOrEqual(dueFor('good'));
    expect(dueFor('easy')).toBeGreaterThan(dueFor('again'));
  });

  it('orders due dates for a mature review card too', () => {
    const { card, now } = matureCard();
    const dueFor = (rating: ReviewRating) => schedule(card, rating, now).due.getTime();
    expect(dueFor('hard')).toBeGreaterThanOrEqual(dueFor('again'));
    expect(dueFor('good')).toBeGreaterThanOrEqual(dueFor('hard'));
    expect(dueFor('easy')).toBeGreaterThanOrEqual(dueFor('good'));
    expect(dueFor('easy')).toBeGreaterThan(dueFor('again'));
  });

  it('gives easy a higher stability than again on the first review', () => {
    const again = schedule(createEmptyCardState(NOW), 'again', NOW);
    const easy = schedule(createEmptyCardState(NOW), 'easy', NOW);
    expect(easy.stability).toBeGreaterThan(again.stability);
  });
});

describe('schedule: lapses', () => {
  it('counts a lapse and drops stability when a review card is failed', () => {
    const { card, now } = matureCard();
    expect(card.phase).toBe('review');
    const lapsed = schedule(card, 'again', now);
    expect(lapsed.lapses).toBe(card.lapses + 1);
    expect(lapsed.phase).toBe('relearning');
    expect(lapsed.stability).toBeLessThan(card.stability);
  });

  it('does not count successful reviews as lapses', () => {
    const { card, now } = matureCard();
    const next = schedule(card, 'good', now);
    expect(next.lapses).toBe(card.lapses);
  });
});

describe('schedule: purity and determinism', () => {
  it('returns identical results for identical inputs', () => {
    const { card, now } = matureCard();
    const a = schedule(card, 'good', now);
    const b = schedule(card, 'good', now);
    expect(a).toEqual(b);
  });

  it('does not mutate the input card', () => {
    const card = createEmptyCardState(NOW);
    const snapshot = structuredClone(card);
    schedule(card, 'good', NOW);
    expect(card).toEqual(snapshot);
  });
});

describe('retrievability', () => {
  it('is 1 immediately after a review and decays over time', () => {
    const { card, now } = matureCard();
    const justNow = getRetrievability(card, now);
    const later = getRetrievability(card, new Date(now.getTime() + 30 * DAY_MS));
    expect(justNow).toBeCloseTo(1, 2);
    expect(later).toBeLessThan(justNow);
    expect(later).toBeGreaterThanOrEqual(0);
  });

  it('is close to the desired retention (0.90 default) at the due date', () => {
    const { card } = matureCard();
    expect(card.phase).toBe('review');
    const atDue = getRetrievability(card, card.due);
    expect(atDue).toBeGreaterThan(0.8);
    expect(atDue).toBeLessThan(1);
  });
});

describe('desired retention configuration', () => {
  it('schedules a later due date when desired retention is lower', () => {
    const { card, now } = matureCard();
    const strict = schedule(card, 'good', now, { desiredRetention: 0.95 });
    const relaxed = schedule(card, 'good', now, { desiredRetention: 0.7 });
    expect(relaxed.due.getTime()).toBeGreaterThan(strict.due.getTime());
  });

  it('rejects a desired retention outside (0, 1)', () => {
    const card = createEmptyCardState(NOW);
    expect(() => schedule(card, 'good', NOW, { desiredRetention: 0 })).toThrow();
    expect(() => schedule(card, 'good', NOW, { desiredRetention: 1.5 })).toThrow();
  });
});
