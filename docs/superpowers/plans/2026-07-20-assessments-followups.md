# Assessments follow-ups — implementation plan

**Goal:** Land the two SPEC.md §12 tracked follow-ups as one migration + engine/query cycle: a
nullable `payload` column on `assessments`, and a derived (not stored) VVIQ routing-flag read.
Design decisions are resolved in
[2026-07-20-assessments-followups-design.md](../specs/2026-07-20-assessments-followups-design.md).

**Tech stack:** unchanged from Phase 2 (`drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10, Vitest 4).

## Global constraints (carried over from Phase 2, unchanged)

- **Migration-driven schema.** No ad-hoc `ALTER TABLE` in client code — the `payload` column comes
  from `npm run db:migrations` (drizzle-kit `generate` + bundle into `migrations.generated.ts`).
  Never hand-edit `migrations.generated.ts`; never edit an already-shipped migration file.
- **`review_log` append-only triggers stay untouched.** This work does not touch `review_log`.
- **`/src/engine` stays framework-free**, unchanged. `/src/db` may import `/src/engine` (pure TS);
  the reverse stays forbidden. `getVviqStrategy` imports `vviqStrategy`/`MemoryStrategy` from
  `src/engine/assessment`.
- **Honesty rule (CLAUDE.md) unchanged.** No new identifiers or copy here; this is data plumbing.
- **Screens and the expo-router shell stay blocked** — nothing in `/src/assessment/*` (beyond the
  existing stub `index.ts` files) or an `app/` directory gets created by this work.

### Verification reality (Windows, no Mac)

Same as Phase 2: `npm run typecheck`, `npm run lint`, `npm test` (Vitest, sql.js in Node) are the
runnable gates. `payload text` is a plain nullable column addition with no platform-specific
coercion (unlike `timestamp_ms`/`boolean` modes), so this task does not add anything to the
existing iOS manual-checklist risk surface in `src/db/README.md`.

---

## File structure (diff from current `/src/db`)

```
src/db/
  schema.ts                    MODIFY: add `payload` to assessments table
  migrations/
    0002_*.sql                 GENERATED: ALTER TABLE assessments ADD COLUMN payload text;
    meta/                      GENERATED: updated journal + new snapshot
  migrations.generated.ts      REGENERATED (npm run db:migrations)
  migrations.test.ts           MODIFY: bundle now has 3 entries; assert payload column present
  migrate.test.ts              MODIFY: idempotency assertion count 2 -> 3
  queries/
    assessments.ts             MODIFY: insertAssessment accepts optional `payload`
    assessments.test.ts        NEW: payload round-trip (set + omitted-defaults-null)
    vviq.ts                    NEW: getVviqStrategy(db)
    vviq.test.ts               NEW: null when empty, threshold both sides, retake supersedes
  index.ts                     MODIFY: export * from './queries/vviq'
  README.md                    MODIFY: note payload column + derived VVIQ flag under Invariants
src/assessment/SPEC.md         MODIFY: §12 follow-ups marked resolved with a one-line pointer
```

## Task 1 — Schema + generated migration

- [ ] Add `payload: text('payload'), // JSON string, nullable` to the `assessments` table in
      `src/db/schema.ts`, directly under `normalized` (mirrors `cards.payload`'s comment style).
- [ ] Run `npm run db:migrations`. Confirm: a new `000X_*.sql` appears under `src/db/migrations/`
      containing `ALTER TABLE assessments ADD COLUMN payload text;`; `meta/_journal.json` gains an
      entry; `migrations.generated.ts` now has 3 entries (do not hand-edit the generated file).
- [ ] Sanity-check the generated SQL by eye — it must be a single additive `ALTER TABLE`, no drop/
      recreate (drizzle-kit sometimes recreates SQLite tables for column changes it can't express
      as `ADD COLUMN`; confirm it didn't do that here since a plain nullable column add is always
      expressible as `ADD COLUMN`).

## Task 2 — Query layer

- [ ] `src/db/queries/assessments.ts`: extend `NewAssessmentInput` with `payload?: string | null`;
      set `payload: input.payload ?? null` in the inserted row (same pattern as `normalized`).
- [ ] New `src/db/queries/vviq.ts`:
  ```ts
  import { desc, eq } from 'drizzle-orm';
  import { vviqStrategy, type MemoryStrategy } from '../../engine/assessment';
  import { assessments } from '../schema';
  import type { Db } from '../types';

  const VVIQ_INSTRUMENT = 'vviq';

  export function getVviqStrategy(db: Db): MemoryStrategy | null {
    const row = db
      .select()
      .from(assessments)
      .where(eq(assessments.instrument, VVIQ_INSTRUMENT))
      .orderBy(desc(assessments.ts))
      .limit(1)
      .get();
    return row ? vviqStrategy(row.rawScore) : null;
  }
  ```
- [ ] `src/db/index.ts`: add `export * from './queries/vviq';`.

## Task 3 — Tests

- [ ] `src/db/migrations.test.ts`: bump the bundle-length assertion to 3, update the "last tag"
      assertion to the new migration's tag, add a case asserting the SQL contains the `payload`
      column addition on `assessments`.
- [ ] `src/db/migrate.test.ts`: idempotency test's `applied.length` assertion: 2 -> 3.
- [ ] `src/db/queries/assessments.test.ts` (new, or extend `misc.test.ts` — prefer a dedicated file
      since `misc.test.ts` currently spans three unrelated tables): `insertAssessment` with an
      explicit `payload` string round-trips; omitting `payload` yields `null`, not `undefined`.
- [ ] `src/db/queries/vviq.test.ts` (new):
  - No VVIQ assessment rows -> `getVviqStrategy` returns `null`.
  - One VVIQ row at `rawScore = 32` -> `'non-visual'`; at `33` -> `'visual'` (threshold both sides,
    matches `VVIQ_APHANTASIA_THRESHOLD` in the engine).
  - Two VVIQ rows (earlier low score, later high score, distinct `ts`) -> strategy reflects the
    **later** row, proving retake supersedes without any stored/updated flag.

## Task 4 — Docs

- [ ] `src/db/README.md`: under Invariants, add a line noting `assessments.payload` (nullable JSON,
      per-trial detail) and that the VVIQ routing flag is derived on read (`getVviqStrategy`), not
      stored — point at the design doc.
- [ ] `src/assessment/SPEC.md` §12: mark both tracked follow-ups resolved with a one-line pointer to
      the design doc and the shipping commit; do not restructure the rest of the file.

## Verification commands (run at the end, must all be green)

```bash
npm run typecheck
npm run lint
npm test
```

Expect the Vitest count to grow by exactly the new test cases added in Task 3 (no regressions in
the existing 104).

## Commit

One commit at the end (`feat(db): assessments.payload column + derived VVIQ routing flag`),
covering schema/migration/query/test/doc changes together — matches SPEC.md §12's framing of this
as "one migration + engine/query cycle," not two.
