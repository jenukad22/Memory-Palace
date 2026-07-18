import { desc, eq, gte } from 'drizzle-orm';
import type { ReviewRating } from '@/engine';
import { newId } from '../id';
import { reviewLog, type ReviewLogRow } from '../schema';
import type { Db } from '../types';

export interface NewReviewInput {
  cardId: string;
  rating: ReviewRating;
  elapsedMs: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  ts?: Date;
  id?: string;
}

// review_log is append-only: this module intentionally exposes no update/delete.
export function appendReview(db: Db, input: NewReviewInput): ReviewLogRow {
  const row: ReviewLogRow = {
    id: input.id ?? newId(),
    cardId: input.cardId,
    ts: input.ts ?? new Date(),
    rating: input.rating,
    elapsedMs: input.elapsedMs,
    difficulty: input.difficulty,
    stability: input.stability,
    retrievability: input.retrievability,
  };
  db.insert(reviewLog).values(row).run();
  return row;
}

export function listReviewsByCard(db: Db, cardId: string): ReviewLogRow[] {
  return db
    .select()
    .from(reviewLog)
    .where(eq(reviewLog.cardId, cardId))
    .orderBy(reviewLog.ts)
    .all();
}

export function listReviewsSince(db: Db, since: Date): ReviewLogRow[] {
  return db
    .select()
    .from(reviewLog)
    .where(gte(reviewLog.ts, since))
    .orderBy(desc(reviewLog.ts))
    .all();
}
