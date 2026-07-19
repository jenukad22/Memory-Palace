# DESIGN.md — Memory Palace UI system

**Date:** 2026-07-20
**Status:** Resolved. Variants reviewed and picked (design review 01): accent **gold**, Likert **A3**
(stacked list), digit entry **B3** (keypad + slots + pinned submit), Corsi **C3** (tactile keys),
chrome as proposed.
**Scope:** tokens + component specs for the three memory-battery screens (VVIQ, digit span, Corsi)
and shared onboarding chrome. `/src/ui` is built from this file; assessment screens are built from
`/src/ui` and never style ad hoc.
**Direction:** precise, focused, quietly competitive. A serious trainer, not a brain-games toy.

Three system-wide prohibitions (they define the look as much as the tokens do):

1. **No shadows** — elevation is surface steps + hairlines. Sole exception: Corsi C3 key treatment.
2. **No pills** — sole exception: the battery progress track.
3. **Semantic ≠ accent** — green/red are reserved for trial feedback and errors. The accent never
   signals correctness, and correctness is never signalled by hue alone (always text/icon too).

---

## 1. Tokens (`src/ui/tokens.ts` — the only source; no literal colors/sizes in components/screens)

### 1.1 Color

| token           | value                   | usage                                                                           |
| --------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `bg0`           | `#0B0E14`               | app ground                                                                      |
| `surface1`      | `#131824`               | cards, inputs, keys                                                             |
| `surface2`      | `#1B2230`               | raised/pressed fills, progress track, disabled button ground                    |
| `line`          | `#263042`               | hairline borders (cards, keypad keys)                                           |
| `lineStrong`    | `#34405A`               | control borders (inputs, secondary button, blocks, slots)                       |
| `textPrimary`   | `#E9EDF5`               | primary text                                                                    |
| `textSecondary` | `#97A1B4`               | secondary text, captions, overlines                                             |
| `textMuted`     | `#5B6478`               | disabled text, empty-slot dots, de-emphasis only — never for informational copy |
| `ink`           | `#0B0E14`               | text/icons on accent fills                                                      |
| `accent`        | `#E3A84E`               | interactive emphasis, selection, highlights, focus                              |
| `accentPressed` | `#C08A35`               | pressed state of accent fills                                                   |
| `accentTint`    | `rgba(227,168,78,0.16)` | selected-row fill, ghost pressed fill, tap-flash                                |
| `success`       | `#4CC685`               | trial-correct feedback only                                                     |
| `successTint`   | `rgba(76,198,133,0.14)` | trial-correct fill                                                              |
| `error`         | `#E06456`               | trial-fail feedback, input errors                                               |
| `errorTint`     | `rgba(224,100,86,0.14)` | trial-fail fill                                                                 |

Contrast floors (unit-tested in `tokens.test.ts`): `textPrimary` ≥ 7:1 and `textSecondary` ≥ 4.5:1
on both `bg0` and `surface1`; `ink` ≥ 4.5:1 on `accent`. `textMuted` is exempt (de-emphasis only).

### 1.2 Type — system stack (SF Pro / Roboto). All digits set with `fontVariant: ['tabular-nums']`.

| token        | size/line | weight | extras                       | usage                         |
| ------------ | --------- | ------ | ---------------------------- | ----------------------------- |
| `stimulus`   | 72/76     | 600    | tabular-nums                 | the displayed digit           |
| `display`    | 34/40     | 700    |                              | screen-level headlines        |
| `title`      | 24/30     | 700    |                              | task titles                   |
| `heading`    | 19/24     | 600    |                              | section/sheet headings        |
| `body`       | 16/22     | 400    |                              | running copy, VVIQ items      |
| `bodyStrong` | 16/22     | 600    |                              | emphasis inside body          |
| `secondary`  | 14/20     | 400    |                              | supporting copy               |
| `caption`    | 12/16     | 500    | letterSpacing 0.2            | counters ("Item 4 of 16")     |
| `overline`   | 11/14     | 600    | letterSpacing 0.9, uppercase | kickers ("Baseline · 2 of 3") |

### 1.3 Spacing / radii / hit targets / motion

