import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    module: text('module').notNull(),
    front: text('front').notNull(),
    back: text('back').notNull(),
    payload: text('payload'), // JSON string, nullable
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('cards_module_is_deleted_idx').on(t.module, t.isDeleted)],
);

// 1:1 with cards. Property names MUST equal CardState keys (see fsrs.ts) so a
// row spreads into a CardState with no mapping. Enum column is `phase`, not `state`.
export const fsrsState = sqliteTable(
  'fsrs_state',
  {
    cardId: text('card_id')
      .primaryKey()
      .references(() => cards.id),
    due: integer('due', { mode: 'timestamp_ms' }).notNull(),
    stability: real('stability').notNull(),
    difficulty: real('difficulty').notNull(),
    reps: integer('reps').notNull(),
    lapses: integer('lapses').notNull(),
    phase: text('phase', { enum: ['new', 'learning', 'review', 'relearning'] }).notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    lastReview: integer('last_review', { mode: 'timestamp_ms' }),
  },
  (t) => [index('fsrs_state_due_idx').on(t.due)],
);

export const reviewLog = sqliteTable(
  'review_log',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id),
    ts: integer('ts', { mode: 'timestamp_ms' }).notNull(),
    rating: text('rating', { enum: ['again', 'hard', 'good', 'easy'] }).notNull(),
    elapsedMs: integer('elapsed_ms').notNull(),
    difficulty: real('difficulty').notNull(),
    stability: real('stability').notNull(),
    retrievability: real('retrievability').notNull(),
  },
  (t) => [index('review_log_card_id_idx').on(t.cardId), index('review_log_ts_idx').on(t.ts)],
);

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  instrument: text('instrument').notNull(),
  rawScore: real('raw_score').notNull(),
  normalized: real('normalized'), // within-instrument only; nullable
  payload: text('payload'), // JSON string, nullable — per-trial detail (SPEC.md sec 12)
  ts: integer('ts', { mode: 'timestamp_ms' }).notNull(),
});

export const abilityRatings = sqliteTable('ability_ratings', {
  module: text('module').primaryKey(),
  elo: real('elo').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  started: integer('started', { mode: 'timestamp_ms' }).notNull(),
  ended: integer('ended', { mode: 'timestamp_ms' }),
  module: text('module').notNull(),
  items: integer('items').notNull().default(0),
  accuracy: real('accuracy').notNull().default(0),
});

// Structural scaffolding for the memory-palace trainer (modules/memory/SPEC.md).
// Palaces/loci carry no FSRS/Elo/review history — those live on the placement
// `cards` that reference a locus. Palaces soft-delete like cards; loci hard-
// delete with position compaction, so the FK is never cascaded.
export const palaces = sqliteTable('palaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

// Ordered stops on a route. Ordering is DB-enforced: positions are contiguous
// from 0 and UNIQUE within a palace — never array order in JSON.
export const loci = sqliteTable(
  'loci',
  {
    id: text('id').primaryKey(),
    palaceId: text('palace_id')
      .notNull()
      .references(() => palaces.id),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    cue: text('cue'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('loci_palace_id_idx').on(t.palaceId),
    unique('loci_palace_position_unq').on(t.palaceId, t.position),
  ],
);

export type CardRow = typeof cards.$inferSelect;
export type NewCardRow = typeof cards.$inferInsert;
export type FsrsStateRow = typeof fsrsState.$inferSelect;
export type ReviewLogRow = typeof reviewLog.$inferSelect;
export type AssessmentRow = typeof assessments.$inferSelect;
export type AbilityRow = typeof abilityRatings.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type PalaceRow = typeof palaces.$inferSelect;
export type NewPalaceRow = typeof palaces.$inferInsert;
export type LocusRow = typeof loci.$inferSelect;
export type NewLocusRow = typeof loci.$inferInsert;
