import { newId } from './id';
import { createCard, getCard, getFsrsState } from './queries/cards';
import { appendReview, listReviewsByCard } from './queries/reviews';
import type { Db } from './types';

export interface SelfTestResult {
  ok: boolean;
  steps: { name: string; ok: boolean }[];
}

/**
 * Exercises migrate -> insert -> read -> append against the live db.
 * Wire to a dev-screen button to smoke-test the native driver on a simulator.
 * NOTE: writes a real (append-only) selftest card + review; these rows persist.
 */
export function runDbSelfTest(db: Db): SelfTestResult {
  const steps: { name: string; ok: boolean }[] = [];
  const id = `selftest-${newId()}`;

  createCard(db, { id, module: 'selftest', front: 'q', back: 'a' });
  steps.push({ name: 'create card', ok: getCard(db, id)?.id === id });
  steps.push({ name: 'initial fsrs_state', ok: getFsrsState(db, id)?.phase === 'new' });

  appendReview(db, {
    cardId: id,
    rating: 'good',
    elapsedMs: 1200,
    difficulty: 5,
    stability: 1,
    retrievability: 0.9,
  });
  steps.push({ name: 'append review', ok: listReviewsByCard(db, id).length === 1 });

  return { ok: steps.every((s) => s.ok), steps };
}
