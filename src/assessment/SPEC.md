# Baseline Assessment — Specification (Phase 3)

**Date:** 2026-07-19
**Status:** Draft — CONFIRM items pending review before any screen work
**Scope:** Administration, stopping, scoring, and raw→normalized→starting-Elo mapping for the six
baseline instruments (VVIQ, digit span, Corsi, N-back, PVT, reasoning), plus the VVIQ routing rule.
**Non-scope:** Screens/UI (waits for DESIGN.md), the expo-router app shell, training-loop scheduling.

---

## 0. Honesty and content constraints (binding)

These govern every formula, string, and asset in this phase.

- **Task-specific reporting only.** Every result describes performance on that task — reaction time,
  span length, accuracy, d′, sequence recall. No identifier, copy, or notification may imply general
  intelligence, IQ, memory "age", health, or diagnosis (CLAUDE.md). Analytics names describe the task
  (`digitspan_span_recorded`, not `iq_estimate`).
- **No proprietary test material.** We implement published _paradigms_, not their copyrighted content:
  - Digit span / working-memory span: Wechsler-style **paradigm** only (two trials per length,
    discontinue after both fail, span = longest length reproduced). **We generate our own random digit
    sequences.** No Pearson item lists, administration scripts, or norm tables.
  - VVIQ: Marks' **structure** only (16 items, 1–5 rating, 16–80 total, 4 scene-groups of 4). **We
    write our own item wording.** No reproduction of Marks' item text.
  - Corsi: the classic **9-block spatial layout** is public and may be followed; sequences are ours.
  - Raven-style reasoning: **no** SPM/APM items. We author or procedurally generate our own.
- **Norm figures are orientation only.** Any adult figure cited below (e.g. forward digit span ≈ 7±2;
  Corsi ≈ 5) comes from **lab administration with spoken/manual recall** and is **not** our scoring
  basis. Our typed/tapped, self-administered variants are not clinically comparable. **Per the plan,
  the normative reference is our own accumulating data** (§2). Orientation figures may appear in
  internal docs but **never** in user-facing copy, and never framed as a target or a diagnosis.

---

## 1. Instruments, modules, and the baseline flow

Six instruments seed three module ability ratings (`ability_ratings.elo`, keyed by `module`):

| Module      | Instruments (baseline)                    |
| ----------- | ----------------------------------------- |
| `memory`    | VVIQ (imagery routing), digit span, Corsi |
| `attention` | PVT, N-back                               |
| `reasoning` | reasoning                                 |

**Baseline order (CONFIRM ordering):** VVIQ → digit span → Corsi → PVT → N-back → reasoning. Rationale:
VVIQ first because it gates the memory-palace instruction path (§8); PVT before N-back so vigilance is
measured before a demanding WM task fatigues the user. **CONFIRM** whether all six run in one baseline
session or are split across sessions (fatigue: full battery is long — see per-instrument durations).

**Combining instruments into a module Elo (CONFIRM).** Each instrument yields a normalized score (§2);
a module's starting Elo is seeded from its instruments. Proposed: **equal-weight mean of the
instruments' normalized scores**, then mapped to Elo (§2.3). VVIQ is **not** a performance score and is
**excluded** from the `memory` Elo — it only drives routing (§8). **CONFIRM** weights (e.g. whether
digit span and Corsi are equally weighted in `memory`).

Each instrument also writes one `assessments` row (`instrument`, `raw_score`, `normalized`, `ts`) via
the Phase 2 query layer. `normalized` is null until the normalization reference exists (§2.1).

---

## 2. raw → normalized → starting-Elo (cross-cutting)

### 2.1 Normalization reference — **CONFIRM**

Per the plan, **the norm reference is our own accumulating per-instrument distribution**. Definition:
`normalized = z = (raw − μ_instrument) / σ_instrument`, where μ/σ come from all prior valid
`assessments` rows for that instrument (optionally most-recent-N). Higher normalized = better on that
task's own terms (for RT-type raw scores, invert so higher = better — see per-instrument).

**Cold-start problem — CONFIRM.** With few users there is no stable μ/σ. Options:

- **(a) Bootstrap constants**, clearly labeled provisional, from orientation literature, used only until
  `N ≥ N_min` valid samples exist per instrument, then switch to empirical μ/σ. **CONFIRM N_min** (e.g. 100) and the bootstrap μ/σ per instrument.
