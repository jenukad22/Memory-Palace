# Baseline Assessment — Specification (Phase 3)

**Date:** 2026-07-19
**Status:** Decisions resolved. Phase 3 implements the **memory** module only (§3–§5). §6/§7/§9 are
**deferred — design only**. Screens blocked on DESIGN.md; engine modules unblocked.
**Scope (implemented):** VVIQ, digit span (forward + backward), Corsi (forward + backward) —
administration, stopping, scoring, and raw→Elo seeding, plus the VVIQ routing rule.
**Non-scope:** Screens/UI (DESIGN.md), the expo-router app shell, training-loop scheduling, and the
deferred instruments (§6/§7/§9).

---

## 0. Honesty and content constraints (binding)

These govern every formula, string, and asset in this phase.

- **Task-specific reporting only.** Every result describes performance on that task — span length,
  vividness rating, sequence recall. No identifier, copy, or notification may imply general
  intelligence, IQ, memory "age", health, or diagnosis (CLAUDE.md). Analytics names describe the task
  (`digitspan_forward_span_recorded`, not `iq_estimate`).
- **No proprietary test material.** We implement published _paradigms_, not their copyrighted content:
  - Digit span: Wechsler-style **paradigm** only (two trials per length, discontinue after both fail,
    span = longest length reproduced). **We generate our own random digit sequences.** No Pearson item
    lists, administration scripts, or norm tables.
  - VVIQ: Marks' **structure** only (16 items, 1–5 rating, 16–80 total, 4 scene-groups of 4). **We
    write our own item wording.** No reproduction of Marks' item text.
  - Corsi: the classic **9-block spatial layout** is public and may be followed; sequences are ours.
- **Norm figures are orientation only, and are NOT imported as a scoring basis.** Adult lab figures
  (spoken-recall digit span ≈ 7±2; Corsi ≈ 5) come from administration methods not comparable to our
  typed/tapped, self-administered variants. They may appear in internal docs for orientation but
  **never** in user-facing copy, and **never** as constants in our scoring or normalization
  (this is why §2.1 rejects bootstrap norm constants). **The normative reference is our own accumulating
  data.** For a single user, **within-user change over time is the meaningful signal**, not a cross-user
  z-score; the dashboard reflects that.

---

## 1. Instruments, modules, and the baseline flow

Phase 3 implements the **memory** module only. `attention` and `reasoning` modules don't exist yet
(Phases 6.1/6.2), so their instruments are deferred (§6/§7/§9) — designed here, not built.

**Implemented instruments (five `assessments.instrument` values):**

| Module   | Instruments (rows written)                                                   | Role                      |
| -------- | ---------------------------------------------------------------------------- | ------------------------- |
| `memory` | `digitspan_forward`, `digitspan_backward`, `corsi_forward`, `corsi_backward` | seed the `memory` Elo     |
| —        | `vviq`                                                                       | routing only (§8), no Elo |

**Baseline order.** VVIQ → digit span (forward, then backward) → Corsi (forward, then backward).
**Single session**, with the existing **"finish later" checkpoint between instruments** (a user may
stop between instruments and resume; mid-instrument resume is not required). Memory-only keeps the
battery inside the ~13–15 min onboarding budget.

**Module Elo.** `memory` Elo = **equal-weight mean of the four span instruments' normalized scores**
(`digitspan_forward`, `digitspan_backward`, `corsi_forward`, `corsi_backward`), mapped to Elo (§2.3).
**VVIQ is excluded** from the Elo — it is not a performance score and drives routing only (§8).

Each implemented instrument writes one `assessments` row (`instrument`, `raw_score`, `normalized`, `ts`)
via the Phase 2 query layer. `normalized` is **null** in this phase (§2.1).

---

## 2. raw → normalized → starting-Elo (cross-cutting)

### 2.1 Normalization — **deferred empirical z, with a monotonic proxy until then**

Decision: **option (b), defer.** We do **not** import lab bootstrap constants (§0 forbids them as a
scoring basis). Concretely:

- Store `raw_score`; leave `assessments.normalized = null`.
- Until `N ≥ N_MIN` valid samples exist **per instrument**, seed Elo from raw via the **fixed monotonic
  proxy** below (not persisted — computed on the fly for seeding).
- At `N ≥ N_MIN`, switch that instrument to **empirical z** `= (raw − μ) / σ` over its accumulated
  `assessments` rows (and `normalized` may then be persisted).
- **`N_MIN = 200`** valid samples per instrument.

**Monotonic proxy (span → normalized proxy) — explicit and testable.** Span instruments have achievable
span in `[0, MAX_SPAN]` with `MAX_SPAN = 9`.

```
proxy(span) = clamp((span − SPAN_MID) / SPAN_SPREAD, −Z_CAP, +Z_CAP)
  SPAN_MID    = 4.5    // structural midpoint of the achievable range [0, 9]
  SPAN_SPREAD = 2.25   // maps the full range to ≈ [−2, +2]
  Z_CAP       = 3
```

