# `/src/db` — Local persistence layer (Drizzle + expo-sqlite / sql.js)

**Date:** 2026-07-18
**Status:** Implemented (2026-07-19)
**Scope:** Implement `/src/db` — schema, migrations, cross-platform client, thin typed query layer, seed, and verification.

## Goal

A single Drizzle schema and query layer that runs identically on native (iOS/Android via
`expo-sqlite`) and web (via `sql.js`/WASM), persists locally, and is ready for a future sync
layer. No business logic in components or in the DB layer — scheduling/scoring stays in
`/src/engine`. The DB layer stores and returns plain rows.

## Data model

Six tables, per the project plan. Ids are text UUIDs (sync-friendly). Timestamps are stored as
`integer` epoch-millis via Drizzle's `timestamp_ms` mode (⇄ JS `Date`). Booleans are
`integer { mode: 'boolean' }`.

### cards

`id` (text PK) · `module` (text) · `front` (text) · `back` (text) · `payload` (text, JSON) ·
`created_at` (ts_ms) · `is_synced` (bool, default false) · `is_deleted` (bool, default false)

`payload` is a JSON string for module-specific card data. `is_synced`/`is_deleted` live on
`cards` from day one (v1 has no sync, but retrofitting soft-delete after users have data is
painful).

### review_log — APPEND-ONLY

`id` (text PK) · `card_id` (text, FK→cards.id) · `ts` (ts_ms) · `rating` (text:
again/hard/good/easy) · `elapsed_ms` (integer) · `difficulty` (real) · `stability` (real) ·
`retrievability` (real)

**Append-only is a hard constraint.** Enforced two ways: (a) the query layer exposes INSERT and
SELECT only — no UPDATE/DELETE functions; (b) **SQLite triggers** on `review_log` `RAISE(ABORT)`
on any UPDATE or DELETE (migration-backed, identical on both drivers). The trigger makes the
"no mutation" guarantee _testable_ — a test attempts an UPDATE and asserts it throws (you cannot
test the mere absence of a function). This is what lets us re-optimize FSRS parameters later and
produce honest pre/post analytics. The `difficulty`/`stability`/`retrievability` columns are the
post-review snapshot captured at review time.

**`rating` is stored as text**, typed to the engine's public `ReviewRating`
(`'again' | 'hard' | 'good' | 'easy'`). The text↔numeric-`Grade` mapping already lives inside
`fsrs.ts` (`GRADE_BY_RATING`); the app never handles FSRS's 1–4, so text keeps `review_log`
aligned with the engine boundary rather than relocating the mapping here. **Required test:** a
bidirectional mapping test covering all four values (each `ReviewRating` maps to a distinct
`Grade` and back), so an off-by-one can't corrupt scheduling silently.

### fsrs_state — 1:1 with card, mirrors `engine/fsrs.ts` `CardState`

`card_id` (text PK, FK→cards.id) · `due` (ts_ms) · `stability` (real) · `difficulty` (real) ·
`reps` (integer) · `lapses` (integer) · `phase` (text) · `scheduled_days` (integer) ·
`learning_steps` (integer) · `last_review` (ts_ms, nullable)

**Column names match the `CardState` wrapper output exactly, so there is no mapping layer.**
Drizzle property names equal `CardState` keys (`scheduledDays`, `learningSteps`, `lastReview`);
snake_case is only the underlying SQL column name. A `SELECT` row is `CardState & { cardId }` —
drop `cardId` and it feeds straight into `schedule()`.

