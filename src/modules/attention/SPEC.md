# Attention module — SPEC

Three timed attention tasks under the `attention` domain (Phase 6.1 of
[ROADMAP.md](../../../ROADMAP.md); supersedes the design-only §7 of
[assessment/SPEC.md](../../assessment/SPEC.md)):

1. **PVT-B** — a 3-minute brief psychomotor vigilance task. Simple reaction time
   to an unpredictable stimulus; lapse threshold 355 ms.
2. **CPT (go/no-go)** — a letter stream: respond to every target, withhold on the
   designated distractor. Commission errors (a press on a distractor) and
   omission errors (a missed target) are both recorded.
3. **Change-blindness flicker** — two versions of an abstract scene alternate
   with a blank between them; one element differs. The user finds it by tapping
   it, so a detection is always localization-verified.

All three are **timed tasks whose numbers are only as good as the clock behind
them**, so §3 (timing) is as load-bearing as the scoring rules and is
instrumented and reported per session rather than assumed.

## 0. Honesty constraint (CLAUDE.md, assessment/SPEC.md §0)

Every string reports performance on that task only — reaction time in ms,
response speed in responses/second, lapse count, commission/omission counts,
detection time. Never a general capacity, never a health reading, never a claim
that a gain here transfers anywhere else. In particular:

- **Vigilance-task results are not a sleep, fatigue, or attention-disorder
  readout.** PVT lapses are widely used in sleep research; that literature is
  what the paradigm was validated for, not what one self-administered 3-minute
  run on a phone tells this user. Copy says "lapses in this run", never "you are
  sleep-deprived" or anything screening-flavoured.
- **Commission errors are commission errors**, not "impulsivity".
- Instrument keys and payload fields name the task (`pvtb_response_speed`,
  `cpt_commissions`), never a trait.
- Enforced for `/src/modules` and `/app` by
  [copy-honesty.test.ts](../../assessment/copy-honesty.test.ts) and, for this
  module's result strings specifically, by [copy.test.ts](copy.test.ts).

## 1. Deviation from the deferred design in assessment/SPEC.md §7 (recorded)

§7 recorded, as a deferred default, "**PVT-B (3 min), random ISI 2–10 s**". Those
two numbers are from different instruments: the 2–10 s inter-stimulus interval
belongs to the 10-minute PVT; the 3-minute **B** variant shortens the ISI to
**1–4 s** (Basner, Mollicone & Dinges 2011) precisely so a 3-minute run still
collects a usable number of trials. Keeping both would yield ~30 trials in 3
minutes, roughly a third of what the metrics below need to be stable.

**Resolved here: ISI 1–4 s**, everything else in §7 as recorded (3 min, lapse
threshold 355 ms, primary metric = response speed, false starts excluded from
RT stats). `assessment/SPEC.md` §7 is annotated with a pointer to this section.

## 2. Data model — no new tables

Each completed task writes **one `assessments` row** through the existing
`insertAssessment` path, with all per-trial detail and the run's timing profile
in the existing nullable `payload` JSON column (assessment/SPEC.md §12):

| Instrument | `rawScore`                                                    | Direction     |
| ---------- | ------------------------------------------------------------- | ------------- |
| `pvtb`     | response speed, mean of 1/RT in responses/second              | higher better |
| `cpt`      | d′ (loglinear-corrected)                                      | higher better |
| `flicker`  | mean detection time in ms, misses imputed at the 60 s timeout | lower better  |

`payload` carries `{ metrics, trials, timing }` — the full metric set, the raw
per-trial record (RT, correctness, class), and the measured `TimingProfile`
(§3). Nothing that the raw score compresses away is discarded; re-analysis and
the eventual empirical-z switch (§4) both need it.

After any of the three completes, the `attention` module Elo is reseeded from
the **latest row of each of the three instruments** (`upsertAbility` →
`ability_ratings` + append-only `ability_log`), so the progress dashboard's
existing per-module chart lights up with no dashboard-side special-casing.

## 3. Timing — measured, not assumed

The three tasks report milliseconds. React Native / React Native Web give us a
JavaScript clock and a JavaScript scheduler, neither of which is a
laboratory-grade presentation system. Rather than quietly pretend otherwise,
this module measures what it can, structures the measurement so the largest
error source cannot reach the reaction time, and states the residual.

### 3.1 Reaction time is measured from the painted frame, never from the timer

`setTimeout(isi)` fires late — by a frame under light load, by much more under
GC or a slow re-render. The naive implementation takes the scheduled onset as
t₀ and inherits every millisecond of that drift as fake reaction time.

Instead, every stimulus onset is timestamped **after the commit that shows it**:
the screen sets the stimulus state, and in the post-commit effect calls
`onNextPaint()` ([clock.ts](clock.ts)), which reads the monotonic clock inside a
`requestAnimationFrame` callback — the frame that paints the stimulus. That
timestamp is t₀; the response timestamp is read in the event handler; RT is the
difference.

