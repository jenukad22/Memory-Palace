# Progress dashboard — Implementation Plan

**Spec:** [2026-07-31-progress-dashboard-design.md](../specs/2026-07-31-progress-dashboard-design.md)

**Goal:** A per-module progress dashboard (`app/progress.tsx`) showing Elo ability over time, a predicted
FSRS retention curve, streak/consistency, and per-baseline-instrument trend + retake, for `memory` (the only
implemented module). Every number is task-specific and re-testable; no brain-age/IQ/health framing anywhere.

Delivered in three green-gated slices, each its own commit.

---

## Task 1 — Data layer: `ability_log` + engine + queries

- [x] Add `abilityLog` table to `src/db/schema.ts`.
- [x] `npm run db:generate` → migration `0004_long_white_tiger.sql` (plain `CREATE TABLE` + index).
- [x] Hand-author `0005_ability_log_append_only.sql` (two `RAISE(ABORT)` triggers, mirrors
      `0001_review_log_append_only.sql`), hand-copy `meta/0005_snapshot.json`, hand-append the journal entry,
      `npm run db:bundle`.
- [x] Update `src/db/migrations.test.ts`, `src/db/migrate.test.ts` (tag/table/trigger counts, new
      `ability_log` update/delete-blocked test), `src/db/migrations-consistency.test.ts` passes unmodified.
- [x] `src/db/README.md` — new invariants bullet.
- [x] Extract `startOfLocalDay`/`isSameLocalDay` from `src/engine/campaign.ts` into `src/engine/calendarDay.ts`
      (+ moved test); `campaign.test.ts` shrinks accordingly.
- [x] `src/engine/streak.ts` — `currentStreak`, `consistency`, `activityWindow` (+ tests).
- [x] `src/engine/retention.ts` — `moduleRetrievabilityCurve` (+ tests).
- [x] `src/engine/abilityHistory.ts` — `shapeAbilityHistory` (+ tests).
- [x] `src/engine/index.ts` — barrel exports for the three new modules + `calendarDay`.
- [x] `src/db/queries/ability.ts` — `upsertAbility` appends to `ability_log` (no new transaction);
      `appendAbilityLog`, `listAbilityHistory` (+ tests in `misc.test.ts`).
- [x] `src/db/queries/cards.ts` — `listFsrsStatesByModule` (+ tests in `cards.test.ts`).
- [x] `src/db/queries/reviews.ts` — `listModuleActivityDays` (+ tests in `reviews.test.ts`).
- [x] `src/assessment/battery.ts` — `BASELINE_TASKS` (groups the 5 instrument keys into 3 user-facing tasks).
- [x] `src/integration/e2eSmoke.test.ts` — `EXPECTED_MIGRATION_TAGS` grows to 6; `listAbilityHistory`
      assertions at the baseline-seed and `recordReview` steps it already exercises.

**Verification:** `npm run typecheck`, `npm run lint`, `npm test` (263 tests) — all green.

**Commit:** `feat(dashboard): ability_log history, streak/retention engine, dashboard queries`

---

## Task 2 — Retake mode for the three baseline screens

- [x] `VviqScreen`, `DigitSpanScreen`, `CorsiScreen` gain `mode?: 'onboarding' | 'retake'` (default
      `'onboarding'`, so all existing behavior/tests are unaffected).
  - Gate `useBatterySession.getState().recordItem()` and the post-completion route behind
    `mode === 'onboarding'`; retake mode navigates to `/progress` instead of `/onboarding/checkpoint`.
  - Corsi specifically: `finalizeBattery()` (Elo reseed + session close + `useBatterySession` reset) now
    only ever fires in onboarding mode — the one change that actually matters, since a retake must never
    silently overwrite the Elo history `ability_log` exists to preserve.
  - `ScreenShell` kicker swaps to `"Baseline retake"` in retake mode.
- [x] New thin routes: `app/modules/memory/retake-vviq.tsx`, `retake-digitspan.tsx`, `retake-corsi.tsx`.

**Verification:** `npm run typecheck`, `npm run lint`, `npm test` (263 tests), `npx expo export --platform web`
(confirms the 3 new routes resolve) — all green.

**Commit:** `feat(assessment): retake mode for VVIQ/digit-span/Corsi + retake routes`

---

## Task 3 — Chart UI + dashboard screen

