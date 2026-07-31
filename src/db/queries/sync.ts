/**
 * Local side of sync (docs/superpowers/specs/2026-07-31-supabase-sync-design.md).
 * Reads what needs pushing, applies what was pulled, and recomputes derived
 * state. No network here and no Supabase types — the transport is injected at
 * the `sync/` layer, so this whole file is testable against real sql.js in Node.
 *
 * ## The two-step write, and why every apply* function below uses it
 *
 * The dirty-marking trigger (migration 0007) fires on `AFTER UPDATE ... WHEN
 * NEW.is_synced = OLD.is_synced`. A naive one-statement apply that set content
 * *and* `is_synced = 1` together would misfire depending on the row's prior
 * state: applying to an already-clean row leaves `is_synced` at 1 = 1, the guard
 * passes, and the trigger dirties the row we just accepted — so the device would
 * push back a copy of what it was just given, forever.
 *
 * So every apply is two statements:
 *   1. write the content — the trigger fires and forces `is_synced = 0`;
 *   2. set `is_synced = 1` and restore the remote `updated_at` — `is_synced`
 *      changes 0 -> 1, the guard fails, the trigger stays quiet.
 *
 * Step 1 always lands the row on `is_synced = 0`, which is what makes step 2's
 * transition deterministic regardless of what the row looked like before.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { cardStateDiffers, latestEloByModule, replayCardState, shouldApplyRemote } from '@/engine';
import { newId } from '../id';
import {
  abilityLog,
  abilityRatings,
  assessments,
  cards,
  fsrsState,
  loci,
  palaces,
  reviewLog,
  sessions,
  syncMeta,
  syncOutbox,
} from '../schema';
import type { Db } from '../types';

// ---------------------------------------------------------------------------
// Device-local metadata
// ---------------------------------------------------------------------------

export const SYNC_META = {
  deviceId: 'device_id',
  pullCursor: 'pull_cursor',
  lastSyncedAt: 'last_synced_at',
  syncedUserId: 'synced_user_id',
} as const;

export function getSyncMeta(db: Db, key: string): string | null {
  return db.select().from(syncMeta).where(eq(syncMeta.key, key)).get()?.value ?? null;
}

export function setSyncMeta(db: Db, key: string, value: string): void {
  db.insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } })
    .run();
}

/** Stable per-device id, minted on first use. Breaks `updatedAt` ties in resolveRow. */
export function getDeviceId(db: Db): string {
  const existing = getSyncMeta(db, SYNC_META.deviceId);
  if (existing !== null) return existing;
  const id = newId();
  setSyncMeta(db, SYNC_META.deviceId, id);
  return id;
}

/** Server-time watermark of the last completed pull; '0' before the first sync. */
export function getPullCursor(db: Db): string {
  return getSyncMeta(db, SYNC_META.pullCursor) ?? '0';
}

export function setPullCursor(db: Db, cursor: string): void {
  setSyncMeta(db, SYNC_META.pullCursor, cursor);
}

/**
 * Which account this database holds data for. Sync refuses to run if a
 * different user signs in (design doc §4.1) — two people's records must never
 * silently merge into one local database.
 */
export function getSyncedUserId(db: Db): string | null {
  return getSyncMeta(db, SYNC_META.syncedUserId);
}

export type UserCheck = 'ok' | 'first-sync' | 'different-user';

export function checkSyncedUser(db: Db, userId: string): UserCheck {
  const stored = getSyncedUserId(db);
  if (stored === null) return 'first-sync';
  return stored === userId ? 'ok' : 'different-user';
}

// ---------------------------------------------------------------------------
// Wire shapes — plain JSON, dates as epoch ms
// ---------------------------------------------------------------------------

export interface WireCard {
  id: string;
  module: string;
  front: string;
  back: string;
  payload: string | null;
  created_at: number;
  updated_at: number;
  is_deleted: boolean;
  device_id: string;
}
export interface WireLocus {
  id: string;
  palace_id: string;
  position: number;
  label: string;
  cue: string | null;
  created_at: number;
}
export interface WirePalace {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  is_deleted: boolean;
  device_id: string;
  /** The palace's whole loci list — one logical value (design doc §3.4). */
  loci: WireLocus[];
}
export interface WireSession {
  id: string;
  started: number;
  ended: number | null;
  module: string;
  items: number;
  accuracy: number;
  updated_at: number;
  device_id: string;
}
export interface WireReview {
  id: string;
  card_id: string;
  ts: number;
  rating: 'again' | 'hard' | 'good' | 'easy';
  elapsed_ms: number;
  difficulty: number;
  stability: number;
  retrievability: number;
}
export interface WireAbilityLog {
  id: string;
  module: string;
  elo: number;
  ts: number;
}
export interface WireAssessment {
  id: string;
  instrument: string;
  raw_score: number;
  normalized: number | null;
  payload: string | null;
  ts: number;
}