- **Spacing** (4-pt base): `sp1 4 · sp2 8 · sp3 12 · sp4 16 · sp5 24 · sp6 32 · sp7 48 · sp8 64`.
- **Radii:** `rSm 6` (buttons, inputs, keys, slots, blocks) · `rMd 10` (cards) · `rLg 16` (sheets)
  · `rFull 999` (battery progress track only).
- **Hit targets:** minimum 44×44 everywhere; standard control height **52** (compact 40).
- **Motion:** `tapFlashMs 150` (Corsi tap, key press) · `advanceMs 250` (Likert auto-advance delay).
  Stimulus timing (digit 800/200, Corsi 1000/250) is **SPEC/engine-owned, not a ui token** — the
  kit renders states; screens drive timing.

---

## 2. Component specs

Every interactive component implements this state model. "Focus" is the keyboard/web state: 2px
`accent` ring at 2px offset (web) / border swap to `accent` (native). Disabled controls swap to
`surface2` ground + `textMuted` content — never opacity fades.

### 2.1 `AppText`

`variant` = the type tokens above; `color` prop defaults `textPrimary`, accepts any color token
name. Renders RN `Text`. Digits inherit tabular-nums from `stimulus`/`caption` variants
automatically; other variants accept `tabular` prop.

### 2.2 `Button`

`kind: 'primary' | 'secondary' | 'ghost'` · `size: 'md' (52) | 'sm' (40)` · full width by default.
Label: `body` size, weight 600.

| kind      | default                                      | pressed              | disabled                           | focus       |
| --------- | -------------------------------------------- | -------------------- | ---------------------------------- | ----------- |
| primary   | `accent` fill, `ink` label, `rSm`            | `accentPressed` fill | `surface2` fill, `textMuted` label | ring/border |
| secondary | transparent, 1px `lineStrong`, `textPrimary` | `surface2` fill      | `line` border, `textMuted` label   | ring/border |
| ghost     | transparent, `accent` label                  | `accentTint` fill    | `textMuted` label                  | ring/border |

### 2.3 `Card`

`surface1` fill, 1px `line` border, `rMd`, padding `sp4`. Non-interactive (no pressed state). No
shadow.

### 2.4 `InputField`

Height 52, `surface1` fill, 1px `lineStrong` border, `rSm`, padding-x `sp4` − 2, `body` text.
States: **focus** → border `accent` (+ ring on web); **error** → border `error` + caption-size
message in `error` below (message states the fix: "Enter all digits before submitting.");
**disabled** → `surface2` fill, `textMuted` text.

### 2.5 `LikertScale` — pick A3 (stacked list, per-point anchors)

Props: `options: { value: number; label: string }[]` (content supplied by the screen), `value`,
`onSelect(value)`. Five full-width rows, gap `sp2`.

Row: min-height 48, `rSm`, padding 12/14, layout = 26px numbered circle + anchor text
(`secondary` size, 18 line-height).

| state    | row                                                                             | circle                                   | text            |
| -------- | ------------------------------------------------------------------------------- | ---------------------------------------- | --------------- |
| default  | `surface1` fill, 1px `line`                                                     | 1px `lineStrong` border, `textSecondary` | `textSecondary` |
| pressed  | `surface2` fill                                                                 | unchanged                                | unchanged       |
| selected | `accentTint` fill, 1px `accent`                                                 | `accent` fill, `ink` number              | `textPrimary`   |
| disabled | opacity rules don't apply — rows are never disabled; the screen gates advancing |                                          |                 |
| focus    | ring/border per global rule                                                     |                                          |                 |

Selection triggers the screen's auto-advance after `advanceMs`; the component only reports
`onSelect`.

### 2.6 Digit entry — pick B3 (`DigitSlots` + `DigitKeypad`)

**`DigitSlots`** — props `length`, `entered: string`. One cell per expected digit: 32×44, `rSm`,
`surface1` fill, 1px `lineStrong`; filled cells show the digit (22/600, tabular); the **current**
cell (first empty) swaps border to `accent`; empty cells show a `textMuted` middot.

