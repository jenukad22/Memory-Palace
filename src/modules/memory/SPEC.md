# Memory module — SPEC

Two trainers under the memory domain, both feeding the shared FSRS + Elo +
`review_log` pipeline (see `db/schema.ts`, `engine/fsrs.ts`, `engine/elo.ts`):

1. **Memory Palace** — the user builds a reusable route (a palace = an ordered
   list of loci). A training loop loads a set of to-be-remembered items onto the
   loci, then tests route-recall with **active retrieval**: the answer is never
   shown before the attempt.
2. **PAO** — the user authors their own 00–99 Person/Action/Object list. Drills
   compress a 6-digit number into one scene by decomposing it into three pairs
   (Person of the 1st, Action of the 2nd, Object of the 3rd).

The palace is _technique_; the placed items / word lists are _material_ (Dresler
protocol). We schedule the material, not the route.

## Honesty constraint (CLAUDE.md)

Every string reports performance on the specific task only — route-recall
accuracy, PAO retrieval accuracy, reaction time, list length. Never IQ, memory
"score", cognitive health, or any gain that generalizes beyond the task just
performed. Analytics/event names follow the same rule (`palace_recall_accuracy`,
not `memory_boost`). A copy-honesty test guards new strings.

## 1. Data model

### Structural (new tables, migration `0003`) — no FSRS, no Elo, no review history

- **`palaces`**: `id`, `name`, `createdAt`, `isDeleted` (soft-delete, like
  `cards`).
- **`loci`**: `id`, `palaceId` (FK → `palaces.id`), `position` (0-based int),
  `label`, `cue` (nullable), `createdAt`.
  - **`UNIQUE(palace_id, position)`** — ordering is explicit and DB-enforced,
    never array order in JSON. Positions of a palace's loci are contiguous from 0.
  - FK is `ON DELETE NO ACTION` (drizzle default). Palaces are **soft-deleted,
    never row-deleted**, so no cascade is ever triggered; loci and their
    placement cards (and thus review history) survive a palace soft-delete.

### Reviewable (existing `cards` + `fsrs_state` + `review_log`)

- **PAO entry** = one `card`, `module = 'pao'`, `front = '07'`,
  `back = 'James Bond · shooting · pistol'`,
  `payload = { n: 7, person, action, object }`. The list is the ≤100 non-deleted
  `pao` cards; `n` is the identity (0–99).
- **Placement** = one `card`, `module = 'memory'`,
  `payload = { palaceId, locusId, setId, position, locusLabel }`.
  `front` is the route prompt ("Stop 3 on _Home Route_ — what's here?"),
  `back` is the placed item. A **training set** (`setId`) is one loading of a
  route: the cards created when the user places an item list onto the loci.
  - `locusLabel` is a **denormalized snapshot** so a placement still renders if
    its locus later vanishes (see §3). `locusId`/`palaceId` are the references;
    reads join null-safe and fall back to the snapshot.

## 2. Review pipeline (both trainers)

One write path: `recordReview(db, { cardId, module, rating, elapsedMs, now })`.
It is the only place all three tables move, and it moves them in **one
transaction**:

1. read the card's `fsrs_state` + the module's `ability_ratings.elo` +
   the module's rated-item count (for provisional K),
2. call the pure `engine/review.gradeReview(...)` — composes `schedule`,
   `getRetrievability`, and `elo.update`; the item's Elo opponent is derived
   from the card's current FSRS `difficulty` (no per-card Elo column),
3. write `fsrs_state` (FSRS advance), `ability_ratings` (new module Elo),
   and append one `review_log` row.

`review_log` stays append-only (trigger from `0001`); `gradeReview` is pure and
carries all scientifically-sensitive math, so it is unit-tested without a DB
(the `/src/engine` rule).

Ratings are the FSRS four (`again|hard|good|easy`). A route-recall / PAO attempt
maps a self-grade to a rating; a miss (no/incorrect retrieval) is `again`.

## 3. Locus edits mid-route (resolved before implementation)

Placement scheduling state keys on **`card.id`**, and a placement references a
**stable `locusId`**, not a position. Drill order is derived at read time by
joining placements → loci and sorting by `loci.position`. Consequences:

- **Reorder loci** — updates `loci.position` only. Placement cards are untouched,
  so **no scheduling state is orphaned**; the next drill simply walks the new
  order. Because `UNIQUE(palace_id, position)` rejects a naive in-place swap, the
  reorder writes the full new contiguous ordering inside one transaction using a
  temporary high offset (bump all to `position + OFFSET`, then set finals), so no
  intermediate state collides.
- **Delete a locus** — in one transaction: (a) **soft-delete** (`isDeleted = 1`)
  every active placement card referencing that `locusId` — this preserves the
  append-only `review_log` and the `fsrs_state` rows; nothing is cascade-
  destroyed; (b) hard-delete the locus row; (c) **compact** remaining positions
  to stay contiguous from 0. An _active_ placement therefore always points to a
  live locus; a _soft-deleted_ placement (or one read from history) tolerates a
  missing locus via the null-safe join + `locusLabel` snapshot — it **degrades
  gracefully, never throws**.
- **Delete a palace** — soft-delete the `palaces` row only. Loci and placement
  cards remain; review history survives. Palace lists filter `isDeleted = 0`;
  reads of an orphaned placement degrade gracefully as above.

## 4. Difficulty (engine/difficulty.ts)

Per-session difficulty comes from `nextDifficulty(current, rollingAccuracy)`,
where `rollingAccuracy` is computed from the module's recent `review_log`. It
sets session parameters — palace: item-list length per loop; PAO: count of
6-digit numbers per drill and the pre-hide exposure. Difficulty is a session
parameter; it never renames or reinterprets what the score means.

## 5. VVIQ routing (onboarding flag)

`getVviqStrategy(db)` returns `'visual' | 'non-visual'` from the latest VVIQ.
The module swaps **encoding-instruction copy only** (mirrors
`assessment/vviq/strategyCopy.ts`): `visual` → "set a vivid scene at each stop";
`non-visual` → "anchor each stop by movement, order, and meaning." Same cards,
same schedule, same retrieval test. The retrieval-test copy is strategy-neutral
and never labels the user or implies a deficit.

## 6. Layer map

- `engine/pao.ts`, `engine/palace.ts`, `engine/review.ts` — pure, Vitest-covered.
- `db/queries/palaces.ts`, `db/queries/pao.ts`, `recordReview` — persistence.
- `modules/memory/*` — screens (palace builder/training, PAO builder/drill),
a Zustand session store, TanStack Query hooks, route copy. Route entry wired
from `app/modules/[module].tsx` for `memory`.
</content>

</invoke>