export interface SyncPayload {
  cards: WireCard[];
  palaces: WirePalace[];
  sessions: WireSession[];
  reviewLog: WireReview[];
  abilityLog: WireAbilityLog[];
  assessments: WireAssessment[];
}

export function emptyPayload(): SyncPayload {
  return { cards: [], palaces: [], sessions: [], reviewLog: [], abilityLog: [], assessments: [] };
}

export function payloadSize(payload: SyncPayload): number {
  return (
    payload.cards.length +
    payload.palaces.length +
    payload.sessions.length +
    payload.reviewLog.length +
    payload.abilityLog.length +
    payload.assessments.length
  );
}

// ---------------------------------------------------------------------------
// Collecting what to push
// ---------------------------------------------------------------------------

function outboxIds(db: Db, tableName: string): string[] {
  return db
    .select({ rowId: syncOutbox.rowId })
    .from(syncOutbox)
    .where(eq(syncOutbox.tableName, tableName))
    .all()
    .map((r) => r.rowId);
}

/**
 * Everything this device owes the server: dirty class C/D rows plus queued
 * class A inserts. A palace carries its entire loci list, so the receiver never
 * has to merge positions row-by-row.
 */
export function collectPushPayload(db: Db, deviceId: string): SyncPayload {
  const dirtyCards = db.select().from(cards).where(eq(cards.isSynced, false)).all();
  const dirtyPalaces = db.select().from(palaces).where(eq(palaces.isSynced, false)).all();
  const dirtySessions = db.select().from(sessions).where(eq(sessions.isSynced, false)).all();

  const reviewIds = outboxIds(db, 'review_log');
  const abilityIds = outboxIds(db, 'ability_log');
  const assessmentIds = outboxIds(db, 'assessments');

  return {
    cards: dirtyCards.map((c) => ({
      id: c.id,
      module: c.module,
      front: c.front,
      back: c.back,
      payload: c.payload,
      created_at: c.createdAt.getTime(),
      updated_at: c.updatedAt.getTime(),
      is_deleted: c.isDeleted,
      device_id: deviceId,
    })),
    palaces: dirtyPalaces.map((p) => ({
      id: p.id,
      name: p.name,
      created_at: p.createdAt.getTime(),
      updated_at: p.updatedAt.getTime(),
      is_deleted: p.isDeleted,
      device_id: deviceId,
      loci: db
        .select()
        .from(loci)
        .where(eq(loci.palaceId, p.id))
        .orderBy(loci.position)
        .all()
        .map((l) => ({
          id: l.id,
          palace_id: l.palaceId,
          position: l.position,
          label: l.label,
          cue: l.cue,
          created_at: l.createdAt.getTime(),
        })),
    })),
    sessions: dirtySessions.map((s) => ({
      id: s.id,
      started: s.started.getTime(),
      ended: s.ended?.getTime() ?? null,
      module: s.module,
      items: s.items,
      accuracy: s.accuracy,
      updated_at: s.updatedAt.getTime(),
      device_id: deviceId,
    })),
    reviewLog:
      reviewIds.length === 0
        ? []
        : db
            .select()
            .from(reviewLog)
            .where(inArray(reviewLog.id, reviewIds))
            .all()
            .map((r) => ({
              id: r.id,
              card_id: r.cardId,
              ts: r.ts.getTime(),
              rating: r.rating,
              elapsed_ms: r.elapsedMs,
              difficulty: r.difficulty,
              stability: r.stability,
              retrievability: r.retrievability,
            })),
    abilityLog:
      abilityIds.length === 0
        ? []
        : db
            .select()
            .from(abilityLog)
            .where(inArray(abilityLog.id, abilityIds))
            .all()
            .map((a) => ({ id: a.id, module: a.module, elo: a.elo, ts: a.ts.getTime() })),
    assessments:
      assessmentIds.length === 0
        ? []
        : db
            .select()
            .from(assessments)
            .where(inArray(assessments.id, assessmentIds))
            .all()
            .map((a) => ({
              id: a.id,
              instrument: a.instrument,
              raw_score: a.rawScore,
              normalized: a.normalized,
              payload: a.payload,
              ts: a.ts.getTime(),
            })),
  };
}

