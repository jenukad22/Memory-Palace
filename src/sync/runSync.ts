/**
 * The sync cycle (docs/superpowers/specs/2026-07-31-supabase-sync-design.md §2.2).
 *
 * pull -> resolve -> recompute -> push -> advance cursor.
 *
 * Two ordering rules carry the offline→online behaviour, and both are asserted
 * in runSync.test.ts:
 *
 * - **Push goes last.** A locally-won conflict then propagates outward in the
 *   same cycle instead of waiting for the next one.
 * - **The outbox is cleared only after the server confirms.** A dropped
 *   connection mid-push leaves rows dirty and queued, so the next cycle
 *   re-sends them. The append-only tables have no other record that a row still
 *   needs pushing, so clearing early would lose it permanently.
 *
 * Every step is idempotent — merges are keyed on client-generated UUIDs and the
 * resolver is deterministic — so an interrupted cycle is always safe to re-run.
 */

// Query modules directly, not the `@/db` barrel: the barrel re-exports
// DbProvider (React Native), which cannot be loaded under plain Vitest/Node.
// Same reason modules/attention/results.ts does this.
import {
  applyPullPayload,
  checkSyncedUser,
  collectPushPayload,
  countPending,
  getDeviceId,
  getPullCursor,
  getSyncMeta,
  markPayloadSynced,
  payloadSize,
  setPullCursor,
  setSyncMeta,
  SYNC_META,
} from '@/db/queries/sync';
import type { Db } from '@/db/types';
import { DifferentUserError, type SyncTransport } from './transport';

export interface SyncOutcome {
  pulled: number;
  applied: number;
  keptLocal: number;
  pushed: number;
  /** Rows still awaiting push after this cycle (non-zero after a failed push). */
  pending: number;
  cursor: string;
}

export interface RunSyncOptions {
  db: Db;
  transport: SyncTransport;
  /** The signed-in account. Guards against merging two users' data (§4.1). */
  userId: string;
  now?: Date;
}

export async function runSync({
  db,
  transport,
  userId,
  now = new Date(),
}: RunSyncOptions): Promise<SyncOutcome> {
  const userCheck = checkSyncedUser(db, userId);
  if (userCheck === 'different-user') throw new DifferentUserError();
  if (userCheck === 'first-sync') setSyncMeta(db, SYNC_META.syncedUserId, userId);

  const deviceId = getDeviceId(db);

  // 1-3. Pull, resolve, and recompute derived state (applyPullPayload does the
  // last of those itself, since only it knows which cards were touched).
  const { payload: incoming, cursor } = await transport.pull(getPullCursor(db));
  const applyResult = applyPullPayload(db, incoming);

  // 4. Push whatever is still dirty — including rows that just won a conflict.
  const outgoing = collectPushPayload(db, deviceId);
  const pushed = payloadSize(outgoing);
  if (pushed > 0) {
    await transport.push(outgoing);
    // Only now: the server has it.
    markPayloadSynced(db, outgoing);
  }

  // 5. Advance the cursor last, so a failure anywhere above re-pulls the same
  // window next time rather than skipping it.
  setPullCursor(db, cursor);
  setSyncMeta(db, SYNC_META.lastSyncedAt, String(now.getTime()));

  return {
    pulled: payloadSize(incoming),
    applied: applyResult.applied,
    keptLocal: applyResult.keptLocal,
    pushed,
    pending: countPending(db),
    cursor,
  };
}

/** Epoch ms of the last completed sync, or null if it has never run. */
export function getLastSyncedAt(db: Db): number | null {
  const raw = getSyncMeta(db, SYNC_META.lastSyncedAt);
  if (raw === null) return null;
  const ms = Number(raw);
  return Number.isFinite(ms) ? ms : null;
}
