import { count, desc, eq, gte } from 'drizzle-orm';
import { ELO_MIDPOINT, gradeReview, type GradedReview, type ReviewRating } from '@/engine';
import { newId } from '../id';
import { cards, reviewLog, type ReviewLogRow } from '../schema';
import type { Db } from '../types';
import { getFsrsState, upsertFsrsState } from './cards';
import { getAbility, upsertAbility } from './ability';

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

/**
 * Recent recall accuracy for a module (fraction of the last `limit` reviews that
 * were not "again"), or null when the module has no history yet. Feeds the
 * difficulty controller (engine/difficulty.ts) for the next session.
 */
export function recentModuleAccuracy(db: Db, module: string, limit = 20): number | null {
  const rows = db
    .select({ rating: reviewLog.rating })
    .from(reviewLog)
    .innerJoin(cards, eq(reviewLog.cardId, cards.id))
    .where(eq(cards.module, module))
    .orderBy(desc(reviewLog.ts))
    .limit(limit)
    .all();
  if (rows.length === 0) return null;
  const hits = rows.filter((r) => r.rating !== 'again').length;
  return hits / rows.length;
}

/** How many reviews a module has logged — drives the provisional-K schedule. */
export function countModuleReviews(db: Db, module: string): number {
  const row = db
    .select({ n: count() })
    .from(reviewLog)
    .innerJoin(cards, eq(reviewLog.cardId, cards.id))
    .where(eq(cards.module, module))
    .get();
  return row?.n ?? 0;
}

export interface RecordReviewInput {
  cardId: string;
  /** The card's module, for the ability-Elo and rated-item count. */
  module: string;
  rating: ReviewRating;
  /** Retrieval latency in ms; defaults to 0 when the drill does not measure it. */
  elapsedMs?: number;
  now?: Date;
}

/**
 * The single write path for a review (SPEC.md §2): read the card's FSRS state +
 * the module's Elo and rated-item count, grade it with the pure engine, then
 * advance FSRS, update the module Elo, and append one review_log row — all in
 * one transaction. A module with no ability row yet starts from the Elo
 * midpoint. Throws if the card has no FSRS state (it was never created).
 */
export function recordReview(db: Db, input: RecordReviewInput): GradedReview {
  const cardState = getFsrsState(db, input.cardId);
  if (!cardState) throw new Error(`no FSRS state for card ${input.cardId}`);
  const now = input.now ?? new Date();
  const moduleElo = getAbility(db, input.module)?.elo ?? ELO_MIDPOINT;
  const ratedItemCount = countModuleReviews(db, input.module);

  const graded = gradeReview({
    cardState,
    moduleElo,
    ratedItemCount,
    rating: input.rating,
    now,
    elapsedMs: input.elapsedMs ?? 0,
  });

  db.transaction((tx) => {
    upsertFsrsState(tx, input.cardId, graded.nextCardState);
    upsertAbility(tx, input.module, graded.nextModuleElo, now);
    appendReview(tx, {
      cardId: input.cardId,
      rating: graded.log.rating,
      elapsedMs: graded.log.elapsedMs,
      difficulty: graded.log.difficulty,
      stability: graded.log.stability,
      retrievability: graded.log.retrievability,
      ts: now,
    });
  });
  return graded;
}
