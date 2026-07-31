# Reasoning module — SPEC

Four training tasks under the `reasoning` domain (Phase 6.2 of
[ROADMAP.md](../../../ROADMAP.md)):

1. **Base-rate items, dual format** — the classic Bayesian base-rate paradigm
   (a rare condition, an imperfect test), each item shown either as
   percentages or as natural frequencies ("out of 1000 people…"). The
   within-user comparison between formats is the point: this is the best
   documented format effect in the judgment-and-decision-making literature
   (Gigerenzer & Hoffrage 1995) — natural frequencies make the same inference
   easier for most people.
2. **Generate multiple hypotheses** — given an ambiguous observation, list as
   many distinct plausible explanations as you can. A fluency drill against
   premature closure on the first explanation that comes to mind.
3. **"What would disconfirm this?"** — given a claim that sounds like it
   explains itself, state one observation that would show it's false. A
   falsifiability drill against unfalsifiable, self-sealing reasoning.
4. **Calibration training** — a confidence rating (50–100%) on every answer to
   a two-choice factual question, scored with a Brier score and a running
   calibration curve (stated confidence vs. actual accuracy).

## 0. Honesty constraint (CLAUDE.md, assessment/SPEC.md §0)

Every string reports performance on that task only. In particular, for this
module:

- **No result is framed as a measure of intelligence, rationality, or
  "critical thinking" as a trait.** Base-rate accuracy is "how close your
  estimate was on these items, in this run." Calibration is a narrow,
  well-defined statistical property of one set of confidence ratings, not a
  reading of judgment in general.
- **Fluency is not correctness.** The hypotheses drill counts distinct
  non-empty entries. It does not, and cannot, judge whether an entry is a
  _good_ explanation — that would require content understanding this app does
  not have. Copy says exactly that.
- **Disconfirmation quality is self-rated, not graded.** After typing an
  answer, the user sees 2–3 example disconfirming conditions and rates their
  own answer against them. Copy never implies the app verified it — "self →
  rated," always spelled out.
- **The format comparison in base-rate items is about the _phrasing_, not the
  user.** It reports "your accuracy was different across these two ways the
  same question was asked" — an established property of the paradigm, not a
  diagnosis.
- Enforced automatically for every string change by
  [copy-honesty.test.ts](../../assessment/copy-honesty.test.ts) (scans
  `src/modules`) and this module's own [copy.test.ts](copy.test.ts).

## 1. Deviation from the deferred design in assessment/SPEC.md §9 (recorded)

§9 recorded, as a deferred default, **procedurally generated matrix
reasoning** — an abstract 3×3 grid, rule-based missing cell, a fixed 12-item
graded set, raw = number correct. That is a different instrument family
(fluid-reasoning puzzles) from what this phase implements (calibrated
judgment and hypothesis-generation drills). Matrix reasoning is not built and
remains recorded as a future option; **this phase implements a different,
explicitly directed scope instead** — base-rate/format-effect items,
hypothesis fluency, falsifiability, and calibration. `assessment/SPEC.md` §9
is annotated to point here rather than silently superseded, the same
treatment §7 got when the PVT's recorded ISI turned out to belong to a
different instrument.

## 2. Content — original, not reproduced (assessment/SPEC.md §0)

Every scenario, prompt, claim and factual item below is **our own wording**.
The base-rate item _structure_ (a prevalence, a hit rate, a false-positive
rate, asked in two framings) is public-domain paradigm design from decades of
published research, not proprietary test content — the same relationship
digit span has to the Wechsler paradigm (assessment/SPEC.md §0).

### 2.1 Base-rate scenarios (6 keys, `engine/reasoning/baseRate.ts`)

Six interchangeable scenario _frames_ — a screening context with a
prevalence, a true-positive rate, and a false-positive rate — so items don't
repeat the same narrative every run: a medical screening test, a factory
quality-control scanner, an airport security scanner, an email spam filter, a
severe-weather alert system, a plagiarism checker. The frame only supplies the
nouns; the numbers are generated per item (§4.1).

Example, probability format (`medicalTest`, generated values):

> 2% of people in this group have the condition. The test correctly flags 90%
> of people who have it. It also flags 5% of people who don't have it. If a
> random person from this group tests positive, what's the probability they
> actually have the condition? _(Answer as a percentage, 0–100.)_

Same item, frequency format:

> Out of 1000 people in this group, 20 have the condition. Of those 20, about
> 18 test positive. Of the 980 who don't have it, about 49 also test
> positive. So 67 people test positive in total. **Of those 67, how many
> actually have the condition?** _(Answer as a count, 0–67.)_

