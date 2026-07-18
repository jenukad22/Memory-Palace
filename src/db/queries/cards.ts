import { and, eq } from 'drizzle-orm';
import { createEmptyCardState, type CardState } from '@/engine';
import { newId } from '../id';
import { cards, fsrsState, type CardRow } from '../schema';
import type { Db } from '../types';

export interface NewCardInput {
  module: string;
  front: string;
  back: string;
  payload?: unknown;
  id?: string;
  now?: Date;
}

export function createCard(db: Db, input: NewCardInput): CardRow {
  const id = input.id ?? newId();
  const now = input.now ?? new Date();
  const row: CardRow = {
    id,
    module: input.module,
    front: input.front,
    back: input.back,
    payload: input.payload === undefined ? null : JSON.stringify(input.payload),
    createdAt: now,
    isSynced: false,
    isDeleted: false,
  };
  const state = createEmptyCardState(now);
  db.transaction((tx) => {
    tx.insert(cards).values(row).run();
    tx.insert(fsrsState)
      .values({ cardId: id, ...state })
      .run();
  });
  return row;
}

export function getCard(db: Db, id: string): CardRow | undefined {
  return db.select().from(cards).where(eq(cards.id, id)).get();
}

export function listCardsByModule(db: Db, module: string): CardRow[] {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.module, module), eq(cards.isDeleted, false)))
    .all();
}

export function softDeleteCard(db: Db, id: string): void {
  db.update(cards).set({ isDeleted: true }).where(eq(cards.id, id)).run();
}

// Explicit field-by-field maps document the CardState parity (see schema.ts / fsrs.ts).
export function getFsrsState(db: Db, cardId: string): CardState | undefined {
  const row = db.select().from(fsrsState).where(eq(fsrsState.cardId, cardId)).get();
  if (!row) return undefined;
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    phase: row.phase,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    lastReview: row.lastReview,
  };
}

export function upsertFsrsState(db: Db, cardId: string, state: CardState): void {
  db.insert(fsrsState)
    .values({ cardId, ...state })
    .onConflictDoUpdate({ target: fsrsState.cardId, set: { ...state } })
    .run();
}