/**
 * Called only after the server has accepted the payload. Clearing the outbox
 * before a confirmed write would lose rows permanently — the append-only tables
 * have no other record that they still need pushing.
 */
export function markPayloadSynced(db: Db, payload: SyncPayload): void {
  db.transaction((tx) => {
    for (const c of payload.cards) {
      tx.update(cards).set({ isSynced: true }).where(eq(cards.id, c.id)).run();
    }
    for (const p of payload.palaces) {
      tx.update(palaces).set({ isSynced: true }).where(eq(palaces.id, p.id)).run();
    }
    for (const s of payload.sessions) {
      tx.update(sessions).set({ isSynced: true }).where(eq(sessions.id, s.id)).run();
    }
    const clear = (table: string, ids: string[]) => {
      if (ids.length === 0) return;
      tx.delete(syncOutbox)
        .where(and(eq(syncOutbox.tableName, table), inArray(syncOutbox.rowId, ids)))
        .run();
    };
    clear(
      'review_log',
      payload.reviewLog.map((r) => r.id),
    );
    clear(
      'ability_log',
      payload.abilityLog.map((a) => a.id),
    );
    clear(
      'assessments',
      payload.assessments.map((a) => a.id),
    );
  });
}

// ---------------------------------------------------------------------------
// Applying what was pulled
// ---------------------------------------------------------------------------

export interface ApplyResult {
  /** Rows written from the remote side. */
  applied: number;
  /** Rows where the local copy won and stays pending push. */
  keptLocal: number;
  /** Class A rows inserted — these drive the derived-state recompute. */
  insertedLogRows: number;
}

/**
 * Merge a pulled payload into the local database, then recompute derived state.
 *
 * Class A (review_log / ability_log / assessments) merges as a set union: insert
 * what's missing, never touch what's there. That is the whole conflict strategy
 * for the scientific record — and it is also the only thing the append-only
 * triggers permit, which is the strongest sign the taxonomy is right.
 */