> **Deliberate divergence from the plan doc:** the plan wrote this enum column as `state`. The
> `fsrs.ts` wrapper renames FSRS's internal `Card.state` to **`phase`** (`state` is overloaded).
> We follow the wrapper (the plan's own "no mapping layer" rule), so the column is **`phase`**.
>
> The plan's abbreviated 5-column list (`difficulty, stability, due, last_review, state`) is
> **superseded** here: it dropped `reps`, `lapses`, `scheduled_days`, `learning_steps`, which are
> required to round-trip a `CardState` losslessly. All nine `CardState` fields are persisted.

`CardState` (source of truth — `src/engine/fsrs.ts`):

```ts
interface CardState {
  due: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  phase: 'new' | 'learning' | 'review' | 'relearning';
  scheduledDays: number;
  learningSteps: number;
  lastReview: Date | null;
}
```

### assessments

`id` (text PK) · `instrument` (text) · `raw_score` (real) · `normalized` (real, nullable) ·
`ts` (ts_ms)

`instrument` is the task name (vviq/digitspan/corsi/nback/pvt/reasoning). `raw_score` and
`normalized` are **task-specific** — `normalized` is normalized within that instrument only, never
a cross-task or general-ability figure (per CLAUDE.md: no general-intelligence/IQ framing).

### ability_ratings

`module` (text PK) · `elo` (real) · `updated_at` (ts_ms)

One Elo ability rating per module, updated by `engine/elo.ts`. Item ratings are not persisted
(assessment items are generated, not stored).

### sessions

`id` (text PK) · `started` (ts_ms) · `ended` (ts_ms, nullable) · `module` (text) ·
`items` (integer) · `accuracy` (real)

### Indexes

Created in the initial migration, not left to full scans:

- **`fsrs_state(due)`** — the review-queue query is `WHERE due <= now`, the hottest query in the
  app; without this it's a full scan on every session start.
- **`review_log(card_id)`** and **`review_log(ts)`** — SQLite does not auto-index foreign keys,
  and both per-card FSRS re-optimization and time-range analytics scan these columns.
- **`cards(module, is_deleted)`** — module card lists filter deleted rows by module.

## Architecture

```
src/db/
  schema.ts            Drizzle table defs (pure TS — no RN/Expo imports)
  client.native.ts     expo-sqlite driver; PRAGMA journal_mode=WAL (native-only)
  client.web.ts        sql.js/WASM driver; IndexedDB persistence
  client.ts            platform-neutral surface: getDb(), runMigrations(); Metro resolves
                       ./client to .native/.web per platform
  migrate.ts           cross-platform runtime migrator (ordered SQL, _migrations bookkeeping)
  migrations/          drizzle-kit generated SQL — source of truth, checked in
    0000_initial.sql   creates all six tables + _migrations
    meta/              drizzle journal + snapshots
  queries/
    cards.ts           insert/get/list/soft-delete cards; upsert/read fsrs_state
    reviews.ts         INSERT + SELECT only (append-only — no update/delete)
    assessments.ts     insert/list assessment results
    ability.ts         read/upsert ability_ratings
    sessions.ts        create/end/list sessions
  seed.ts              seedDemoCards(db) — a handful of demo cards + initial fsrs_state
  selftest.ts          runDbSelfTest(db) — exercises migrate→insert→read→append for the
                       dev-screen "DB self-test" button (native smoke test)
  index.ts             public surface
```

### Cross-platform driver split

- **Native:** `openDatabaseSync('memory-palace.db')` + `drizzle-orm/expo-sqlite`. Sets
  `PRAGMA journal_mode = WAL` and `PRAGMA foreign_keys = ON`. **WAL is guarded to the native
  client only** — sql.js is in-memory and does not support WAL; the PRAGMA is never issued on web.
- **Web:** `sql.js` initialized from its WASM (`locateFile`). Sets `PRAGMA foreign_keys = ON`
  (matching native — no FK-enforcement asymmetry). Because sql.js is in-memory, the DB is persisted
  as a `Uint8Array` in **IndexedDB**: loaded on init, saved (debounced) after writes, and **flushed
  synchronously on `pagehide`/`visibilitychange`** so a closing tab can't drop the last write.
  `drizzle-orm/sql-js` provides the Drizzle binding.
- Metro's platform resolution picks `client.native.ts` vs `client.web.ts`, so neither driver is
  bundled into the other platform.

### Migrations

`drizzle-kit generate` produces SQL from `schema.ts` (checked into `migrations/`, the source of
truth — no ad-hoc `CREATE TABLE` in client code). A small runtime migrator (`migrate.ts`) applies
migration statements in order on both drivers, recording applied tags in a `_migrations` table so
it is idempotent and identical native vs web. All six tables are created in `0000_initial` — every
table is migration-backed from day one.

### Query layer

Thin typed functions only — no scheduling/scoring (that's `/src/engine`). `reviews.ts` deliberately
has **no** update/delete functions. `cards.ts` "delete" is a **soft** delete (`is_deleted = true`).

## Verification plan

Running on **Windows** — no iOS simulator available here. Coverage:

1. **Typecheck:** `npm run typecheck` (strict, `exactOptionalPropertyTypes`).
2. **Web bundle:** `npx expo export` produces a web bundle without error.
3. **Node/Vitest DB tests:** build a real Drizzle+sql.js instance in Node, run `runMigrations`,
   then exercise the query layer. Required cases:
   - **`fsrs_state` lossless round-trip (the most important test in the layer):** construct a
     `CardState` with a **non-default value in every field**, `upsertFsrsState` → read back →
     `toEqual` the original. A **separate case for `lastReview: null`**. This is what actually
     justifies the 9-column decision.
   - Insert card + fsrs_state (transactionally); append reviews; upsert ability; create/end
     session; insert assessment.
   - **Append-only is enforced, not assumed:** attempt an UPDATE and a DELETE against
     `review_log` and assert each throws (the trigger fires) — a real assertion, not "no function
     exists."
   - `rating` bidirectional mapping test (all four `ReviewRating` values).
   - Soft-delete hides a card from module lists.
     These live under `src/db/**/*.test.ts` (outside `/src/engine`, so the engine's framework-free
     rule is unaffected).
4. **`ts-fsrs` type verification (verify, don't assert):** before finalizing the schema, print the
   actual `Card` type from the _installed_ `ts-fsrs` and diff it against our `CardState` — check
   specifically for `elapsed_days` and whether `learning_steps` exists in this version. Then add a
   **type-level test** (`const _check: Card = toLibraryCard(state)`) so a dependency bump breaks the
   build instead of silently corrupting schedules.
5. **Native smoke test (manual, by user on macOS):**
   - Dev-screen **"DB self-test"** button calls `runDbSelfTest(db)` on device/simulator:
     migrate → insert card+state → append review → read back → assert.
   - Manual iOS checklist (in `src/db/README.md`): app boots, migrations run once, self-test
     passes, data survives app restart (WAL file present), **WAL PRAGMA runs on native and is
     absent on web**.

**What the Node/sql.js tests do NOT cover (the driver is the risk surface, not an afterthought).**
The schema, migrations, queries, and triggers are shared, but the following stay **unverified until
run on a Mac/simulator** and must be confirmed via the native checklist:

- WAL journal-mode behavior (`PRAGMA journal_mode=WAL` result, WAL file creation).
- `expo-sqlite` date/boolean coercion (`timestamp_ms` ⇄ `Date`, `mode:'boolean'` ⇄ 0/1) vs sql.js.
- Transaction semantics under the `expo-sqlite` driver.
- Any `expo-sqlite`-specific driver quirks (bind types, statement finalization, sync vs async).

**WAL note for the checklist:** `PRAGMA journal_mode=WAL` is issued only from `client.native.ts`.
On web/WASM it is never called; the checklist verifies the native client reports `wal` and the web
path runs without attempting it. **`PRAGMA foreign_keys = ON` is set on _both_ clients** — see
Implementation requirements — so FK enforcement does not silently differ between platforms.

## Implementation requirements (fold in during build)

These are decided; they land during implementation rather than changing the schema shape above.

- **Append-only triggers.** `0000_initial` creates `RAISE(ABORT)` triggers on `review_log` for
  UPDATE and DELETE (covered by the schema + verification sections above).
- **Transactional card creation.** Inserting a `card` and its 1:1 `fsrs_state` runs in a single
  transaction — a partial write must never orphan a card with no schedule.
- **`PRAGMA foreign_keys = ON` on BOTH clients.** Native-only FK enforcement would let violations
  fail on iOS but pass on web (the only platform testable here) — the worst possible asymmetry.
  Both `client.native.ts` and `client.web.ts` set it.
- **Web durability flush.** Debounced IndexedDB saves can lose the last write if the tab closes
  mid-debounce. Register `pagehide`/`visibilitychange` handlers that flush the pending save
  **synchronously**; document the residual risk (a crash between write and flush) in `README.md`.
- **Keep the plan/spec data-model in sync with code.** This spec's data-model section is the
  authority and already reflects `phase` + all 9 `CardState` fields. If a separate plan document
  is later added to the repo, its data-model section must be updated to match (there is no such
  file in the repo today — the pasted plan lived only in chat).

## New dependencies

- `sql.js` + `@types/sql.js` (web driver + Node tests).
- `drizzle-kit` (already present) for migration generation.

## Out of scope (this task)

- The actual sync engine (only the `is_synced`/`is_deleted` flags land now).
- Persisted Elo item ratings.
- Assessment task-specific payload columns beyond `raw_score`/`normalized` (JSON detail can be
  added later if a task needs it).
- EAS native build config.
