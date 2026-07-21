import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyCardState, type CardPhase } from '@/engine';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { createCard, softDeleteCard, upsertFsrsState } from './cards';
import { listDueCards, NEW_CARDS_PER_SESSION } from './due';
import { recordReview } from './reviews';

const NOW = new Date('2026-07-21T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

/** Create a card and force its fsrs_state due/phase directly, for scenario setup. */
function makeCard(db: Db, module: string, due: Date, phase: CardPhase, front = 'f'): string {
  const card = createCard(db, { module, front, back: 'b', now: NOW });
  const base = createEmptyCardState(NOW);
  upsertFsrsState(db, card.id, { ...base, due, phase, reps: phase === 'new' ? 0 : 1 });
  return card.id;
}

describe('listDueCards', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('includes only cards due at or before now, across modules', () => {
    const dueNow = makeCard(db, 'pao', NOW, 'review');
    const dueEarlier = makeCard(db, 'memory', new Date(NOW.getTime() - HOUR), 'review');
    const dueLater = makeCard(db, 'pao', new Date(NOW.getTime() + HOUR), 'review');

    const ids = listDueCards(db, NOW).map((c) => c.cardId);
    expect(ids).toContain(dueNow);
    expect(ids).toContain(dueEarlier);
    expect(ids).not.toContain(dueLater);
  });

  it('excludes soft-deleted cards even if due', () => {
    const id = makeCard(db, 'pao', NOW, 'review');
    softDeleteCard(db, id);
    expect(listDueCards(db, NOW).map((c) => c.cardId)).not.toContain(id);
  });

  it('caps new-phase cards at newCardLimit but never caps review-phase cards', () => {
    const reviewIds = Array.from({ length: 3 }, (_, i) =>
      makeCard(db, 'pao', new Date(NOW.getTime() - i * HOUR), 'review'),
    );
    const overflow = NEW_CARDS_PER_SESSION + 5;
    for (let i = 0; i < overflow; i += 1) {
      makeCard(db, 'pao', new Date(NOW.getTime() - i * 1000), 'new');
    }

    const result = listDueCards(db, NOW);
    expect(result).toHaveLength(reviewIds.length + NEW_CARDS_PER_SESSION);
    const gotReviewIds = result.filter((c) => c.phase === 'review').map((c) => c.cardId);
    expect(new Set(gotReviewIds)).toEqual(new Set(reviewIds));
    expect(result.filter((c) => c.phase === 'new')).toHaveLength(NEW_CARDS_PER_SESSION);
  });

  it('respects a custom newCardLimit', () => {
    for (let i = 0; i < 5; i += 1) makeCard(db, 'pao', NOW, 'new');
    expect(listDueCards(db, NOW, 2)).toHaveLength(2);
  });

  it('orders review cards before new cards, each ascending by due', () => {
    const newLater = makeCard(db, 'pao', new Date(NOW.getTime() - 1000), 'new', 'new-later');
    const newEarlier = makeCard(db, 'pao', new Date(NOW.getTime() - 5000), 'new', 'new-earlier');
    const reviewLater = makeCard(
      db,
      'pao',
      new Date(NOW.getTime() - 2000),
      'review',
      'review-later',
    );
    const reviewEarlier = makeCard(
      db,
      'pao',
      new Date(NOW.getTime() - 9000),
      'review',
      'review-earlier',
    );

    const ids = listDueCards(db, NOW).map((c) => c.cardId);
    expect(ids).toEqual([reviewEarlier, reviewLater, newEarlier, newLater]);
  });
});

describe('rate -> reschedule round trip', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('a rated due card drops out of the due list at the same instant', () => {
    const card = createCard(db, { module: 'pao', front: '07', back: 'x', now: NOW });
    expect(listDueCards(db, NOW).map((c) => c.cardId)).toContain(card.id);

    recordReview(db, { cardId: card.id, module: 'pao', rating: 'good', now: NOW });

    expect(listDueCards(db, NOW).map((c) => c.cardId)).not.toContain(card.id);
  });

  it('advances the card out of the new phase after its first rating', () => {
    const card = createCard(db, { module: 'memory', front: 'f', back: 'b', now: NOW });
    const [before] = listDueCards(db, NOW);
    expect(before?.phase).toBe('new');

    recordReview(db, { cardId: card.id, module: 'memory', rating: 'good', now: NOW });

    // The card is now scheduled in the future; confirm via a later "now" that it reappears
    // out of the new phase rather than vanishing entirely.
    const future = new Date(NOW.getTime() + 365 * 24 * HOUR);
    const [after] = listDueCards(db, future).filter((c) => c.cardId === card.id);
    expect(after?.phase).not.toBe('new');
  });
});