**Consequence: scheduler drift shifts _when_ a trial starts, not the RT it
records.** ISI jitter is a fidelity issue (the ISI is meant to be
unpredictable anyway); it is not an RT error. This is the single most important
property of the implementation and is why drift is reported as its own number
instead of being folded into the reaction times.

### 3.2 What is measured

Per stimulus, the screen records an `OnsetSample { requestedMs, paintedMs }` —
the clock read immediately before the update that shows the stimulus, and the
clock read on the frame that painted it. The gap between them is
**commit-to-paint latency**, which is what bounds the error on a reaction time:
a JS thread busy enough to delay a paint delays event dispatch too. Timer
lateness is deliberately _not_ part of this number — it shifts when a trial
begins (§3.1) and the PVT's interval is random by design.

`summarizeOnsets` ([engine/attention/latency.ts](../../engine/attention/latency.ts))
reduces the run's samples to a `TimingProfile`:

- `medianDriftMs`, `p95DriftMs`, `maxDriftMs` — painted-minus-requested onset
  delay,
- `lateOnsets` — onsets that missed their frame budget (16.7 ms),
- `highResolutionClock` — whether `performance.now()` was available (else
  `Date.now()`, 1 ms resolution),
- `quality` — `good` (p95 ≤ 1 frame) / `fair` (≤ 3 frames) / `poor` (worse) /
  `unmeasured`,
- `rtUncertaintyMs` — the ± band this module is willing to claim on a single RT.

### 3.3 What cannot be measured, and is therefore disclosed

`rtUncertaintyMs = FRAME_PRESENTATION_MS + clock resolution + p95 drift`:

- **Frame presentation (≈16.7 ms).** `requestAnimationFrame` runs at the start of
  the frame that paints the stimulus; photons follow up to one refresh interval
  later. Not observable from JavaScript.
- **Clock resolution.** `performance.now()` is deliberately coarsened by
  browsers; 1 ms is assumed as a floor.
- **p95 drift.** A busy JS thread that delays a frame also delays event
  dispatch, so measured drift is carried as a proxy for that inflation.

**Device input latency — touchscreen scan, OS input pipeline, event dispatch —
is a positive bias of tens of milliseconds that cannot be measured from inside
the app without external hardware.** It is not estimated, not silently
subtracted, and not hidden: every result screen states that reaction times
include it, and that runs are comparable **to the user's own runs on the same
device**, not to published figures. This is exactly the constraint that
assessment/SPEC.md §0 already applies to span norms.

### 3.4 Deliberate rendering choices that protect the measurement

- **No live millisecond counter during the PVT stimulus.** The classic PVT-192
  displays a counting timer as the stimulus. Re-rendering text at 60 fps
  competes with input handling on the same JS thread and would inflate the very
  number being measured. The stimulus is static; the RT is shown after the
  response instead.
- **`onPressIn`, not `onPress`.** Responses are taken at pointer-down; `onPress`
  waits for release and adds the press duration to every RT.
- **Keyboard responses on web.** A `keydown` on space/enter is accepted and is
  the lower-latency path where available.
- **No per-trial feedback in the CPT block**, and no animation anywhere in the
  response window.

### 3.5 The one-frame race, and where its logic lives

A press can land in the ~16 ms between the app requesting a stimulus and the
frame that paints it. Two things must be true then, and both are enforced in
tested code rather than in a screen's branches:

- It is an **anticipation, not a fast reaction.** `classifyPvtPress`
  ([engine/attention/pvt.ts](../../engine/attention/pvt.ts)) returns a false
  start for it and never times it from the _request_ timestamp — doing that
  would manufacture a reaction time out of render latency.
- The pending frame callback must not act on a trial that has already resolved.
  It runs before React's effect cleanup can cancel it, so each callback
  re-checks the live phase before touching timers. Without that check the
  callback overwrote the feedback timer's handle and armed a stray no-response
  timer that fired into the following trial.

## 4. Scoring (all pure, in `/src/engine/attention`)

### 4.1 PVT-B ([pvt.ts](../../engine/attention/pvt.ts))

3 minutes, ISI uniform in [1000, 4000] ms, stimulus times out after 3000 ms.
Trial classification:

| Class        | Condition                                        |
| ------------ | ------------------------------------------------ |
| `falseStart` | press during the ISI, or RT < 100 ms after onset |
| `lapse`      | RT ≥ 355 ms                                      |
| `noResponse` | no press before the 3000 ms stimulus timeout     |
| `valid`      | everything else                                  |

- **Primary raw score: response speed** = mean of 1/RT over every responded
  trial, in responses/second. Lapses are **included** (they are real responses);
  false starts are **excluded** (assessment/SPEC.md §7).
- `noResponse` trials are **imputed at the 3000 ms timeout** for the speed mean
  and counted separately, so a run that stops responding cannot look identical
  to a run with fewer trials. The imputation is stated, never silent.
