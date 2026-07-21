import { and, asc, eq, lte } from 'drizzle-orm';
import type { CardPhase } from '@/engine';
import { cards, fsrsState } from '../schema';
import type { Db } from '../types';

/**
 * How many "new" (never-reviewed) cards a single daily-review session admits,
 * regardless of module (Anki-style). Review-phase cards are never capped: a
 * backlog of due reviews must never be crowded out by an unbounded pile of
 * freshly authored cards.
 */
export const NEW_CARDS_PER_SESSION = 20;

export interface DueCard {
  cardId: string;
  module: string;
  front: string;
  back: string;
  phase: CardPhase;
  due: Date;
}

/**
 * Every card due for review at `now`, across every module — the cross-cutting
 * daily-review queue, as opposed to the module-specific drills that generate
 * fresh material. Review-phase cards (learning/review/relearning) come first,
 * oldest-due-first and uncapped; new-phase cards follow, oldest-due-first,
 * capped at `newCardLimit`.
 */
export function listDueCards(
  db: Db,
  now: Date = new Date(),
  newCardLimit: number = NEW_CARDS_PER_SESSION,
): DueCard[] {
  const rows = db
    .select({
      cardId: cards.id,
      module: cards.module,
      front: cards.front,
      back: cards.back,
      phase: fsrsState.phase,
      due: fsrsState.due,
    })
    .from(cards)
    .innerJoin(fsrsState, eq(fsrsState.cardId, cards.id))
    .where(and(eq(cards.isDeleted, false), lte(fsrsState.due, now)))
    .orderBy(asc(fsrsState.due))
    .all();

  const review = rows.filter((r) => r.phase !== 'new');
  const fresh = rows.filter((r) => r.phase === 'new').slice(0, newCardLimit);
  return [...review, ...fresh];
}
