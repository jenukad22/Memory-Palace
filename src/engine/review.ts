/**
 * Pure review grade (modules/memory/SPEC.md §2) — the single place the FSRS
 * advance, the module-Elo update, and the review_log values are computed
 * together. Framework- and DB-free so the scientifically-sensitive math is unit
 * tested without persistence; `db/queries` wraps this and writes the three
 * tables in one transaction.
 */

import { ELO_MAX, ELO_MIN, provisionalK } from './assessment';
import { update as eloUpdate } from './elo';
import {
  getRetrievability,
  schedule,
  type CardState,
  type ReviewRating,
  type SchedulerConfig,
} from './fsrs';

/** FSRS difficulty is in [1, 10]; map it linearly onto the Elo band as the opponent. */
export function itemEloFromDifficulty(difficulty: number): number {
  const clamped = Math.min(10, Math.max(1, difficulty));
  return ELO_MIN + ((clamped - 1) / 9) * (ELO_MAX - ELO_MIN);
}

/** A successful retrieval is any grade above "again"; "again" is a miss. */
export function isRecalled(rating: ReviewRating): boolean {
  return rating !== 'again';
}

export interface GradeReviewInput {
  cardState: CardState;
  /** Current module ability Elo (ability_ratings.elo). */
  moduleElo: number;
  /** How many items this module has already rated — drives the provisional K schedule. */
  ratedItemCount: number;
  rating: ReviewRating;
  now: Date;
  elapsedMs: number;
  config?: SchedulerConfig;
}

/** Values for one review_log row (mirrors db/schema.ts reviewLog columns). */
export interface ReviewLogValues {
  rating: ReviewRating;
  elapsedMs: number;
  difficulty: number;
  stability: number;
  retrievability: number;
}

export interface GradedReview {
  nextCardState: CardState;
  nextModuleElo: number;
  /** Recall probability at the moment of review (pre-advance). */
  retrievability: number;
  log: ReviewLogValues;
}

/**
 * Grade one review. Composes the FSRS advance, the retrievability at review
 * time, and the module-Elo update (opponent = Elo of the card's current FSRS
 * difficulty). The log records the resulting difficulty/stability and the
 * pre-review retrievability — the recall probability the review actually tested.
 */
export function gradeReview(input: GradeReviewInput): GradedReview {
  const { cardState, moduleElo, ratedItemCount, rating, now, elapsedMs, config } = input;

  const retrievability = getRetrievability(cardState, now, config);
  const nextCardState = schedule(cardState, rating, now, config);

  const itemElo = itemEloFromDifficulty(cardState.difficulty);
  const { user: nextModuleElo } = eloUpdate(moduleElo, itemElo, isRecalled(rating), {
    kFactor: provisionalK(ratedItemCount),
  });

  return {
    nextCardState,
    nextModuleElo,
    retrievability,
    log: {
      rating,
      elapsedMs,
      difficulty: nextCardState.difficulty,
      stability: nextCardState.stability,
      retrievability,
    },
  };
}