- [x] `npx expo install react-native-svg` (15.15.4, SDK-57-matched).
- [x] `src/ui/chartGeometry.ts` — `makeChartScale`, `linePath` (+ tests: domain edges, padding, degenerate
      domain, path rendering for 0/1/many points).
- [x] `src/ui/LineChart.tsx` — one generic component for the Elo chart, the retention curve, and (in
      `compact` mode) baseline-instrument sparklines. `accent` stroke, `line` gridlines, `AppText` axis
      labels (not SVG-native text). No component test — pulls in React Native, same as `CorsiBoard.tsx`
      (untested directly; its pure math in `chartGeometry.ts` is).
- [x] `src/ui/StreakStrip.tsx` — presentational; all shaping done by `engine/streak.ts`. `radius.sm` cells
      (not `radius.full`, reserved for `BatteryProgress`).
- [x] `src/ui/BaselineTrendCard.tsx` — task label + one sparkline row per raw instrument (forward/backward
      never merged into one line) + a "Retake" button.
- [x] `src/ui/ComingSoonTag.tsx` — extracted from `app/modules/index.tsx`'s local component (now imported
      from `@/ui` in both places).
- [x] `src/ui/index.ts` — barrel exports for all of the above.
- [x] `src/dashboard/ModuleProgressSection.tsx` — one module's full section: Elo chart → retention curve
      (captioned "Predicted, based on your current review schedule.") → `StreakStrip` → `BaselineTrendCard`
      per baseline task.
- [x] `src/dashboard/ProgressDashboardScreen.tsx` — fetches `memory`'s data via `useFocusEffect` (same
      pattern as `app/index.tsx`, no TanStack Query — this codebase doesn't use it for local-sqlite reads
      anywhere), renders the honesty note, the memory section, and "Not yet available" cards for
      attention/reasoning (matching `app/modules/index.tsx`'s existing treatment).
- [x] `app/progress.tsx` — thin route.
- [x] `app/index.tsx` — one new secondary button, `"Progress dashboard"` → `/progress`. Nothing else on the
      landing screen changed.
- [x] `src/assessment/copy-honesty.test.ts` — `SCAN_DIRS` gains `src/dashboard` (was previously unscanned;
      this is exactly the screen carrying the honesty note).

**Honesty note copy** (Card at the top of `ProgressDashboardScreen`, above all module sections):

> **What this does and doesn’t mean.** Every number here reflects performance on the specific task it comes
> from — a rating for graded reviews in this module, a retention estimate for the cards you’ve studied, or a
> raw score on one baseline task. Improvement shown here is tied to the training you’ve done and doesn’t say
> anything about your abilities outside these tasks.

(Curly apostrophes are required in JSX text by `react/no-unescaped-entities`, matching the existing convention
in `app/modules/[module].tsx`.)

**Verification:** `npm run typecheck`, `npm run lint`, `npm test` (270 tests — the new `chartGeometry.test.ts`
plus the extended `copy-honesty` scan), `npx expo export --platform web` — all green. Manual browser
walkthrough (below) still required before calling this done.

**Commit:** `feat(dashboard): progress dashboard screen — Elo/retention charts, streak, baseline retakes`

---

## Manual verification (run via `npm run web`)

- [ ] `/` → "Progress dashboard" → `/progress`; memory section renders all 4 widgets with real data;
      attention/reasoning show "Not yet available," no chart shells.
- [ ] Honesty note visible and reads as intended.
- [ ] Tap "Retake" on each of the 3 baseline cards: "Baseline retake" kicker (not "Baseline · N of 3"),
      completion lands back on `/progress`, no interaction with `/onboarding/*`.
- [ ] Corsi retake specifically: memory Elo on `/progress` and `/` unchanged after the retake, while a new
      `corsi_forward`/`corsi_backward` history point appears in the baseline card.
- [ ] A few daily reviews, reload `/progress`: Elo chart gains a new point through the real `recordReview`
      path.
- [ ] Resize the browser window: SVG charts don't overflow.
- [ ] Dark-token visual check: `bg0` background, `accent` series line, `textMuted` axis labels, no ad hoc
      colors.

## Out of scope (this feature)

- `attention`/`reasoning` module content.
- A logged (as opposed to predicted) retrievability-over-time chart.
- `sessions`-based activity in the streak/consistency calculation.
- Any empirical-z normalization work (`assessments.normalized` stays derived, `N_MIN = 200` unreached).
