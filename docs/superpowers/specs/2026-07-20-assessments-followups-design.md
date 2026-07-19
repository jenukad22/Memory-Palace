# Assessments follow-ups — `payload` column + VVIQ routing-flag storage

**Date:** 2026-07-20
**Status:** Decisions resolved.
**Scope:** The two tracked follow-ups recorded in `src/assessment/SPEC.md` §12: (1) a nullable
JSON `payload` column on `assessments`, (2) where the VVIQ ≤32 substitute-strategy flag (§8) lives.
Both land before any `assessments` rows exist in the wild, so no backfill.

**Non-scope (unchanged, stays blocked):** assessment screens (`/src/assessment/*`, blocked on
DESIGN.md) and the expo-router app shell. Neither is touched by this work.

---

## 1. `assessments.payload` — nullable JSON text column

**Decision:** add `payload: text('payload')` to the `assessments` table, matching the existing
`cards.payload` pattern exactly (nullable text, JSON-encoded, no schema-level shape enforcement).

**Why now, per SPEC.md §12(1):** per-trial detail (per-length pass/fail for span instruments,
partial-credit counts, and — once §7 lands — PVT per-trial RTs) is currently discarded; only the
rolled-up `raw_score` is kept. The column is cheap to add before any row exists and enables
re-analysis plus the future empirical-z switch (SPEC.md §2.1) without a later migration touching
live data.

**Shape:** left as an opaque nullable string, same as `cards.payload`. No JSON-schema validation
at the DB layer — callers (future screen code, not built yet) decide what they write. This mirrors
`cards.payload`'s existing precedent rather than inventing a second convention.

**Migration mechanics:** `payload` is expressible in Drizzle's schema DSL, so — unlike the
hand-written append-only triggers (`0001_review_log_append_only.sql`) — this is generated via
`npm run db:migrations` (drizzle-kit `generate` + bundle), landing as `0002_*.sql`
(`ALTER TABLE assessments ADD COLUMN payload text;`). No hand-authored SQL.

**Query layer:** `insertAssessment` gains an optional `payload?: string | null` input, defaulting
to `null` — same optionality pattern as the existing `normalized` field.

---

## 2. VVIQ routing-flag storage — resolved: **derive, don't store**

SPEC.md §8/§12 left this open: "the follow-up decides storage vs. derivation." Resolved here.

**Decision:** no new column, no new table. `getVviqStrategy(db)` reads the most recent
`assessments` row where `instrument = 'vviq'` and applies the existing engine function
`vviqStrategy(rawScore)` (already implemented, `src/engine/assessment/scoring.ts`) on read. Returns
`null` if no VVIQ has been taken yet.

**Why derivation, not storage:**

- **§8 is explicit that the flag is non-sticky** — "derives from the most recent VVIQ result... if
  the user retakes VVIQ and scores > 32, they get the visual path." A derived read of "most recent
  VVIQ row" gets this _for free_: retaking naturally supersedes, because it's the same query
  re-evaluated, not a stored value that must be kept in sync with a second write.
- **A stored flag would need a mutation path.** `assessments` has no update/delete query functions
  (mirrors `review_log`'s insert-only shape, though it isn't trigger-enforced). Storing "current
  strategy" as its own row would mean either (a) upserting a single mutable row — introducing the
  first mutable single-source-of-truth table in `/src/db` outside `ability_ratings` (which is
  legitimately an aggregate, not a derived fact) — or (b) appending flag-change rows and querying
  the latest one, which is strictly more machinery than just querying the latest VVIQ score
  directly, since that data is already there.
  Existing VVIQ scores in `assessments` are enough to compute the answer; storing a second copy
  of "the same fact, restated" is the kind of avoidable duplication CLAUDE.md's minimalism
  constraint and the project's own append-only bias argue against.
- **No sync-drift risk.** A stored, separately-written flag can desync from the VVIQ row it was
  supposedly derived from (e.g. a write ordering bug, a skipped update). A derived read cannot
  drift from its own source.

**Cost of derivation (accepted):** every read does a `SELECT ... ORDER BY ts DESC LIMIT 1` rather
than an O(1) lookup. `assessments` is small (one row per instrument per completed baseline/retake
per user, single-user local DB), so this is not a real performance concern, and it's already the
pattern `listAssessments` uses.

**Interface:**

```ts
function getVviqStrategy(db: Db): MemoryStrategy | null;
// MemoryStrategy = 'visual' | 'non-visual' — imported from src/engine/assessment.
```

Lives in a new `src/db/queries/vviq.ts` (VVIQ-specific routing, not generic assessments CRUD —
kept separate from `queries/assessments.ts`, which stays instrument-agnostic).

**Copy/behavior invariant carried over unchanged:** no user-facing string here; this is a pure data
function. The "we'll use a strategy that fits how you think" framing (§8) is a screens concern,
out of scope.

---

## 3. Data model diff

```diff
 export const assessments = sqliteTable('assessments', {
   id: text('id').primaryKey(),
   instrument: text('instrument').notNull(),
   rawScore: real('raw_score').notNull(),
   normalized: real('normalized'), // within-instrument only; nullable
+  payload: text('payload'), // JSON string, nullable — per-trial detail (SPEC.md sec 12)
   ts: integer('ts', { mode: 'timestamp_ms' }).notNull(),
 });
```

No other table changes. No new table.

---

## 4. Verification plan

Same gates as Phase 2, run on Windows (no Mac available):

1. `npm run typecheck` — strict, `exactOptionalPropertyTypes`.
2. `npm run lint`.
3. `npm test` (Vitest, sql.js in Node — both drivers share this schema/migration/query code; the
   driver-specific risk surface (WAL, expo-sqlite coercion) is unchanged by this work and stays
   covered by the existing `src/db/README.md` manual iOS checklist, not re-verified here). Required
   cases:
   - Migration bundle grows to 3 entries; new tag is last; SQL contains the `payload` column add.
   - `runMigrations` idempotency count updates to 3 applied rows.
   - `insertAssessment` round-trips `payload` (set and omitted-→-null cases).
   - `getVviqStrategy`: no VVIQ row → `null`; single row → correct strategy at both sides of the
     ≤32 threshold; a second (retake) row with a different score supersedes the first, proving
     non-sticky derivation without any stored flag.

## 5. Out of scope (this task)

- Any JSON shape/validation for `payload` — callers decide; not enforced at the DB layer.
- Populating `payload` from real assessment screens (screens are blocked on DESIGN.md).
- Any change to `ability_ratings`, `sessions`, `cards`, `fsrs_state`, or `review_log`.
- Native/iOS re-verification — no schema-shape-affecting driver behavior changes here.