- **(b) Defer normalization**: store `raw_score`, leave `normalized = null`, seed Elo from raw via a
  fixed monotonic map until the reference exists.
  Recommended: **(a)** with provisional constants flagged in-code as orientation, never user-visible.

### 2.2 Where the math lives

All scoring, sequence generation, stopping-rule evaluation, normalization, and Elo seeding are
**pure functions in `/src/engine`** (framework-free, unit-tested per CLAUDE.md). `/src/assessment`
screens only present stimuli and collect raw responses. New engine modules (proposed):
`assessment/` under engine — `sequences.ts` (digit/Corsi/n-back generation), `scoring.ts` (per-instrument
raw scores), `normalize.ts` (z + bootstrap), `seedElo.ts` (normalized → Elo). Each with `*.test.ts`.

### 2.3 normalized → starting-Elo — **CONFIRM**

Map a module's combined normalized score `z` to a starting Elo:
`elo = ELO_MIDPOINT + z · ELO_PER_SD`, clamped to `[ELO_MIN, ELO_MAX]`.
Proposed constants (**CONFIRM all**): `ELO_MIDPOINT = 1200`, `ELO_PER_SD = 200`, `ELO_MIN = 400`,
`ELO_MAX = 2400`. These feed `upsertAbility(db, module, elo)`.
**K-factor — CONFIRM.** Engine default is `DEFAULT_K_FACTOR = 32` ([elo.ts](../engine/elo.ts)). Baseline
seeds are uncertain, so a **provisional-rating scheme** is proposed: higher K (e.g. 48) for the first
`M` training items, decaying to 32. **CONFIRM** K schedule and `M`, or accept fixed 32.

---

## 3. VVIQ — visual imagery (routing instrument, not scored into Elo)

**Paradigm (Marks 1973 structure; our wording).** 16 items in 4 groups of 4 scenes; each rated 1–5;
total 16–80. **Higher = more vivid** (VVIQ2 convention). We author our own item text describing scenes
to visualize (e.g. a rising sun, a familiar person's face) and the 1–5 anchors ("No image at all" …
"Perfectly clear and vivid as real seeing").

**Administration.** All 16 items, self-paced, single eyes-open pass (**CONFIRM** whether to also run the
traditional eyes-closed pass — doubles length; recommend single pass for baseline). No time limit.

**Stopping.** Fixed: all 16 items answered. No discontinue rule.

**Scoring.** `raw = Σ(16 items)`, range 16–80. Not z-normalized and **not** seeded into `memory` Elo;
VVIQ drives routing only (§8). Stored as an `assessments` row with `instrument = 'vviq'`,
`raw_score = total`, `normalized = null`.

**Orientation only:** population mean ≈ 60–75; the commonly cited **aphantasia cutoff is ≤ 32**
(Zeman et al.). We use ≤ 32 for routing (§8), **not** as a diagnosis. **CONFIRM** the exact threshold
and scoring direction (if we adopt reverse 1=vivid…5=none scoring instead, the comparator flips).

---

## 4. Digit span — verbal working memory

**Paradigm (Wechsler-style; our sequences).** Sequences of single digits (0–9) shown one at a time;
user reproduces by typing. **Two trials per length.** Start at length **3** (**CONFIRM** start length).
Increase length by 1 after a length passes.

**Stopping — CONFIRM.** Discontinue when **both trials at a length fail**. `span = longest length
reproduced`. **CONFIRM the "reproduced" criterion:** 1-of-2 correct vs 2-of-2 correct at that length.
Also **CONFIRM** max length cap (e.g. 9) and whether **backward** span is included (recommend forward
only for baseline; backward is a separate, harder instrument — **CONFIRM**).

**Sequence generation — CONFIRM constraints.** Uniform random digits 0–9; proposed constraints: no
immediately repeated digit, and not a strictly ascending/descending run. Deterministic under a seed for
test reproducibility (engine `sequences.ts`). **CONFIRM** constraints.

**Scoring.** `raw = span` (longest length reproduced). Optional partial-credit variant (# correct
trials) — **CONFIRM** which is the raw score. Presentation timing: one digit per ~1000 ms with ~1000 ms
ISI (**CONFIRM** timing).

**Orientation only:** spoken-recall forward span ≈ 7±2 (Miller 1956) — not comparable to typed recall;
scored against our own distribution.

---

## 5. Corsi block-tapping — visuospatial working memory