export function applyPullPayload(db: Db, payload: SyncPayload): ApplyResult {
  const result: ApplyResult = { applied: 0, keptLocal: 0, insertedLogRows: 0 };
  const touchedCardIds = new Set<string>();

  db.transaction((tx) => {
    // --- Class C: cards -----------------------------------------------------
    for (const remote of payload.cards) {
      const local = tx.select().from(cards).where(eq(cards.id, remote.id)).get();
      if (local === undefined) {
        tx.insert(cards)
          .values({
            id: remote.id,
            module: remote.module,
            front: remote.front,
            back: remote.back,
            payload: remote.payload,
            createdAt: new Date(remote.created_at),
            updatedAt: new Date(remote.updated_at),
            isDeleted: remote.is_deleted,
            isSynced: true,
          })
          .run();
        // A brand-new card needs its 1:1 FSRS row; replay fills it in below.
        tx.insert(fsrsState)
          .values({ cardId: remote.id, ...replayCardState(new Date(remote.created_at), []) })
          .run();
        touchedCardIds.add(remote.id);
        result.applied += 1;
        continue;
      }
      const winner = resolveWinner(
        { updatedAt: local.updatedAt.getTime(), isDeleted: local.isDeleted },
        { updatedAt: remote.updated_at, isDeleted: remote.is_deleted },
        !local.isSynced,
        localDeviceId(tx),
        remote.device_id,
      );
      if (winner === 'local') {
        result.keptLocal += 1;
        continue;
      }
      // Two-step (see the file header): content first, then the clean marker.
      tx.update(cards)
        .set({
          module: remote.module,
          front: remote.front,
          back: remote.back,
          payload: remote.payload,
          isDeleted: remote.is_deleted,
        })
        .where(eq(cards.id, remote.id))
        .run();
      tx.update(cards)
        .set({ isSynced: true, updatedAt: new Date(remote.updated_at) })
        .where(eq(cards.id, remote.id))
        .run();
      result.applied += 1;
    }

    // --- Class C/D: palaces, carrying their whole loci list -----------------
    for (const remote of payload.palaces) {
      const local = tx.select().from(palaces).where(eq(palaces.id, remote.id)).get();
      const isNew = local === undefined;
      if (!isNew) {
        const winner = resolveWinner(
          { updatedAt: local.updatedAt.getTime(), isDeleted: local.isDeleted },
          { updatedAt: remote.updated_at, isDeleted: remote.is_deleted },
          !local.isSynced,
          localDeviceId(tx),
          remote.device_id,
        );
        if (winner === 'local') {
          result.keptLocal += 1;
          continue;
        }
      }

      if (isNew) {
        tx.insert(palaces)
          .values({
            id: remote.id,
            name: remote.name,
            createdAt: new Date(remote.created_at),
            updatedAt: new Date(remote.updated_at),
            isDeleted: remote.is_deleted,
            isSynced: true,
          })
          .run();
      } else {
        tx.update(palaces)
          .set({ name: remote.name, isDeleted: remote.is_deleted })
          .where(eq(palaces.id, remote.id))
          .run();
      }

      // Whole-list replace. Deleting then re-inserting inside one transaction is
      // what keeps UNIQUE(palace_id, position) satisfiable: a partial row-wise
      // merge could transiently place two loci at the same position and abort.
      tx.delete(loci).where(eq(loci.palaceId, remote.id)).run();
      for (const l of remote.loci) {
        tx.insert(loci)
          .values({
            id: l.id,
            palaceId: l.palace_id,
            position: l.position,
            label: l.label,
            cue: l.cue,
            createdAt: new Date(l.created_at),
          })
          .run();
      }
      // Those loci writes fired loci_bump_palace_*, dirtying the palace we just
      // accepted. This is the second step that settles it clean again.
      tx.update(palaces)
        .set({ isSynced: true, updatedAt: new Date(remote.updated_at) })
        .where(eq(palaces.id, remote.id))
        .run();
      result.applied += 1;
    }

    // --- Class C: sessions (no tombstone) -----------------------------------
    for (const remote of payload.sessions) {
      const local = tx.select().from(sessions).where(eq(sessions.id, remote.id)).get();
      if (local === undefined) {
        tx.insert(sessions)
          .values({
            id: remote.id,
            started: new Date(remote.started),
            ended: remote.ended === null ? null : new Date(remote.ended),
            module: remote.module,
            items: remote.items,
            accuracy: remote.accuracy,
            updatedAt: new Date(remote.updated_at),
            isSynced: true,
          })
          .run();
        result.applied += 1;
        continue;
      }
      const winner = resolveWinner(
        { updatedAt: local.updatedAt.getTime(), isDeleted: false },
        { updatedAt: remote.updated_at, isDeleted: false },
        !local.isSynced,
        localDeviceId(tx),
        remote.device_id,
      );
      if (winner === 'local') {
        result.keptLocal += 1;
        continue;
      }
      tx.update(sessions)
        .set({
          ended: remote.ended === null ? null : new Date(remote.ended),
          items: remote.items,
          accuracy: remote.accuracy,
        })
        .where(eq(sessions.id, remote.id))
        .run();
      tx.update(sessions)
        .set({ isSynced: true, updatedAt: new Date(remote.updated_at) })
        .where(eq(sessions.id, remote.id))
        .run();
      result.applied += 1;
    }
    // --- Class A: union by primary key -------------------------------------
    // Runs AFTER the mutable tables above, deliberately: review_log.card_id is
    // a foreign key to cards, so a payload carrying a new card and its first
    // reviews only merges in one pass if the card lands first.
    for (const r of payload.reviewLog) {
      const exists = tx
        .select({ id: reviewLog.id })
        .from(reviewLog)
        .where(eq(reviewLog.id, r.id))
        .get();
      if (exists) continue;
      // The card must exist locally first — review_log.card_id is a FK. A review
      // whose card hasn't arrived yet is skipped and picked up on a later sync
      // rather than aborting the whole merge.
      const card = tx.select({ id: cards.id }).from(cards).where(eq(cards.id, r.card_id)).get();
      if (!card) continue;
      tx.insert(reviewLog)
        .values({
          id: r.id,
          cardId: r.card_id,
          ts: new Date(r.ts),
          rating: r.rating,
          elapsedMs: r.elapsed_ms,
          difficulty: r.difficulty,
          stability: r.stability,
          retrievability: r.retrievability,
        })
        .run();
      // The insert trigger queued this row for push; it came FROM the server, so
      // dequeue it rather than echoing it straight back.
      tx.delete(syncOutbox)
        .where(and(eq(syncOutbox.tableName, 'review_log'), eq(syncOutbox.rowId, r.id)))
        .run();
      touchedCardIds.add(r.card_id);
      result.insertedLogRows += 1;
    }

    for (const a of payload.abilityLog) {
      const exists = tx
        .select({ id: abilityLog.id })
        .from(abilityLog)
        .where(eq(abilityLog.id, a.id))
        .get();
      if (exists) continue;
      tx.insert(abilityLog)
        .values({ id: a.id, module: a.module, elo: a.elo, ts: new Date(a.ts) })
        .run();
      tx.delete(syncOutbox)
        .where(and(eq(syncOutbox.tableName, 'ability_log'), eq(syncOutbox.rowId, a.id)))
        .run();
      result.insertedLogRows += 1;
    }

    for (const a of payload.assessments) {
      const exists = tx
        .select({ id: assessments.id })
        .from(assessments)
        .where(eq(assessments.id, a.id))
        .get();
      if (exists) continue;
      tx.insert(assessments)
        .values({
          id: a.id,
          instrument: a.instrument,
          rawScore: a.raw_score,
          normalized: a.normalized,
          payload: a.payload,
          ts: new Date(a.ts),
        })
        .run();
      tx.delete(syncOutbox)
        .where(and(eq(syncOutbox.tableName, 'assessments'), eq(syncOutbox.rowId, a.id)))
        .run();
      result.insertedLogRows += 1;
    }
  });

  // Class B is rebuilt from the merged class A, outside the merge transaction
  // so a replay failure can't roll back an otherwise-good merge.
  recomputeDerivedState(db, [...touchedCardIds]);
  return result;
}

