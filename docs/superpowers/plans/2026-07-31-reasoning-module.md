# Plan — Reasoning module (Phase 6.2)

**Design:** [src/modules/reasoning/SPEC.md](../../../src/modules/reasoning/SPEC.md) (authoritative;
supersedes the design-only §9 of `src/assessment/SPEC.md`, which recorded a different instrument —
matrix reasoning — that was not built; see SPEC.md §1 for why this phase implements a different,
explicitly directed scope instead).
**Shape:** content design first (explicitly requested), then engine-first TDD, one green commit —
typecheck + lint + Vitest + `npx expo export`.

## Build order (as executed)

1. **Content design** — base-rate scenario frames, hypothesis prompts, disconfirmation claims,
   calibration item bank, all embedded as examples directly in SPEC.md §2 before any code.
2. **`engine/reasoning/`** — pure, framework-free, all Vitest-covered:
   - `baseRate.ts` — item generation from "nice" percentage sets, answer scoring across the two
     format contracts, run aggregation split by format.
   - `hypotheses.ts` — exact-text fluency scoring.
   - `disconfirmation.ts` — self-rating aggregation with a `skipped` state distinct from `no`.
   - `calibration.ts` — Brier score, the reliability curve (content-free — a trial is just
     `{ confidencePct, correct }`).
   - `seed.ts` — structural proxies → normalized → reasoning Elo.
3. **`modules/reasoning/`** — content banks (`hypothesesBank.ts`, `disconfirmationBank.ts`,
   `calibrationBank.ts`, `baseRateCopy.ts`), `copy.ts` (+ its own honesty test), `results.ts`
   (assessment rows + Elo reseed, tested against a real sql.js DB), then the four screens and
   `CalibrationChart.tsx`.
4. **Routes** `app/modules/reasoning/{index,base-rate,hypotheses,disconfirmation,calibration}.tsx`;
   modules hub, `[module].tsx` fallback, and dashboard updated.

## Decisions worth keeping

- **This is a different scope than `assessment/SPEC.md` §9 recorded**, not an implementation of it.
  §9's deferred default was procedurally generated matrix reasoning; that is explicitly not built.
  Recorded plainly in both the module SPEC and an updated §9, the same treatment the PVT's superseded
  ISI got in Phase 6.1 — a correction stated at its source, not silently overwritten.
- **Base-rate items generate the answer from the same rounded counts the frequency framing displays**,
  not from unrounded Bayes — otherwise a probability-format item and its frequency-format twin could
  disagree on the "correct" answer by a rounding error. Tested directly
  (`baseRate.test.ts`, "a probability-format item and its frequency-format twin agree").
- **The base-rate answer contract differs by format** (a percentage vs. a count out of the shown
  total) and is documented as the one non-obvious API decision in that file.
- **Calibration content bug caught during design, not after**: every hand-authored item was written
  with the correct answer as `optionA` — natural for authoring, but it would make on-screen position a
  perfect tell (always tap the first option). Fixed with a per-item, per-run position swap
  (`generateCalibrationRun`/`resolveCalibrationChoice` in `calibrationBank.ts`), asserted with a test
  that simulates an "always pick first" strategy and confirms it does not land at 100%.
- **Fluency is not correctness, and disconfirmation quality is self-rated, not graded** — both stated
  explicitly in copy, guarded by this module's own `copy.test.ts` in addition to the repo-wide
  `assessment/copy-honesty.test.ts` scanner. Neither task's engine layer has any way to judge the
  _content_ of a free-text answer, so copy never implies it does.
- **A "running" calibration curve is not a separate code path.** `calibrationCurve` is a pure function
  of a trial array; `results.ts`'s `allCalibrationTrials` concatenates every historical row's stored
  trials and feeds the same function. Tested directly.
- **Both score imputations are stated, never silent**: a `skipped` disconfirmation prompt is excluded
  from the mean but counted separately (never reads the same as an all-"no" run); an omitted
  calibration confidence bucket (zero trials) is left off the curve rather than shown at 0% (never
  misrepresents "never used" as "always wrong").
- **Doc/code drift guard applied proactively** (per the user's stated preference from the attention
  slice): `specSync.test.ts` derives every documented number from its engine constant and asserts both
  `assessment/SPEC.md` and this module's own SPEC.md contain it. Mutation-tested (a constant change
  fails the guard by name) before commit.

## Follow-ups (not in this slice)

- Matrix reasoning (`assessment/SPEC.md` §9's original default) remains recorded and un-built.
- Empirical-z switch activates per instrument at `N_MIN` = 200 rows; until then every reasoning score
  seeds Elo through the structural proxies in `seed.ts`.
- No UI verification was possible in this sandbox (headless Chromium can't open IndexedDB here) — the
  four screens need one manual pass in a real browser via `npm run web`.