**`DigitKeypad`** — phone layout `1-9 / ⌫ 0 clear`, grid gap `sp2`, keys height 54, `rSm`,
`surface1` fill, 1px `line`, digit 22/600 tabular. Function keys (`⌫`, `Clear`) use `secondary`
size, weight 600, `textSecondary`.

| key state | treatment                                                                               |
| --------- | --------------------------------------------------------------------------------------- |
| default   | as above                                                                                |
| pressed   | `surface2` fill (flash ≤ `tapFlashMs`)                                                  |
| disabled  | `textMuted` content, taps ignored (e.g. ⌫ with nothing entered, digits when slots full) |
| focus     | ring/border per global rule                                                             |

**Submit** is a separate `Button kind=primary` (height 48) pinned below the keypad with `sp3` gap —
never inside the pad. Disabled until all slots are filled.

### 2.7 `CorsiBoard` — pick C3 (tactile keys)

Square board, blocks at 18% × 18% of board size, `rSm`. **Normalized top-left coordinates (fixed):**

| block | x    | y    | block | x    | y    | block | x    | y    |
| ----- | ---- | ---- | ----- | ---- | ---- | ----- | ---- | ---- |
| 1     | 0.06 | 0.58 | 4     | 0.42 | 0.40 | 7     | 0.72 | 0.30 |
| 2     | 0.26 | 0.12 | 5     | 0.55 | 0.06 | 8     | 0.82 | 0.56 |
| 3     | 0.28 | 0.76 | 6     | 0.60 | 0.68 | 9     | 0.06 | 0.26 |

Props: `phase: 'display' | 'recall'`, `highlightIndex: number | null`, `onTapBlock(index)`.

| block state        | treatment                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idle               | vertical gradient `#202839 → #171D2A`, 1px `lineStrong`, inset top light `rgba(255,255,255,0.05)`, drop `0 2px 3px rgba(0,0,0,0.35)` — the system's only shadows                        |
| highlighted        | `accent` fill + glow `0 0 18px rgba(227,168,78,0.45)`                                                                                                                                   |
| tap-flash (recall) | depress: translateY 1px, darkened fill `#171D2A`, inset shadow, `accent` border — held `tapFlashMs`, then back to idle. **No persistent tapped marking** (it would act as a recall aid) |
| display phase      | taps ignored; **no visual change** (board must look identical in both phases)                                                                                                           |

Screens own sequencing/timing; the board only renders `highlightIndex` and reports taps.

### 2.8 `BatteryProgress`

Three segments (VVIQ · Digit span · Corsi), height 4, `rFull` track in `surface2`, fill `accent`.
Forward/backward passes **half-fill** their task's segment (0 / 0.5 / 1) — the battery reads as 3
tasks, not 5 steps. No percentages, no scores, ever, in chrome.

### 2.9 `CheckpointSheet`

`surface1`, 1px `line`, radius `rLg` top / `rMd` bottom, padding 20/16/16. Contents: `heading`
title, `secondary` body, primary Button (continue), `sp2` gap, ghost Button (**"Finish later"**).
Copy rules: names the next task and its approximate time; states progress is saved; **deferral is
never guilt-tripped** and no copy implies anything beyond the task (CLAUDE.md honesty rule).

### 2.10 `ScreenShell`

Safe-area wrapper, `bg0` ground, horizontal padding `sp4`, top gap `sp3` under the header. Hosts
the chrome header: `overline` kicker left ("Baseline · 2 of 3"), `caption` task name right,
`BatteryProgress` beneath.

---

## 3. What `/src/ui` does NOT own

- **Timing constants** — digit 800/200 ms, Corsi 1000/250 ms live with the engine/SPEC; screens
  drive components from them.
- **Copy/content** — VVIQ item text and anchor wording, checkpoint copy, task names. Screens/data
  own these (honesty constraints in CLAUDE.md and SPEC §0 apply to that copy).
- **Navigation** — expo-router owns it; components never navigate.
- **Scoring/state** — `/src/engine` only.

## 4. Review artifact

Variants + tile as reviewed: design review 01 (claude.ai artifact `776e31e6`), 2026-07-20. This
file supersedes the artifact; on conflict, DESIGN.md wins.