/**
 * Thin adapter so the pure engine owns the policy (engine/sync/resolve.ts).
 * Uses `shouldApplyRemote`, not `resolveRow`: the question here is "is there
 * anything to write", which additionally skips rows we already hold at the same
 * version — the property that makes a repeated pull a genuine no-op.
 */
function resolveWinner(
  local: { updatedAt: number; isDeleted: boolean },
  remote: { updatedAt: number; isDeleted: boolean },
  localIsDirty: boolean,
  localDevice: string,
  remoteDevice: string,
): 'local' | 'remote' {
  const apply = shouldApplyRemote(
    { id: '', updatedAt: local.updatedAt, isDeleted: local.isDeleted, deviceId: localDevice },
    { id: '', updatedAt: remote.updatedAt, isDeleted: remote.isDeleted, deviceId: remoteDevice },
    localIsDirty,
  );
  return apply ? 'remote' : 'local';
}

function localDeviceId(db: Db): string {
  return getDeviceId(db);
}

/**
 * Rebuild class B after a merge (design doc §3.2): replay each touched card's
 * merged review history, and refresh each module's Elo cache from the merged
 * ability_log. Only cards whose history actually changed are rewritten, so a
 * no-op sync doesn't dirty the whole database and push it all back.
 */
export function recomputeDerivedState(db: Db, cardIds: readonly string[]): number {
  let rewritten = 0;
  for (const cardId of cardIds) {
    const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
    if (!card) continue;
    const history = db
      .select({ ts: reviewLog.ts, rating: reviewLog.rating })
      .from(reviewLog)
      .where(eq(reviewLog.cardId, cardId))
      .all();
    const replayed = replayCardState(card.createdAt, history);
    const current = db.select().from(fsrsState).where(eq(fsrsState.cardId, cardId)).get();
    if (current && !cardStateDiffers(replayed, current)) continue;
    db.insert(fsrsState)
      .values({ cardId, ...replayed })
      .onConflictDoUpdate({ target: fsrsState.cardId, set: { ...replayed } })
      .run();
    rewritten += 1;
  }

  // ability_ratings is a cache of the newest ability_log entry per module.
  const latest = latestEloByModule(db.select().from(abilityLog).all());
  for (const [module, entry] of latest) {
    db.insert(abilityRatings)
      .values({ module, elo: entry.elo, updatedAt: entry.ts })
      .onConflictDoUpdate({
        target: abilityRatings.module,
        set: { elo: entry.elo, updatedAt: entry.ts },
      })
      .run();
  }
  return rewritten;
}

/** Total rows still waiting to be pushed — drives the "N pending" status line. */
export function countPending(db: Db): number {
  const dirty = (table: typeof cards | typeof palaces | typeof sessions) =>
    db
      .select({ n: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.isSynced, false))
      .get()?.n ?? 0;
  const queued =
    db
      .select({ n: sql<number>`count(*)` })
      .from(syncOutbox)
      .get()?.n ?? 0;
  return dirty(cards) + dirty(palaces) + dirty(sessions) + queued;
}