**Paradigm (Corsi 1972; Kessels et al. 2000 scoring; standard 9-block layout).** Nine blocks in the
classic irregular arrangement; a sequence of blocks highlights in order; user taps them back. Same
span structure as digit span: **two trials per length, discontinue after both fail, span = longest
reproduced.** Start length **2** (**CONFIRM**).

**Stopping — CONFIRM.** Identical criterion decision as §4 (1-of-2 vs 2-of-2). Max length = 9.

**Sequence generation — CONFIRM.** Random ordering over the 9 fixed positions; proposed constraints: no
immediate repeat of a block; **CONFIRM** whether to forbid path self-crossing or adjacent-only hops
(classic Corsi allows arbitrary jumps — recommend arbitrary). Seeded/deterministic for tests.

**Scoring.** `raw = Corsi span`. Optional **Corsi total = span × number of correctly reproduced
sequences** (Kessels) — **CONFIRM** raw definition. Highlight timing ~1000 ms on / ~250 ms gap
(**CONFIRM**).

**Orientation only:** Corsi span ≈ 5 in lab settings — not our scoring basis.

---

## 6. N-back — working-memory updating (attention module)

**Paradigm (Kirchner 1958; Jaeggi et al.).** A stream of stimuli; user responds when the current
stimulus matches the one _n_ back. **CONFIRM** the following, all app-specific:

- **n for baseline:** fixed **2-back** (recommended for a stable baseline) vs adaptive n. **CONFIRM.**
- **Stimulus type:** single letters vs spatial positions (recommend letters for baseline). **CONFIRM.**
- **Block structure:** trials per block and number of blocks (proposed: 20 + n trials × 1–2 blocks).
  **CONFIRM.**
- **Target rate:** ~30% matches. **CONFIRM.**
- **Timing:** stimulus ~500 ms, ISI ~2000 ms. **CONFIRM.**

**Stopping.** Fixed trial count (no staircase at baseline).

**Scoring — CONFIRM.** Primary raw = **d′ = z(hit rate) − z(false-alarm rate)** (signal-detection;
robust to response bias), with edge-correction for 0/1 rates (loglinear). Alternatives: % correct or A′.
**CONFIRM** d′ vs accuracy. For normalization, higher d′ = better (no inversion).

---

## 7. PVT — psychomotor vigilance (attention module)

**Paradigm (Dinges & Powell 1985).** A counter/stimulus appears after a **random ISI of 2–10 s**; user
responds as fast as possible; RT recorded. Repeated for a fixed duration.

**Duration — CONFIRM.** Full PVT is 10 min — too long for an app baseline. Proposed: **PVT-B (3 min)**
or a 5-min variant. **CONFIRM** duration.

**Lapse threshold — CONFIRM.** Standard lapse = RT > **500 ms** (10-min PVT). PVT-B commonly uses
**355 ms**. **CONFIRM** which threshold we adopt (drives the lapse count). False starts (response before
stimulus or RT < 100 ms) are recorded and excluded from RT stats.

**Scoring — CONFIRM primary metric.** Candidates: mean RT, **response speed = mean(1/RT)** (Dinges'
preferred, less skewed), lapse count. Proposed raw = **response speed (1/RT, 1/s)**; for normalization
higher = better (already oriented). **CONFIRM** primary metric and which secondary metrics we persist
(the `assessments` row stores one `raw_score`; richer per-trial data is out of scope unless we add a
payload column — **CONFIRM**).

**Stopping.** Fixed duration.

---

## 8. VVIQ ≤ 32 routing rule — **CONFIRM the action**

The memory module's core technique (method of loci / memory palace) depends on **voluntary visual
imagery**. Users in the aphantasia range cannot use it as written.

**Trigger.** `vviq_total ≤ 32` (per §3; **CONFIRM** threshold and scoring direction).

**Action — CONFIRM (this is the key decision).** What specifically changes when triggered? Options:

- **(a) Substitute strategy:** replace visual method-of-loci instructions with a **non-visual mnemonic**
  path (verbal/semantic elaboration or spatial-motor "route by movement" encoding), applied to the same
  cards and schedule. Nothing else changes; FSRS/Elo unaffected.
- **(b) Adapt copy only:** keep the palace but reword instructions to lean on spatial/semantic cues
  rather than "picture vividly".
