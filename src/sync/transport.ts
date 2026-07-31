/**
 * The remote side of sync, as an interface
 * (docs/superpowers/specs/2026-07-31-supabase-sync-design.md §6).
 *
 * `runSync` depends on this, not on Supabase. That keeps the orchestration —
 * the ordering, the cursor advance, the "don't clear the outbox until the
 * server confirmed" rule — unit-testable in Node against a fake, which is the
 * only way to exercise offline→online reconciliation without a live database.
 * The Supabase implementation is one adapter behind it.
 */

import type { SyncPayload } from '@/db/queries/sync';

export interface PullResult {
  payload: SyncPayload;
  /**
   * Server-time watermark to resume from. Taken from the server's own clock,
   * never the device's, so pull completeness doesn't depend on client skew
   * (design doc §2.3).
   */
  cursor: string;
}

export interface SyncTransport {
  /** Rows changed on the server since `cursor`. */
  pull(cursor: string): Promise<PullResult>;
  /**
   * Upsert the payload. Must be idempotent on primary key — `runSync` may
   * retry after an interrupted cycle, and the append-only tables must never
   * gain a duplicate.
   */
  push(payload: SyncPayload): Promise<void>;
}

/** Raised when the signed-in account differs from the one this database holds. */
export class DifferentUserError extends Error {
  constructor() {
    super(
      'This device already holds another account’s data. Reset local data before syncing this account.',
    );
    this.name = 'DifferentUserError';
  }
}
