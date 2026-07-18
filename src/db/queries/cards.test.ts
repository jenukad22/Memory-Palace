import { beforeEach, describe, expect, it } from 'vitest';
import type { CardState } from '@/engine';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import {
  createCard,
  getCard,
  getFsrsState,
  listCardsByModule,
  softDeleteCard,
  upsertFsrsState,
} from './cards';

describe('card queries', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('creates a card with an initial "new" fsrs_state in one transaction', () => {
    const now = new Date('2026-07-18T00:00:00.000Z');
    const card = createCard(db, { id: 'c1', module: 'memory', front: 'f', back: 'b', now });
    expect(getCard(db, 'c1')).toEqual(card);
    expect(getFsrsState(db, 'c1')?.phase).toBe('new');
  });

  it('serializes payload to JSON', () => {
    createCard(db, { id: 'c2', module: 'memory', front: 'f', back: 'b', payload: { a: 1 } });
    expect(getCard(db, 'c2')?.payload).toBe('{"a":1}');
  });

  it('lists only non-deleted cards for a module', () => {
    createCard(db, { id: 'a', module: 'memory', front: 'f', back: 'b' });
    createCard(db, { id: 'b', module: 'memory', front: 'f', back: 'b' });
    createCard(db, { id: 'c', module: 'attention', front: 'f', back: 'b' });
    softDeleteCard(db, 'b');
    expect(listCardsByModule(db, 'memory').map((c) => c.id)).toEqual(['a']);
  });

  it('round-trips a full CardState losslessly', () => {
    createCard(db, { id: 'rt', module: 'memory', front: 'f', back: 'b' });
    const state: CardState = {
      due: new Date('2026-08-01T12:00:00.000Z'),
      stability: 12.34,
      difficulty: 5.67,
      reps: 9,
      lapses: 3,
      phase: 'review',
      scheduledDays: 21,
      learningSteps: 2,
      lastReview: new Date('2026-07-20T08:30:00.000Z'),
    };
    upsertFsrsState(db, 'rt', state);
    expect(getFsrsState(db, 'rt')).toEqual(state);
  });

  it('round-trips a CardState with lastReview = null', () => {
    createCard(db, { id: 'rn', module: 'memory', front: 'f', back: 'b' });
    const state: CardState = {
      due: new Date('2026-08-01T00:00:00.000Z'),
      stability: 1,
      difficulty: 2,
      reps: 0,
      lapses: 0,
      phase: 'new',
      scheduledDays: 0,
      learningSteps: 0,
      lastReview: null,
    };
    upsertFsrsState(db, 'rn', state);
    expect(getFsrsState(db, 'rn')).toEqual(state);
  });
});