- Also reported: lapse count and rate, false-start count, median/mean RT,
  fastest-10 % mean RT, slowest-10 % mean RT.

### 4.2 CPT ([cpt.ts](../../engine/attention/cpt.ts))

120 trials, 250 ms stimulus + 1000 ms blank (1250 ms response window), single
consonant per trial. **25 % of trials are the distractor letter** — high enough
that commission rate is estimable from ~30 no-go trials, low enough to keep the
go response prepotent, which is what makes withholding measurable at all. Stream
constraints: exact distractor count, never two distractors in a row, never a
distractor first, no immediate repeat of a go letter.

Reported: hits, omissions, commissions, correct rejections; hit/omission/
commission rates; mean and SD of hit RT and its coefficient of variation; **d′
and criterion c** via the loglinear correction (Hautus 1995 — add 0.5 to each
count, 1 to each total), which keeps d′ finite at ceiling/floor.

**Recorded limitation.** The loglinear correction is exactly unbiased only when
signals and noise are equally frequent. At this task's 90 go / 30 no-go split a
responder with no sensitivity reads **d′ = ±0.40** rather than 0 — +0.40 pressing
at everything, −0.40 pressing at nothing, 0 for a coin flip — which is 8.6 % of
the 4.68 ceiling and signed by the response bias that `criterion` reports next to
it. The floor for "discriminated nothing" is therefore |d′| ≈ 0.4, not 0. It is
asserted in `signalDetection.test.ts` so it cannot drift unnoticed, and it is why
the result screen shows d′ **against its ceiling** rather than as a bare number.
[signalDetection.ts](../../engine/attention/signalDetection.ts) is shared, not
CPT-private: the deferred N-back (assessment/SPEC.md §6) specifies the same
loglinear d′.

### 4.3 Flicker ([flicker.ts](../../engine/attention/flicker.ts))

Rensink-style flicker paradigm: scene A (500 ms) → blank (80 ms) → scene A′
(500 ms) → blank (80 ms), repeating (cycle = 1160 ms) until the user taps the
element that differs or the trial times out at 60 s. 4 trials.

**We generate our own abstract scenes** — a grid of shapes with colour, size and
presence attributes — rather than shipping photographs, for the same reason
assessment/SPEC.md §0 gives for digits and Corsi sequences. Exactly one element
differs, by exactly one attribute (`color` | `size` | `presence`).

Responding by **tapping the changed element** rather than pressing a "found it"
button means a detection cannot be claimed without localizing the change; a tap
on an unchanged element is recorded as a false tap and the trial continues.
Reported: detection rate, median/mean detection time, median cycles to detect,
false taps, and the raw score — mean detection time with missed trials imputed
at the 60 s timeout (again, stated).

### 4.4 Normalization and Elo ([seed.ts](../../engine/attention/seed.ts))

Same two-stage rule as the span instruments (assessment/SPEC.md §2.1): a fixed
**monotonic proxy** until `N_MIN` (200) samples exist for an instrument, then
empirical z over the accumulated rows. Each proxy is a **structural scaling of
the task's own achievable axis — not a population statistic and not a lab
norm**, exactly as `SPAN_MID`/`SPAN_SPREAD` are:

| Instrument | Axis midpoint                                                    | Spread                 |
| ---------- | ---------------------------------------------------------------- | ---------------------- |
| `pvtb`     | the speed at the task's own lapse threshold (1000/355 ≈ 2.82 /s) | 1.0 /s                 |
| `cpt`      | half the loglinear d′ ceiling for this trial count               | a quarter of it        |
| `flicker`  | half the 60 s timeout (30 s), inverted so faster is higher       | a quarter of it (15 s) |

The `attention` Elo is the equal-weight mean of whichever of the three
normalized scores exist, mapped through the shared `eloFromNormalized`. Tasks
can be taken in any order and individually; a module Elo appears as soon as one
has been completed.

## 5. Layer map

- `engine/attention/` — `timing.ts` (presentation constants), `latency.ts`
  (drift/uncertainty math), `signalDetection.ts` (probit, loglinear d′/c),
  `pvt.ts`, `cpt.ts`, `flicker.ts`, `seed.ts`. Framework-free, each with Vitest
  coverage (CLAUDE.md `/src/engine` rule).
- `modules/attention/` — `clock.ts` (the only platform-touching timing code:
  `performance.now`, `requestAnimationFrame`), `copy.ts` (+honesty test),
  `results.ts` (instrument keys, payload builders, Elo reseed), the three
  screens, `TimingReport.tsx`, `FlickerBoard.tsx`.
- `app/modules/attention/` — hub + one route per task.
- Dashboard: `ModuleProgressSection` gains an optional retention section
  (attention has no scheduled cards, so an empty FSRS curve would be noise) and
  the dashboard renders an Attention section from the same Elo/streak/trend
  parts the memory section already uses.
