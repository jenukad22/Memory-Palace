/**
 * The Supabase implementation of SyncTransport (design doc §6).
 *
 * Deliberately thin: it moves rows and nothing else. Every merge decision lives
 * in the pure engine and the query layer, which is why the interesting
 * behaviour is testable in Node against a fake and this file stays a mapping
 * exercise.
 *
 * Server tables mirror the wire shapes 1:1 and add `user_id` (RLS) and
 * `server_updated_at` (`default now()`), which is what the cursor tracks —
 * never a client clock. See docs/supabase-schema.sql.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncPayload } from '@/db/queries/sync';
import { emptyPayload } from '@/db/queries/sync';
import type { PullResult, SyncTransport } from './transport';

/** Server table names, in the order a pull must be applied. */
const TABLES = {
  cards: 'sync_cards',
  palaces: 'sync_palaces',
  sessions: 'sync_sessions',
  reviewLog: 'sync_review_log',
  abilityLog: 'sync_ability_log',
  assessments: 'sync_assessments',
} as const;

const CURSOR_COLUMN = 'server_updated_at';

export function createSupabaseTransport(client: SupabaseClient, userId: string): SyncTransport {
  /** Strip server-only columns so what comes back matches the wire shape. */
  const clean = <T extends Record<string, unknown>>(rows: T[]): T[] =>
    rows.map(({ user_id: _u, server_updated_at: _s, ...rest }) => rest as unknown as T);

  return {
    async pull(cursor: string): Promise<PullResult> {
      const since = cursor === '0' ? new Date(0).toISOString() : cursor;
      const payload = emptyPayload();
      let maxCursor = since;

      for (const [key, table] of Object.entries(TABLES) as [keyof SyncPayload, string][]) {
        const { data, error } = await client
          .from(table)
          .select('*')
          .gt(CURSOR_COLUMN, since)
          .order(CURSOR_COLUMN, { ascending: true });
        if (error) throw new Error(`sync pull failed on ${table}: ${error.message}`);

        const rows = (data ?? []) as Record<string, unknown>[];
        for (const row of rows) {
          const stamp = String(row[CURSOR_COLUMN] ?? '');
          if (stamp > maxCursor) maxCursor = stamp;
        }
        // The cast is safe: the server columns mirror the wire shapes exactly.
        (payload[key] as unknown[]) = clean(rows);
      }

      return { payload, cursor: maxCursor };
    },

    async push(payload: SyncPayload): Promise<void> {
      for (const [key, table] of Object.entries(TABLES) as [keyof SyncPayload, string][]) {
        const rows = payload[key];
        if (rows.length === 0) continue;
        // Upsert on the primary key — push must be idempotent, because runSync
        // re-sends anything an interrupted cycle left unconfirmed.
        const { error } = await client.from(table).upsert(
          rows.map((r) => ({ ...r, user_id: userId })),
          { onConflict: 'id' },
        );
        if (error) throw new Error(`sync push failed on ${table}: ${error.message}`);
      }
    },
  };
}
