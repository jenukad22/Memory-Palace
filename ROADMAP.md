# Roadmap

High-level phase tracker. Per-area detail lives in the SPEC files
(`src/assessment/SPEC.md`, `src/modules/memory/SPEC.md`); this file is the index
so cross-cutting or deferred work isn't lost between them.

## Status

| Phase | Scope                                                                                      | State       |
| ----- | ------------------------------------------------------------------------------------------ | ----------- |
| 3     | Baseline battery — VVIQ, digit span (F/B), Corsi (F/B); scoring, Elo seeding, VVIQ routing | ✅ Done     |
| 4     | Memory module — palace + PAO trainers, daily cross-module review, 6-week MoL campaign      | ✅ Done     |
| 5     | _next — not yet scoped_                                                                    | ⏳ Upcoming |
| 6.1   | Attention module — N-back, PVT (design-only in `src/assessment/SPEC.md` §6/§7)             | 🔜 Deferred |
| 6.2   | Reasoning module — pattern/relational tasks (design-only in `src/assessment/SPEC.md` §9)   | 🔜 Deferred |
| 7     | **First-run education / technique-teaching layer** (see below)                             | 📝 Recorded |

## Phase 7 — First-run education / technique-teaching layer

**Recorded, not yet built.** Raised after web testing of Phase 4: the app
currently assumes the user already knows the vocabulary — a newcomer's first
encounter with the memory palace is the builder screen saying "add loci," with
no explanation of what a locus is, what a memory palace does, or what PAO means.

**Scope:** a short, plain-language introductory/explainer screen per technique,
shown _before its first use_:

- Memory palace — what a "palace" and "loci" are, why a familiar route works,
  in everyday words (not jargon-first).
- PAO — what Person/Action/Object is and why it compresses digits.
- (Optionally) the 6-week campaign — what the program is and what the
  pre-/post-test measures, reusing the honest "words recalled" framing.

**Design constraints (why it's its own phase, not folded into the mechanics
now):**

- Build it **against the finished trainer screens**, so the teaching copy
  matches the real flow rather than a moving target.
- Gate it on first use per technique (e.g. a persisted "seen intro" flag), and
  make it skippable/re-openable — it must not become a wall in front of a
  returning user.
- Copy stays under the honesty constraint (CLAUDE.md / SPEC §0): describe the
  technique and the task, never imply IQ / general-ability / health gains.
- Reuse `/src/ui` tokens and components; no new persistence tables if a simple
  flag store suffices.

This is a UX/onboarding layer, independent of the attention/reasoning module
work in 6.1/6.2 — it can land in any order relative to those.
