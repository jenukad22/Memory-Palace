# Progress dashboard — Elo history, retention curve, streak, baseline retakes

**Date:** 2026-07-31
**Status:** Decisions resolved.
**Scope:** A new per-module progress dashboard (`app/progress.tsx`): Elo-ability-over-time chart, an FSRS
predicted-retention curve, a streak/consistency strip, and per-baseline-instrument trend + retake, for the
`memory` module (the only implemented module). `attention`/`reasoning` render as not-yet-available, matching
the existing `app/modules/index.tsx` hub pattern. A schema change (`ability_log`) and a retake path for the
three baseline instruments (VVIQ, digit span, Corsi) are required to make this possible — this is not a
read-only reporting layer over existing data.
**Non-scope:** attention/reasoning module content (still stubs, Phases 6.1/6.2), a logged-retrievability
("actual" recall strength over time, as opposed to predicted) chart, `sessions`-based activity in the streak
calculation.

---

## 0. Honesty constraint (binding, unchanged)

Per CLAUDE.md and `src/assessment/SPEC.md` §0: every number on this dashboard reports performance on the
specific task it comes from — an Elo rating for one module's graded reviews, a retrievability percentage for
that module's cards, a raw score on one baseline instrument, a day count. No copy, identifier, or analytics
name may imply general intelligence, IQ, or health/medical status. `src/assessment/SPEC.md` §0 already states
the operating premise this feature builds on: _"For a single user, within-user change over time is the
meaningful signal, not a cross-user z-score; the dashboard reflects that."_ This is that dashboard.

`copy-honesty.test.ts`'s `SCAN_DIRS` is extended to include the new `src/dashboard` folder — the honesty note
and every chart caption on this screen must pass the same automated scan as onboarding copy.

---

## 1. Why `ability_log` is a new append-only table, not a derived read

`ability_ratings` stores only the current Elo per module (`upsertAbility` upserts in place). Charting "Elo
over time" needs a series, which doesn't exist in storage today.

**Rejected: derive-on-read by replaying `review_log`.** This is the project's usual default (see the VVIQ
routing-flag precedent, `docs/superpowers/specs/2026-07-20-assessments-followups-design.md` §2), but it
doesn't hold up here:

- The baseline Elo seed is `seedModuleElo(normalized)`, where each instrument's `normalized` proxy is
  `normalizeSpan(rawScore, samples)` — `samples` is _the accumulated set of that instrument's raw scores at
  seed time_. This feature adds baseline retakes (§3 below), which grow that sample set. Replaying "what the
  seed would have computed" after a retake exists no longer reproduces the original seed — the inputs to the
  replay have changed.
- Per-review Elo deltas (`src/engine/elo.ts` `update()`) aren't cleanly invertible backward from the current
  value either: `delta = k·(outcome − expectedScore(prevElo, itemElo))`, and `expectedScore` is a logistic
  function of `prevElo` — solving for `prevElo` given `nextElo` has no closed form.