`SPAN_MID`/`SPAN_SPREAD` are **structural scalings of the achievable-span axis**, chosen so Elo seeds
spread sensibly — **not** population statistics and **not** derived from any lab norm. They are
superseded per-instrument by empirical z at `N_MIN`. The same proxy applies to all four span
instruments (shared `[0, 9]` scale).

### 2.2 Where the math lives

All scoring, sequence generation, stopping-rule evaluation, normalization, and Elo seeding are **pure
functions in `/src/engine`** (framework-free, unit-tested per CLAUDE.md). `/src/assessment` screens only
present stimuli and collect raw responses. New engine modules (this phase):
`src/engine/assessment/` — `sequences.ts` (digit + Corsi generation), `scoring.ts` (span from trials,
VVIQ total), `normalize.ts` (proxy + empirical z + switch), `seedElo.ts` (normalized → Elo, module mean,
provisional-K). Each with `*.test.ts`.

### 2.3 normalized → starting-Elo — resolved

```
elo = clamp(ELO_MIDPOINT + z · ELO_PER_SD, ELO_MIN, ELO_MAX)
  ELO_MIDPOINT = 1200
  ELO_PER_SD   = 200
  ELO_MIN      = 400
  ELO_MAX      = 2400
```

where `z` is the module's combined normalized score (mean of the four span proxies/z-scores). Feeds
`upsertAbility(db, 'memory', elo)`.

**K-factor — resolved (provisional scheme).** `K = 48` for the first **`M = 30`** rated items **per
module**, then `K = 32` (engine `DEFAULT_K_FACTOR`, [elo.ts](../engine/elo.ts)). Baseline seeds are
uncertain enough to justify faster early correction. `provisionalK(ratedItemCount)` lives in the engine;
the training loop (later phase) applies it.

---

## 3. VVIQ — visual imagery (routing instrument, not scored into Elo)