### 2.2 Hypothesis-generation prompts (`modules/reasoning/hypothesesBank.ts`)

~20 original, deliberately ambiguous observations spanning everyday life,
work, and the natural world — broad enough that most people can find several
distinct explanations without specialist knowledge. Examples:

> - "Website signups dropped 30% this week."
> - "A coworker who's usually early has been arriving late all week."
> - "The office plant that was thriving is suddenly wilting."
> - "A friend liked your last three posts but hasn't replied to your message."
> - "Neighborhood cats keep avoiding one particular yard."

### 2.3 Disconfirmation claims (`modules/reasoning/disconfirmationBank.ts`)

~18 original claims shaped like self-sealing explanations — plausible on the
surface, vulnerable to an obvious confound once you look for one — each
paired with 2–3 example disconfirming conditions shown after the user
answers (not before). Examples:

> - Claim: "I started taking the supplement and my headaches went away, so
>   the supplement works."
>   Example disconfirming conditions: headaches also went away on a placebo;
>   headaches were already trending down before starting it; something else
>   changed at the same time (sleep, stress, diet).
> - Claim: "Our team hit its targets after the new manager took over, so the
>   new manager is why."
>   Example disconfirming conditions: targets were already on track to be hit
>   before the change; a competitor's product also improved industry-wide
>   numbers that quarter; the team lost its hardest account around the same
>   time.

### 2.4 Calibration item bank (`modules/reasoning/calibrationBank.ts`)

~38 original two-choice factual comparisons, hand-picked for a settled,
non-contested answer with a comfortable margin (population and GDP figures —
which drift year to year and are frequently disputed at the margin — are
deliberately excluded; see §4.4). Spans geography, astronomy, history,
biology and physical science, and deliberately mixes trivial items (to
populate the high-confidence end of the curve) with genuinely counter-
intuitive ones (Australia is larger than Greenland; Venus is hotter than
Mercury; a dog has more chromosomes than a human) so miscalibration has
something to show up on.

## 3. Task shape and honesty of scope

All four write to the existing `assessments` table (one row per completed
run) and reseed the `reasoning` module Elo — no new tables, mirroring
`modules/attention/SPEC.md` §2. None are timed the way the attention tasks
are; nothing here depends on presentation latency, so there is no
`TimingProfile` in this module.

| Instrument                  | `rawScore`                             | Direction     |
| --------------------------- | -------------------------------------- | ------------- |
| `reasoning_baserate`        | mean absolute error, percentage points | lower better  |
| `reasoning_hypotheses`      | mean unique hypotheses per prompt      | higher better |
| `reasoning_disconfirmation` | mean self-rated score (0 / 0.5 / 1)    | higher better |
| `reasoning_calibration`     | Brier score                            | lower better  |

## 4. Scoring (all pure, in `/src/engine/reasoning`)

### 4.1 Base-rate items (`baseRate.ts`)

Generation works entirely from the **displayed, rounded counts**, not the
unrounded algebraic Bayes formula: the "correct" answer is defined as
whatever the natural-frequency tree the user sees actually implies, so a
probability-format item and a frequency-format item derived from the same
draw always agree on the target to the same rounding. Population fixed at
`n = 1000` (rounds to whole people in the frequency framing, matching the
`N_MIN`-style plain-constant pattern elsewhere in this codebase — not a
population statistic, a rendering choice).

Per item: `prevalencePct`, `sensitivityPct`, `falsePositiveRatePct` are drawn
from small "nice" candidate sets (e.g. prevalence ∈ {1,2,5,10,15,20,25,30}%)
so frequency counts round cleanly; a draw that yields zero total positives
(division-by-zero on the posterior) is rejected and redrawn, capped like
`generateDigitSequence`'s `MAX_ATTEMPTS`. `BASE_RATE_ITEMS_PER_RUN = 10`,
format balanced 5 probability / 5 frequency and shuffled, scenario chosen
without an immediate repeat.

**Answer contract differs by format** (documented because it's the one
non-obvious API decision here): in `probability` format the user enters a
percentage 0–100 directly comparable to `truePosteriorPct`; in `frequency`
format the user enters a **count** out of the shown `totalPositives`, and
`scoreBaseRateAnswer` converts it to a percentage before comparing. Both
formats' errors land on the same percentage-point scale, which is what makes
the format comparison meaningful.

`scoreBaseRateRun` aggregates mean absolute error overall and **split by
format** — the split is the reportable finding, not a side note.

### 4.2 Hypothesis fluency (`hypotheses.ts`)