**Decision: `ability_log` (module, elo, ts), append-only, trigger-enforced — same pattern as `review_log`.**
Once this feature ships, it is the _only_ durable record of the series the user is shown, even though each
row is a derived value at write time. That makes it as load-bearing as `review_log` in the sense that matters
to this project (per project convention: _"append-only `review_log` triggers are the only real enforcement of
a core honesty constraint"_) — the constraint here is that the trend the user sees must be real history, not
something that can silently be edited or rewritten by application code. The trigger mechanics are proven and
cheap: identical two-trigger `RAISE(ABORT)` pattern as `0001_review_log_append_only.sql`, hand-authored the
same way, registered in `meta/_journal.json` with a chain-linked snapshot per this project's existing
migration-consistency guard.

**Write path:** `upsertAbility(db, module, elo, now)` gains one additional `.run()` that inserts into
`ability_log`, with no new `db.transaction()` of its own. Both existing call sites —
`recordReview`'s existing `db.transaction((tx) => {...})` in `src/db/queries/reviews.ts`, and the bare call in
`CorsiScreen.finalizeBattery()` — already compose correctly with this: inside a transaction the extra insert
becomes part of the ambient transaction (same as the sibling `upsertFsrsState`/`appendReview` calls already do
today); called bare, it's just a second sequential statement. **No changes needed at either existing call
site.**

---

## 2. Streak/consistency — source of activity is `review_log` only

**Decision:** a module's "activity days," for both current-streak and rolling-consistency purposes, are the
distinct local calendar days on which at least one `review_log` row exists for a card in that module (same
`innerJoin(reviewLog, cards, eq(cards.module, module))` shape `recentModuleAccuracy`/`countModuleReviews`
already use in `src/db/queries/reviews.ts`).

**Why not `sessions` too:** `sessions` rows today are written only by the onboarding battery flow
(`startSession`/`endSession`), and this feature's own baseline retakes (§3) write straight to `assessments`
without touching `sessions` — so including `sessions` would not actually capture the activity type this
feature is adding, while blurring the streak (meant to reflect ongoing spaced-repetition practice) together
with one-off baseline administrations, which already get their own dedicated dashboard section. The existing
campaign feature (`src/engine/campaign.ts`) already keys its own day-completion logic off `review_log` for
the same reason — this reuses that precedent rather than inventing a second "what counts as activity"
definition.

**Definitions** (`src/engine/streak.ts`):

- **Current streak** = consecutive local calendar days, walking back from today, with ≥1 activity day; a gap
  on today itself yields 0. No grace days.
- **Consistency** = fraction of days with activity within a trailing window (default 30 days, inclusive of
  today).

---

## 3. FSRS retention curve — predicted, not logged

**Decision:** the dashboard shows a _predicted_ forward-looking retrievability curve — for the module's
non-new cards, the average `getRetrievability` (existing `src/engine/fsrs.ts` export) at increasing day
offsets from now, using each card's actual current stability/difficulty/last-review. This is the standard
reading of "FSRS retention curve" and reuses the exact retrievability formula/parameters already used
everywhere else in the app (no re-derivation of FSRS constants).

**Out of scope (follow-up, not built now):** a second chart of _logged_ retrievability values (from
`review_log.retrievability`, already captured at every review) plotting actual recall-strength-at-test-time
over history. This answers a different, review-timing-biased question and would need its own shaping/chart —
real added scope the current requirement doesn't call for.

---

## 4. Baseline instrument retakes

**Decision:** add one retake entry point per user-facing _task_ — VVIQ, digit span, Corsi — not per raw
`assessments.instrument` key (5 keys, 3 tasks; digit span and Corsi already run forward+backward as one flow
in their existing screens). `src/assessment/battery.ts` gains a `BASELINE_TASKS` constant grouping the
instrument keys per task with a retake route.

**Reused, not rebuilt:** `VviqScreen`, `DigitSpanScreen`, `CorsiScreen` already collect raw responses and call
`insertAssessment` — the underlying data model already supports multiple rows per instrument
(`listAssessments` already returns `desc(ts)`, and the VVIQ-routing-flag precedent already assumes "a retake
supersedes"). The gap is purely that these screens are hard-wired to onboarding navigation and, in Corsi's
case, to a one-time Elo-reseed.

**New `mode?: 'onboarding' | 'retake'` prop** (default `'onboarding'`, preserving all current behavior
exactly) on all three screens:

- Gates `useBatterySession.getState().recordItem()` and the post-completion route (`/onboarding/checkpoint` →
  `/progress` in retake mode).
- For Corsi specifically: gates the call to `finalizeBattery()` (which reseeds the module Elo via
  `upsertAbility(db, 'memory', seedModuleElo(...))`, ends the onboarding `sessions` row, and resets
  `useBatterySession`). In retake mode, none of that fires — `finalizeBattery`'s internals are untouched, only
  its caller is gated. This is the one behavioral change that actually matters for correctness: without it, a
  Corsi retake would silently overwrite the module's Elo and discard the history `ability_log` (§1) exists to
  preserve.
- Swaps the `ScreenShell` kicker to "Baseline retake" (the 3-of-3 battery framing doesn't apply standalone).

New thin routes mirror the existing `app/onboarding/*.tsx` "thin route, real component elsewhere" pattern:
`app/modules/memory/retake-vviq.tsx`, `retake-digitspan.tsx`, `retake-corsi.tsx`.

---

## 5. Charting: hand-rolled `react-native-svg`, not a prebuilt library

**Decision:** add `react-native-svg` (installed via `npx expo install` for SDK-matched versioning) and build
minimal in-house chart primitives (`src/ui/chartGeometry.ts` pure scale/path math + `src/ui/LineChart.tsx`)
rather than a prebuilt RN chart library. No charting dependency exists in the project today, and every
existing interactive component (`CorsiBoard`, `DigitSlots`, `LikertScale`, …) is built directly from
`src/ui/tokens.ts` per DESIGN.md's "never style ad hoc" rule — a prebuilt library's default styling would not
match that system without patching, and this project consistently chooses hand-rolled + token-driven over a
dependency in exactly this situation (e.g. `CorsiBoard`/`corsiLayout.ts`, not a generic grid-game library).
One generic `LineChart` is reused for both the Elo chart and the retention curve (and, in `compact` mode, the
baseline-instrument sparklines) rather than building near-duplicate components. No new color tokens are
needed: every chart is single-series `accent`; forward/backward baseline scores are shown as two separate
sparklines rather than overlaid on one chart (they're different scales), which is what would otherwise have
forced a second series color.

---

## 6. Route placement

**Decision:** new route `app/progress.tsx`, linked from the existing landing screen (`app/index.tsx`) via one
new secondary button, rather than replacing or expanding `app/index.tsx` itself. `app/index.tsx` is the
action-oriented landing screen (start/resume baseline, open training, daily review); a multi-chart
read-and-review screen is a different kind of screen and mirrors the existing `app/modules/index.tsx` hub
layout (per-domain sections; `memory` populated, `attention`/`reasoning` "not yet available") rather than a
third layout convention. New non-route folder `src/dashboard/` holds the real components, consistent with
`src/modules/*`, `src/assessment/*`, `src/review/*` all keeping route files thin.

---

## 7. Data model diff

```diff
+ export const abilityLog = sqliteTable(
+   'ability_log',
+   {
+     id: text('id').primaryKey(),
+     module: text('module').notNull(),
+     elo: real('elo').notNull(),
+     ts: integer('ts', { mode: 'timestamp_ms' }).notNull(),
+   },
+   (t) => [index('ability_log_module_ts_idx').on(t.module, t.ts)],
+ );
+ export type AbilityLogRow = typeof abilityLog.$inferSelect;
```

Plus two triggers (`ability_log_no_update`, `ability_log_no_delete`), hand-authored exactly like
`0001_review_log_append_only.sql`. No other table changes.

---

## 8. Verification plan

Same gates as prior Phase-2 work, run on Windows:

1. `npm run typecheck`, `npm run lint`.
2. `npm test` (Vitest, sql.js in Node):
   - Migration bundle grows from 4 to 6 entries; new tags present; SQL contains the `ability_log` table +
     both triggers.
   - `runMigrations` idempotency: applied-row count updates to 6.
   - `ability_log` blocks UPDATE/DELETE via triggers (mirrors the existing `review_log` test).
   - `upsertAbility` appends to `ability_log` on every call (both the transactional and bare call shapes);
     `listAbilityHistory` returns ascending-`ts` rows scoped to one module, no cross-module leakage.
   - `listFsrsStatesByModule`, `listModuleActivityDays`: module-scoped, exclude soft-deleted cards.
   - `src/engine/streak.test.ts`, `retention.test.ts`, `abilityHistory.test.ts`, `calendarDay.test.ts`
     (relocated), `src/ui/chartGeometry.test.ts`: pure-function edge cases (empty input, single point, gaps,
     window boundaries, degenerate chart domains).
   - `src/integration/e2eSmoke.test.ts`: updated migration-tag count; new assertion that `listAbilityHistory`
     grows through the real baseline-seed and `recordReview` paths it already exercises.
   - `src/assessment/copy-honesty.test.ts`: `SCAN_DIRS` includes `src/dashboard`; the honesty note and all
     new chart captions pass.
3. `npx expo export` — confirms the web/native bundle still builds with the new `react-native-svg` dependency
   and new routes.
4. Manual, in-browser: full dashboard walkthrough, all three retakes, confirm a Corsi retake does not change
   the displayed memory Elo, confirm chart layout doesn't overflow on a narrow browser width.

## 9. Out of scope (this task)

- `attention`/`reasoning` module content.
- A logged (as opposed to predicted) retrievability-over-time chart (§3).
- `sessions`-based activity in the streak/consistency calculation (§2).
- Any empirical-z normalization work (`src/assessment/SPEC.md` §2.1's `N_MIN = 200` switch) — retakes add
  more samples toward that threshold but don't trigger the switch themselves.
