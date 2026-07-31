# Plan — Attention module (Phase 6.1)

**Design:** [src/modules/attention/SPEC.md](../../../src/modules/attention/SPEC.md) (authoritative;
supersedes the design-only §7 of `src/assessment/SPEC.md`).
**Shape:** engine-first, TDD, one green commit — typecheck + lint + Vitest + `npx expo export`.

## Build order (as executed)

1. **SPEC** — three tasks, the timing discipline (§3), no new tables.
2. **`engine/attention/`** — pure, framework-free, all Vitest-covered:
   - `timing.ts` — the paradigm constants (durations, ISI, thresholds, trial counts).
   - `latency.ts` — `OnsetSample` → `TimingProfile`: percentile/median, onset-delay
     summary, quality grade, and the RT uncertainty band.
   - `signalDetection.ts` — probit (Acklam), loglinear d′ and criterion, `maxDPrime`.
     Shared, because the deferred N-back specifies the same estimator.
   - `pvt.ts` — ISI draw, trial classification, `scorePvt`.
   - `cpt.ts` — stream generation (exact distractor count, no adjacency), `scoreCpt`.
   - `flicker.ts` — scene/alternate generation, `scoreFlicker`.
   - `seed.ts` — structural proxies → normalized → attention Elo.
3. **`modules/attention/`** — `clock.ts` (the only platform-timing code), `copy.ts`
   (+ its own honesty test), `results.ts` (assessment rows + Elo reseed, tested
   against a real sql.js DB), then the screens.
4. **Routes** `app/modules/attention/{index,pvt,cpt,flicker}.tsx`; modules hub and
   `[module].tsx` fallback updated; dashboard gains an Attention section.

## Decisions worth keeping

- **PVT-B ISI is 1–4 s, not the 2–10 s recorded in `assessment/SPEC.md` §7.** The
  recorded pair mixed the 10-minute PVT's interval with the 3-minute variant's
  duration and would have yielded ~30 trials. Recorded as a deviation in SPEC §1
  and annotated at the original site.
- **RT is measured from the painted frame, not the timer.** Scheduler drift moves
  when a trial starts; it never becomes reaction time. This is why drift is
  reported as its own number (SPEC §3.1).
- **Device input latency is disclosed, not estimated.** It cannot be measured from
  inside the app, so it is stated on every result screen and the comparison the
  numbers support ("your runs on this device") is spelled out.
- **No live counter during the PVT stimulus.** The classic PVT-192 shows one;
  re-rendering text at 60 fps would inflate the number being measured.
- **d′ has a documented residual at 90/30 trial counts** (±0.40, 8.6 % of the
  ceiling, signed by response bias; exactly 0 at equal N). Asserted in tests and
  shown on screen as "d′ of ceiling" rather than as a bare number.
- **Both imputations are stated, never silent**: PVT non-responses at the 3 s
  timeout, unfound flicker changes at the 60 s limit. Without them, quitting
  early outscores trying.
- **Flicker responses are localizing taps**, so a detection cannot be claimed
  without pointing at the change.
- **Unscorable runs are not written.** `recordPvtRun` and friends return null
  rather than storing a row that looks like a result.

## Follow-ups (not in this slice)

- N-back (`assessment/SPEC.md` §6) — the d′ engine it needs is already here.
- Empirical-z switch activates per instrument at `N_MIN` = 200 rows; until then
  every attention score seeds Elo through the structural proxies in `seed.ts`.
- No UI verification was possible in this sandbox (headless Chromium can't open
  IndexedDB here, so DB-backed screens render the app's own error state) — the
  three screens need one manual pass in a real browser via `npm run web`.
