import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { listReviewsByCard, recordReview } from './reviews';
import { listPaoEntries, paoStatus, upsertPaoEntry } from './pao';

describe('PAO entries', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('stores an entry as a card addressable by its 2-digit label', () => {
    const card = upsertPaoEntry(db, { n: 7, person: 'Bond', action: 'shooting', object: 'pistol' });
    expect(card.front).toBe('07');
    expect(card.back).toBe('Bond · shooting · pistol');
    expect(listPaoEntries(db)).toEqual([
      { n: 7, person: 'Bond', action: 'shooting', object: 'pistol' },
    ]);
  });

  it('overwrites in place on re-author, keeping one card and its history', () => {
    const first = upsertPaoEntry(db, { n: 7, person: 'Bond', action: 'x', object: 'y' });
    recordReview(db, { cardId: first.id, module: 'pao', rating: 'good' });
    const second = upsertPaoEntry(db, {
      n: 7,
      person: 'Bourne',
      action: 'running',
      object: 'passport',
    });
    expect(second.id).toBe(first.id); // same card
    expect(listPaoEntries(db)).toHaveLength(1);
    expect(listPaoEntries(db)[0]!.person).toBe('Bourne');
    expect(listReviewsByCard(db, first.id)).toHaveLength(1); // history survives
  });

  it('reports completeness: missing numbers and duplicates-free full list', () => {
    upsertPaoEntry(db, { n: 0, person: 'a', action: 'a', object: 'a' });
    upsertPaoEntry(db, { n: 1, person: 'b', action: 'b', object: 'b' });
    const status = paoStatus(db);
    expect(status.complete).toBe(false);
    expect(status.count).toBe(2);
    expect(status.missing).toHaveLength(98);
    expect(status.missing[0]).toBe(2);
  });
});

describe('recordReview orchestrator', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('advances FSRS, moves module Elo, and appends exactly one review_log row', () => {
    const card = upsertPaoEntry(db, { n: 42, person: 'p', action: 'a', object: 'o' });
    const graded = recordReview(db, {
      cardId: card.id,
      module: 'pao',
      rating: 'good',
      elapsedMs: 900,
    });
    const log = listReviewsByCard(db, card.id);
    expect(log).toHaveLength(1);
    expect(log[0]!.rating).toBe('good');
    expect(log[0]!.elapsedMs).toBe(900);
    // Second review sees the advanced state and higher rated-item count.
    const graded2 = recordReview(db, { cardId: card.id, module: 'pao', rating: 'good' });
    expect(listReviewsByCard(db, card.id)).toHaveLength(2);
    expect(graded2.nextModuleElo).not.toBe(graded.nextModuleElo);
  });

  it('throws for a card with no FSRS state', () => {
    expect(() => recordReview(db, { cardId: 'nope', module: 'pao', rating: 'good' })).toThrow(
      /no FSRS state/,
    );
  });
});