- **(c) Flag only:** record the flag, change nothing user-facing yet.
  Recommended: **(a)**. **CONFIRM** the exact instructional change and whether it's reversible if the user
  re-takes VVIQ. The routing flag is persisted (**CONFIRM storage** — e.g. a `memory` profile field; no
  schema exists for it yet, so this may need a Phase-2-style follow-up). No user-facing string may label
  the user "aphantasic" or imply a deficit — copy is strictly "we'll use a strategy that fits you."

---

## 9. Reasoning — fluid reasoning (reasoning module)

**Paradigm — CONFIRM (most open instrument).** No SPM/APM content. Candidate self-authored paradigms:

- **Matrix reasoning** (procedurally generated abstract 3×3 matrices with a rule-based missing cell),
- **Number/letter series** (rule-based sequence completion),
- **Verbal analogies** (our item bank).
  Recommended baseline: **procedurally generated matrix reasoning** (language-neutral, infinite items,
  Elo-friendly). **CONFIRM** paradigm(s) and item-generation approach.

**Administration & stopping — CONFIRM.** Options: **fixed set** (e.g. 12 items of graded difficulty) vs
**adaptive** (Elo/IRT-driven item selection, stop when the ability-estimate SE < threshold or after a
max item count). Recommend **fixed 12-item graded set** for a deterministic baseline; adaptive selection
belongs to the training loop. **CONFIRM** item count and difficulty grading.

**Scoring — CONFIRM.** Raw = number correct (0–12) for a fixed set, or the Elo/IRT ability estimate for
adaptive. Higher = better. **CONFIRM.**

---

## 10. Data written per instrument

Each completed instrument writes one `assessments` row through the Phase 2 query layer:
`insertAssessment(db, { instrument, rawScore, normalized })` — `normalized` null until the reference
exists (§2.1). Module Elo seeding calls `upsertAbility(db, module, elo)` once per module after its
instruments complete. Baseline runs inside a `sessions` row (`startSession`/`endSession`) with
`items = instruments completed`, `accuracy` left 0 or a battery-completion proxy (**CONFIRM** what
`accuracy` means for a mixed battery, or leave 0).

---

## 11. Engine ↔ screen division (forward reference)

- **Engine (this phase's testable core):** sequence generation, per-instrument scoring, d′/RT math,
  normalization, Elo seeding, stopping-rule evaluation, VVIQ threshold check. All in `/src/engine`,
  each with Vitest coverage. **This is what Phase 3 implementation builds first.**
- **Screens (`/src/assessment/*`):** presentation and raw-response capture only. **Blocked on DESIGN.md**
  — the digit-span pad, Corsi grid, VVIQ Likert, PVT reaction surface, and n-back stream are built from
  `/src/ui` tokens/components, not styled ad hoc.
- **App shell:** expo-router (`app/`) entry, scaffolded separately (recorded, not part of this spec).

---

## 12. Consolidated CONFIRM list (review before screens)

**Framework**

1. Baseline ordering and single-session vs split (§1).
2. Module→Elo combination weights; VVIQ excluded from `memory` Elo (§1).
3. Normalization reference: empirical z; cold-start bootstrap (a) vs defer (b); `N_min`; provisional μ/σ (§2.1).
4. Elo seeding constants: `ELO_MIDPOINT/PER_SD/MIN/MAX` (§2.3).
5. K-factor schedule (provisional-K vs fixed 32) and `M` (§2.3).

**Per-instrument** 6. VVIQ: eyes-open only vs +eyes-closed; threshold + scoring direction (§3, §8). 7. Digit span: start length; "reproduced" = 1-of-2 vs 2-of-2; max cap; forward-only vs +backward; sequence constraints; timing; raw = span vs partial-credit (§4). 8. Corsi: start length; reproduced criterion; sequence constraints; raw = span vs Kessels total; timing (§5). 9. N-back: n level; stimulus type; block/trial counts; target rate; timing; raw = d′ vs accuracy (§6). 10. PVT: duration (PVT-B 3-min?); lapse threshold (500 vs 355 ms); primary metric (1/RT vs mean RT vs lapses); secondary-metric persistence (§7). 11. Reasoning: paradigm; fixed vs adaptive; item count/grading; raw definition (§9).

**Routing** 12. VVIQ ≤32 action (substitute strategy / adapt copy / flag only) and where the routing flag is stored (no schema yet) (§8).

**Data** 13. What `sessions.accuracy` means for a mixed battery, or leave 0 (§10).