**Paradigm (Marks 1973 structure; our wording).** 16 items in 4 groups of 4 scenes; each rated 1–5;
total 16–80. **Higher = more vivid** (VVIQ2 direction). We author our own scene descriptions (e.g. a
rising sun, a familiar face) and 1–5 anchors ("No image at all" … "Perfectly clear and vivid as real
seeing").

**Administration.** All 16 items, self-paced, **single eyes-open pass** (no eyes-closed pass). No time
limit.

**Stopping.** Fixed: all 16 items answered.

**Scoring.** `raw = Σ(16 items)`, range 16–80. **Not** seeded into Elo. Written as an `assessments` row
`instrument = 'vviq'`, `raw_score = total`, `normalized = null`.

**Routing.** `raw ≤ 32` → non-visual strategy (§8). Threshold **≤ 32**, higher = more vivid.
_Orientation only:_ ≤ 32 is the commonly cited aphantasia range (Zeman et al.) — used for routing, never
as a diagnosis.

---

## 4. Digit span — verbal working memory (forward + backward)

**Paradigm (Wechsler-style; our sequences).** Digits shown one at a time; user reproduces by typing.
**Forward** and **backward** are run and stored as **separate instruments** (`digitspan_forward`,
`digitspan_backward`).

**Administration & stopping — resolved.**

- **Two trials per length.** Start at length **3**. Increase by 1 after a length passes.
- **"Reproduced" = at least 1 of 2 trials correct** at that length (consistent with discontinuing only
  after _both_ fail).
- **Discontinue** when both trials at a length fail. **`span = longest length reproduced`.**
- **Max length cap = 9.**
- Backward: same rules; the user reproduces the sequence in reverse order.

**Sequence generation — resolved.** Uniform random digits 0–9; constraints: **no immediately repeated
digit**, and **not a strictly ascending or descending run**. **Seeded / deterministic** for tests
(engine `sequences.ts`).

**Scoring.** `raw = span`. **Timing:** each digit displayed **800 ms + 200 ms gap** (~1 digit/sec).
Per-trial detail (which trials passed at each length) is retained for the future `assessments.payload`
column (§12 follow-up) but is not the raw score.

---

## 5. Corsi block-tapping — visuospatial working memory (forward + backward)

**Paradigm (Corsi 1972; standard 9-block layout).** Nine blocks in the classic irregular arrangement; a
sequence of blocks highlights in order; user taps them back. **Forward** and **backward** stored as
separate instruments (`corsi_forward`, `corsi_backward`).

**Administration & stopping — resolved.** Same span structure as §4: two trials per length,
**1-of-2 "reproduced" criterion**, discontinue after both fail, `span = longest reproduced`.
**Start length 2.** Max length 9. Backward: reproduce in reverse tap order.

**Sequence generation — resolved.** Random ordering over the 9 fixed positions; **arbitrary jumps
allowed** (no path-crossing or adjacency constraints); only constraint is **no immediate repeat of a
block**. Seeded / deterministic for tests.

**Scoring.** `raw = span`. **Kessels "total" (span × correct sequences) is not the raw score** —
per-trial counts go to the future `payload` column (§12 follow-up). **Timing:** each block highlighted
**1000 ms on / 250 ms gap.**

---

## 6. N-back — **DEFERRED (design only, not built in Phase 3)**

Belongs to the `attention` module (Phase 6.1). Recorded design for when it lands; **no engine code,
screens, or `assessments` rows now.** When implemented (all still CONFIRM at that time): fixed **2-back**
baseline, single-letter stimuli, ~30% target rate, fixed trial count, primary raw = **d′** (loglinear
edge-corrected).

---

## 7. PVT — **DEFERRED (design only, not built in Phase 3)**

Belongs to the `attention` module (Phase 6.1). Recorded deferred defaults for when it lands; **not
built now:** **PVT-B (3 min)**, random ISI 2–10 s, **lapse threshold 355 ms**, primary metric =
**response speed (mean 1/RT)**. False starts (RT < 100 ms or pre-stimulus) excluded from RT stats.

---

## 8. VVIQ ≤ 32 routing rule — resolved (substitute strategy)

The memory palace (method of loci) depends on voluntary visual imagery. Users in the low-imagery range
can't use it as written.

**Trigger.** `vviq_total ≤ 32` (higher = more vivid).

**Action — option (a), substitute strategy.** Replace the visual method-of-loci instructions with a
**non-visual path**: **spatial-motor route encoding** (encode by an imagined _movement/route_ rather
than a pictured scene) **plus verbal/semantic elaboration**, applied to the **same cards and the same
schedule**. **FSRS and Elo are untouched** — only the instructional/encoding guidance changes.

**Reversibility.** The strategy flag **derives from the most recent VVIQ result and is not sticky** — if
the user retakes VVIQ and scores > 32, they get the visual path. (Storage is a tracked follow-up — §12.)

**Copy.** No user-facing string labels the user "aphantasic" or implies a deficit. Copy is strictly
"we'll use a strategy that fits how you think."

---

## 9. Reasoning — **DEFERRED (design only, not built in Phase 3)**

Belongs to the `reasoning` module (Phase 6.2). Recorded deferred defaults for when it lands; **not built
now:** **procedurally generated matrix reasoning** (abstract 3×3, rule-based missing cell; no SPM/APM
content), **fixed 12-item graded set**, raw = number correct.

---

## 10. Data written per instrument

Each completed implemented instrument writes one `assessments` row via
`insertAssessment(db, { instrument, rawScore, normalized })` — `normalized` **null** this phase (§2.1).
After the four span instruments complete, one `upsertAbility(db, 'memory', elo)` seeds the module Elo.

The baseline runs inside a `sessions` row (`startSession`/`endSession`). **`sessions.accuracy` is left
`0` and is meaningless for battery sessions** — accuracy is a training-loop metric, not a battery one.
We do **not** churn the schema for it.

---

## 11. Engine ↔ screen division

- **Engine (this phase's testable core, built now):** digit + Corsi sequence generation, span-from-trials
  scoring, VVIQ total, the monotonic proxy + empirical-z switch, module-mean + Elo seeding + provisional-K.
  All in `src/engine/assessment/`, each with Vitest coverage. **Not blocked on design.**
- **Screens (`/src/assessment/*`):** presentation + raw-response capture only. **Blocked on DESIGN.md** —
  digit-span pad, Corsi grid, VVIQ Likert built from `/src/ui` tokens, not styled ad hoc.
- **App shell:** expo-router (`app/`) entry, scaffolded separately (recorded, not part of this spec).

---

## 12. Resolved decisions + tracked follow-ups

**All CONFIRM items are resolved above.** Summary of the binding numbers: baseline order VVIQ →
digitspan(F,B) → corsi(F,B), single session with finish-later checkpoints; `memory` Elo = equal-weight
mean of the four span proxies, VVIQ excluded; normalization deferred (option b), `N_MIN = 200`, monotonic
proxy `SPAN_MID 4.5 / SPAN_SPREAD 2.25 / Z_CAP 3`; Elo `MIDPOINT 1200 / PER_SD 200 / MIN 400 / MAX 2400`;
`K = 48` for first `M = 30` rated items then 32; VVIQ eyes-open single pass, threshold ≤ 32 (higher =
vivid); digit span start 3, Corsi start 2, 1-of-2 reproduced, cap 9, forward+backward as separate rows,
raw = span; digit timing 800/200 ms, Corsi 1000/250 ms; routing = substitute non-visual strategy,
non-sticky; `sessions.accuracy` = 0 for batteries.

### Tracked follow-ups (one migration, handled Phase-2 style: spec → plan → TDD → green commit)

Both land **before** any `assessments` rows are written, so no backfill is needed:

1. **`assessments.payload` (nullable JSON text) column.** Per-trial detail — per-length trial
   pass/fail, partial-credit counts, and later PVT per-trial RTs — currently discarded by the single
   `raw_score`. Cheaper to add before rows exist; enables re-analysis and the future empirical-z switch.
2. **VVIQ routing-flag storage.** Where the derived strategy (`visual` | `non-visual`) lives. Since it
   derives from the most recent VVIQ result and isn't sticky, it may be computed on read rather than
   stored — the follow-up decides storage vs. derivation. No schema exists for it today.

These two are a **separate migration + engine/query cycle**, not part of the Phase 3 engine modules
below, which depend only on the existing schema.