Entries are normalized (trim + lowercase) and deduplicated exactly like
`scoreFreeRecall`'s recall matching — **exact-text duplicates only**; two
different phrasings of the same idea both count, and copy discloses this
limitation the same way the attention module discloses input latency it can't
measure. `MAX_HYPOTHESES_PER_PROMPT = 8` bounds the axis for the Elo proxy
(§5) and stops the drill degenerating into minor rewordings for score.
`HYPOTHESES_PROMPTS_PER_RUN = 5`.

### 4.3 Disconfirmation self-rating (`disconfirmation.ts`)

`SelfRating = 'skipped' | 'no' | 'partial' | 'yes'` → score `null / 0 / 0.5 /
1`. `skipped` (no answer typed) is excluded from the mean but counted
separately, the same null-vs-zero discipline `PvtMetrics` uses for a run with
no scorable trials. `DISCONFIRMATION_PROMPTS_PER_RUN = 6`.

### 4.4 Calibration (`calibration.ts`)

The engine never sees item content — a `CalibrationTrial` is just
`{ confidencePct, correct }`, exactly how `engine/attention/cpt.ts` never
sees letter content, only `{ isTarget, responded }`. Correctness (chosen
option vs. the bank's `correctOption`) is resolved where the content lives,
in the module layer.

`CONFIDENCE_LEVELS = [50, 60, 70, 80, 90, 100]` (a plain, evenly-spaced scale;
50 is the floor because stating a confidence below 50% for your own chosen
answer is a logical inconsistency in a two-choice question — you'd be saying
the other option is more likely).

- `brierScore(trials)` — mean of `(confidence/100 − outcome)²`, the standard
  proper scoring rule for a binary probability forecast. 0 = perfect, 0.25 =
  the score of _always_ stating exactly 50% regardless of outcome (the
  "uninformative" floor), 1 = maximally confident and wrong every time.
- `calibrationCurve(trials)` — one bucket per confidence level **that has at
  least one trial**; a level with zero trials is omitted, not shown as 0%
  observed (which would misrepresent "never asked" as "always wrong" — same
  null-not-zero discipline as everywhere else in this codebase).
- **"Running" is the same pure function fed more data, not a separate code
  path.** `calibrationCurve`/`brierScore` take an arbitrary trial array; a
  per-session curve concatenates one run's trials, a running/lifetime curve
  concatenates every `reasoning_calibration` row's stored trials
  (`results.ts` §6). No accumulation logic is duplicated.

`CALIBRATION_ITEMS_PER_RUN = 15`.

## 5. Normalization and Elo (`seed.ts`)

Same two-stage rule as every other instrument (assessment/SPEC.md §2.1,
mirrored exactly from `engine/attention/seed.ts`): a fixed **monotonic
proxy** until `N_MIN` (200) samples exist for an instrument, then empirical z.
Every proxy axis is a **structural scaling of that task's own achievable
range** — not a population statistic:

| Instrument                  | Axis                           | Midpoint       | Spread  |
| --------------------------- | ------------------------------ | -------------- | ------- |
| `reasoning_baserate`        | mean abs. error, `[0,100]` pp  | 50 (inverted)  | 25      |
| `reasoning_hypotheses`      | mean unique/prompt, `[0, MAX]` | `MAX/2`        | `MAX/4` |
| `reasoning_disconfirmation` | mean self-score, `[0,1]`       | 0.5            | 0.25    |
| `reasoning_calibration`     | Brier score, `[0,1]`           | 0.5 (inverted) | 0.25    |

The `reasoning` Elo is the equal-weight mean of whichever of the four
normalized scores exist. Any one task can be taken alone; a module Elo
appears as soon as one has been completed — identical rule to attention.

## 6. Layer map

- `engine/reasoning/` — `baseRate.ts`, `hypotheses.ts`, `disconfirmation.ts`,
  `calibration.ts`, `seed.ts`. Framework-free, no literal prose (scenario
  _keys_ only where selection logic needs them), each with Vitest coverage.
- `modules/reasoning/` — content banks (`baseRateCopy.ts`, `hypothesesBank.ts`,
  `disconfirmationBank.ts`, `calibrationBank.ts`), `copy.ts` (+ honesty test),
  `results.ts` (assessment rows + Elo reseed, tested against a real sql.js
  DB), `CalibrationChart.tsx` (reliability diagram, built on the shared
  `ui/chartGeometry.ts` the same way `LineChart` is), four screens.
- `app/modules/reasoning/` — hub + one route per task.
- Dashboard: `ProgressDashboardScreen` gains a Reasoning section built from
  the same `ModuleProgressSection` parts attention uses (`retentionPoints:
null` — reasoning has no scheduled cards either).
