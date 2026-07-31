# Optional Supabase auth + sync — design

**Status:** design, pre-implementation. The conflict strategy (§3) is the load-bearing
part and is settled here before any code is written.

**Constraint, restated:** local-first stays the default. The app must behave exactly as
it does today when signed out, when the Supabase env vars are absent, and when offline.
Sync is additive — never a gate in front of a local feature.

---

## 0. What the existing schema already gives us (and what it doesn't)

Three facts from the current code shape everything below:

1. **`newId()` is UUID v4** ([db/id.ts](../../../src/db/id.ts)). Every primary key in
   the schema is a client-generated UUID. Two devices creating rows offline cannot
   collide. This is the precondition that makes merge-by-primary-key viable at all —
   without it, sync would need server-assigned ids and a whole remapping layer.
2. **`review_log` and `ability_log` are trigger-enforced append-only** (migrations
   0001, 0005). No UPDATE, no DELETE, ever. That is a hard constraint on the sync
   writer: it may only ever INSERT into these tables. It is also a _gift_ — see §3.1.
3. **`is_synced` is dormant scaffolding.** It exists only on `cards`, is written
   `false` at creation ([queries/cards.ts:26](../../../src/db/queries/cards.ts)), and
   is never read or set anywhere. There is no existing sync semantic to preserve; this
   design defines it.

What's missing and must be added: no `updated_at` on any mutable table (only
`ability_ratings` has one), and no `is_synced` on any table but `cards`.

---

## 1. Table taxonomy

Everything follows from classifying each table by how it actually mutates. This is not
a generic sync layer — it is four different strategies applied to four kinds of table.

| Class              | Tables                                     | Mutation                                               | Strategy                                |
| ------------------ | ------------------------------------------ | ------------------------------------------------------ | --------------------------------------- |
| **A. Append-only** | `review_log`, `ability_log`, `assessments` | insert only, never updated                             | **union by PK** — no conflicts possible |
| **B. Derived**     | `fsrs_state`, `ability_ratings`            | recomputable from class A                              | **don't sync — recompute after merge**  |
| **C. Mutable**     | `cards`, `palaces`, `sessions`             | updated in place; soft-deleted                         | **LWW on `updated_at`, tombstone wins** |
| **D. Ordered set** | `loci`                                     | reordered, hard-deleted, `UNIQUE(palace_id, position)` | **palace-scoped whole-list LWW** (§3.4) |
| **E. Local-only**  | sync cursors, device id, `synced_user_id`  | —                                                      | never leaves the device                 |

Verified against the actual mutation surface: `assessments` has only
`insertAssessment`/`listAssessments` — nothing updates it, so it is genuinely class A
despite having no trigger enforcing that. `cards` _is_ mutated in place
(`upsertPaoEntry` rewrites `back`/`payload` to preserve a card's review history), so it
is genuinely class C.

---

## 2. Sync mechanics

### 2.1 Dirty tracking uses `is_synced`, enforced by trigger

`is_synced = 0` means "this row has local changes not yet pushed." Every syncable table
gains `is_synced` (default 0) and `updated_at`.

**Marking dirty is enforced by a SQLite trigger, not by discipline at each call site.**
There are already write paths that would silently forget — `upsertPaoEntry` updates
`cards.back`/`payload` directly, and nothing in that function knows about sync. Relying
on every current and future query function to remember `is_synced = 0` is exactly the
kind of invariant this codebase already chose to enforce in the database instead (the
append-only triggers). Same reasoning, same mechanism:

```sql
CREATE TRIGGER cards_mark_dirty AFTER UPDATE ON cards
WHEN NEW.is_synced = OLD.is_synced   -- don't re-dirty a row the sync writer just marked clean
BEGIN
  UPDATE cards SET is_synced = 0, updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
  WHERE id = NEW.id;
END;
```

The `WHEN` guard is what lets the sync writer set `is_synced = 1` without the trigger
immediately undoing it. SQLite's recursive triggers are off by default, so the inner
`UPDATE` does not re-fire.

### 2.2 The cycle: pull → resolve → push

Ordering matters and is not arbitrary:

1. **Pull** rows where `server_updated_at > last_pulled_at` (a local cursor).
2. **Resolve** each incoming row against local state (§3).
3. **Recompute** class B from the merged class A.
4. **Push** every row still `is_synced = 0`, then mark those rows clean.
5. **Advance the cursor** to the max `server_updated_at` observed in the pull.

Push goes _last_ so that a locally-won conflict propagates outward in the same cycle
rather than waiting for the next one. Every step is idempotent — merges are keyed on
stable UUIDs and the resolution function is deterministic — so an interrupted cycle is
safe to re-run, which is the property that actually makes offline→online reconciliation
work. A dropped connection mid-push leaves rows dirty; the next cycle re-pushes them.

### 2.3 Clocks

`updated_at` is a client wall clock and devices skew. Two mitigations, no pretence of
solving it:

- The server stores both the client's `updated_at` and its own `server_updated_at`
  (`default now()`). **The cursor uses `server_updated_at`** — so pull completeness never
  depends on client clocks, only conflict _resolution_ does.
- Ties on `updated_at` break on `device_id` (lexicographic) so resolution is
  deterministic rather than order-dependent.

This is last-writer-wins with the usual caveat: a device with a badly wrong clock can
win a conflict it should have lost. That is a real limitation, documented rather than
hidden, and it only affects class C/D rows — never the scientific record (class A).

---

## 3. Conflict strategy per class

### 3.1 Class A — union by primary key. No conflicts, by construction.

`review_log`, `ability_log` and `assessments` are insert-only with UUID PKs. Merging two
devices is a set union: insert every remote row whose id is absent locally, and never
touch an existing row.

**This is the important case, and it resolves perfectly.** The data that matters
scientifically — every review ever graded, every Elo value ever written, every
assessment result — merges without loss, without ordering ambiguity, and without any
policy decision. The append-only triggers that exist to protect the honesty constraint
are not merely compatible with sync; they are what makes this class trivially
mergeable. A sync design that needed to rewrite review history would be in direct
conflict with those triggers, and the fact that it doesn't is the strongest signal the
taxonomy is right.

**Merge order is a correctness constraint, not a preference.** Class C/D must be
applied _before_ class A: `review_log.card_id` is a foreign key to `cards`, so a payload
carrying a new card together with its first reviews only merges in a single pass if the
card lands first. Applying class A first silently drops those reviews (they'd be picked
up a sync later, or never if the card was already present remotely). Asserted in
`sync.test.ts`.

A review whose card is genuinely absent is skipped rather than aborting the whole merge —
one unresolvable row must not block every other table.

### 3.2 Class B — recompute, don't merge.

**`fsrs_state`** is a pure function of a card's initial state and its ordered review
history. `gradeReview` ([engine/review.ts](../../../src/engine/review.ts)) takes
`(cardState, rating, now)` and is already framework- and DB-free; `schedule()` is
deterministic. After class A merges, replaying a card's merged `review_log` in `ts`
order reproduces the correct scheduling state — including the case that LWW would get
wrong, where each device reviewed the same card offline and neither device's final
state accounts for the other's review.

**`ability_ratings`** is a cache of the latest `ability_log` entry per module. After
merge, it is `SELECT ... ORDER BY ts DESC LIMIT 1` per module. No replay needed.

Two honest consequences to state plainly:

- After a merge, a `review_log` row's stored `difficulty`/`stability` may not match what
  a replay computes, because that row recorded what _that device_ calculated at the
  time, before it knew about the other device's interleaved review. The log stays a
  faithful record of events; `fsrs_state` becomes the merged derived state. Neither is
  edited to agree with the other — the log can't be (append-only), and shouldn't be.
- Elo after a merge is last-writer-wins in effect. Elo is a running estimate, not a
  conserved quantity, so this is acceptable — but it is a real merge artifact, not an
  exact reconciliation.

This mirrors a decision this project already made: derive-on-read was chosen over a
stored flag for VVIQ routing (assessment/SPEC.md §12).

### 3.3 Class C — LWW on `updated_at`, tombstone wins.

For `cards`, `palaces`, `sessions`:

```
resolveRow(local, remote):                     -- whose version is right
  if (!local)                    -> take remote
  else if (remote.is_deleted)    -> take remote        (tombstone wins)
  else if (local.is_deleted)     -> keep local         (tombstone wins)
  else                           -> higher updated_at wins; tie broken on device_id

shouldApplyRemote(local, remote, localIsDirty):  -- is there anything to write
  if (!local)                                        -> yes
  else if (!localIsDirty && same updated_at
           && same tombstone flag)                   -> no, already hold it
  else                                               -> resolveRow(...) == remote
```

**Corrected during implementation.** An earlier draft short-circuited with "if the
local row is clean, take remote" before comparing timestamps. That was wrong twice
over, and the tests caught both:

- **Silent regression.** The server is dumb storage and does not itself run LWW, so
  it can legitimately hold an _older_ row (another device pushed a stale copy after
  ours). Overwriting purely because the local row was clean would roll that row back.
- **Non-idempotent pulls.** Re-pulling an unchanged row rewrote it, which re-fires the
  dirty-marking trigger — so the device would push back what it had just been given,
  every cycle, forever.

Hence the split above: resolution is pure last-writer-wins plus tombstone precedence,
and `localIsDirty` is used only to decide whether there is work to do. The tie-break
deliberately does **not** consult `localIsDirty` — each device sees _itself_ as the
dirty one, so both would keep their own copy and never converge.

**Tombstone-wins** rather than edit-wins: both tables soft-delete, so a delete that beats
a concurrent edit destroys nothing — the row is still there with `is_deleted = 1` and can
be recovered. The reverse (edit resurrects a deleted row) silently undoes an explicit
user action. Given this codebase never hard-deletes anything that carries history, delete
precedence is the consistent choice.

Field-level merge is deliberately _not_ attempted. A card's `front`/`back`/`payload` are
one coherent authored unit (a PAO entry is person+action+object); merging fields
independently could produce a combination neither device ever had.

### 3.4 Class D — `loci`: whole-list LWW, scoped to the palace.

This is the one genuinely hard table, and it deserves the most care:

- `UNIQUE(palace_id, position)` means a naive per-row merge can produce two loci at the
  same position → constraint violation → the whole sync transaction aborts.
- `deleteLocus` **hard-deletes** and then compacts positions. There is no tombstone, so
  a per-row merge would let device B's stale copy resurrect a locus device A deleted.
- `reorderLoci` is inherently a whole-list operation — it rewrites every row's position
  in one transaction, using a temporary offset precisely because the unique constraint
  rejects in-place swaps.

**Proposal: a palace's loci list is one logical value.** It carries one `updated_at` on
the parent `palaces` row (`loci_updated_at`), bumped by any add/edit/reorder/delete. On
conflict, the whole list from the winning side replaces the whole list on the loser —
never a row-wise merge.

Why this is the right shape rather than a compromise:

- It is the only option that **cannot** violate `UNIQUE(palace_id, position)`, because a
  list that was valid when written stays valid when applied wholesale.
- It matches how the data is actually authored and used — a route is edited as a route.
- Its failure mode is already handled. If device A's list wins and device B had added a
  locus with placement cards on it, those cards (class C, merged separately) become
  orphaned — and orphaned placements are an **already-designed-for state**: the payload
  carries a `locusLabel` snapshot and `listPlacementsBySet` flags `orphaned` and renders
  from the snapshot rather than throwing (modules/memory/SPEC.md §3). Sync degrades into
  a case the schema was already built to survive.

Cost, stated plainly: a label edit on device B is lost if device A reordered the same
palace later. Granularity is traded for a constraint guarantee.

---

## 4. Auth

- `@supabase/supabase-js`, session persisted via `expo-secure-store` on native and
  `localStorage` on web (Supabase's `auth.storage` option).
- Config from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon key
  is publishable by design — **RLS is the security boundary, not the key**.
- **If either env var is absent, the sync feature does not exist**: no settings entry, no
  network code loaded, no behavioural difference from today. This is what makes the
  feature genuinely additive rather than a dormant dependency.
- Server side: every synced table gets `user_id uuid references auth.users`, with RLS
  `using (user_id = auth.uid())` on select and `with check (user_id = auth.uid())` on
  insert/update. The local database stays user-agnostic; `user_id` is attached at push.

### 4.1 Two users, one device

If account B signs in on a device holding account A's data, merging them would silently
mix two people's records. Instead: a local `sync_meta.synced_user_id` is written on first
sync. If a different user signs in, sync **refuses to start** and offers an explicit
"reset local data" action. Never a silent merge.

---

## 5. What is deliberately not in scope

- **Realtime.** Sync is manual + on-foreground. No subscriptions, no background tasks.
- **Field-level / CRDT merge.** Neither the data shape nor the two-device use case
  justifies it.
- **Server-side recomputation.** The server is dumb storage with RLS; all merge logic is
  client-side and unit-testable in Node.
- **Migrating existing local data to a new schema version across devices.** Both devices
  must be on the same migration index to sync; a version check gates it.

---

## 6. Layer map

- `engine/sync/` — pure, Vitest-covered: `resolve.ts` (the class C/D decision function),
  `replay.ts` (class B recomputation), `cursor.ts`. No network, no db, no React.
- `db/migrations/0006_sync_columns.sql` — hand-authored (triggers aren't representable in
  drizzle-kit snapshots, same as 0001/0005), **registered in `meta/_journal.json` with a
  chain-linked snapshot** or `migrations-consistency.test.ts` fails.
- `db/queries/sync.ts` — dirty-row reads, merge application, cursor persistence. Tested
  against real sql.js in Node.
- `sync/` — `supabaseClient.ts` (env-gated, returns null when unconfigured),
  `auth.ts`, `push.ts`, `pull.ts`, `runSync.ts`.
- `app/settings/` — sign in/out, sync status, last-synced time, reset-local-data.
