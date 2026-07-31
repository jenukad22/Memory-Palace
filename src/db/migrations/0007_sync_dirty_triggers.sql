-- Hand-authored (triggers aren't representable in drizzle-kit snapshots, same as
-- 0001/0005). Registered by hand in meta/_journal.json with a chain-linked
-- snapshot, or migrations-consistency.test.ts fails.
--
-- Sync dirty-marking, per docs/superpowers/specs/2026-07-31-supabase-sync-design.md §2.1.
--
-- Why triggers rather than marking rows dirty at each call site: paths that
-- mutate synced tables already exist and know nothing about sync (upsertPaoEntry
-- rewrites cards.back/payload directly; reorderLoci rewrites every locus
-- position). Relying on every current and future query function to remember
-- `is_synced = 0` is exactly the invariant this codebase already chose to put in
-- the database instead — see the append-only triggers in 0001/0005.
--
-- The `WHEN NEW.is_synced = OLD.is_synced` guard is what lets the sync writer
-- flip a row to is_synced = 1 without the trigger immediately dirtying it again.
-- SQLite's recursive triggers are off by default, so the inner UPDATE does not
-- re-fire regardless.

-- Backfill: existing rows predate the column and default to 0, which would make
-- every one of them look older than any incoming row. Seed from the row's own
-- creation time so a first sync compares something meaningful.
UPDATE cards SET updated_at = created_at WHERE updated_at = 0;
--> statement-breakpoint
UPDATE palaces SET updated_at = created_at WHERE updated_at = 0;
--> statement-breakpoint
UPDATE sessions SET updated_at = started WHERE updated_at = 0;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Class C mutable rows: any update marks the row dirty and stamps updated_at.
-- Millisecond precision (strftime('%s') would only give whole seconds, too
-- coarse for the updated_at tie-break in resolveRow).
-- ---------------------------------------------------------------------------
CREATE TRIGGER cards_mark_dirty AFTER UPDATE ON cards
WHEN NEW.is_synced = OLD.is_synced
BEGIN
  UPDATE cards
  SET is_synced = 0,
      updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER palaces_mark_dirty AFTER UPDATE ON palaces
WHEN NEW.is_synced = OLD.is_synced
BEGIN
  UPDATE palaces
  SET is_synced = 0,
      updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER sessions_mark_dirty AFTER UPDATE ON sessions
WHEN NEW.is_synced = OLD.is_synced
BEGIN
  UPDATE sessions
  SET is_synced = 0,
      updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE id = NEW.id;
END;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Class D: a palace's loci list is ONE logical value versioned by the palace
-- row (design doc §3.4). Any locus change dirties the parent palace, never the
-- locus itself — which is what keeps the whole-list merge incapable of
-- violating UNIQUE(palace_id, position).
-- ---------------------------------------------------------------------------
CREATE TRIGGER loci_bump_palace_insert AFTER INSERT ON loci
BEGIN
  UPDATE palaces
  SET is_synced = 0,
      updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE id = NEW.palace_id;
END;
--> statement-breakpoint
CREATE TRIGGER loci_bump_palace_update AFTER UPDATE ON loci
BEGIN
  UPDATE palaces
  SET is_synced = 0,
      updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE id = NEW.palace_id;
END;
--> statement-breakpoint
CREATE TRIGGER loci_bump_palace_delete AFTER DELETE ON loci
BEGIN
  UPDATE palaces
  SET is_synced = 0,
      updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
  WHERE id = OLD.palace_id;
END;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Class A append-only tables: queue inserts in sync_outbox.
--
-- These tables CANNOT use is_synced — their append-only triggers abort any
-- UPDATE, including one that only flips a sync flag, so a row could never be
-- marked clean again. Queuing the id in a separate table is the only mechanism
-- compatible with the append-only guarantee.
-- ---------------------------------------------------------------------------
CREATE TRIGGER review_log_queue_push AFTER INSERT ON review_log
BEGIN
  INSERT OR IGNORE INTO sync_outbox (table_name, row_id, queued_at)
  VALUES ('review_log', NEW.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
END;
--> statement-breakpoint
CREATE TRIGGER ability_log_queue_push AFTER INSERT ON ability_log
BEGIN
  INSERT OR IGNORE INTO sync_outbox (table_name, row_id, queued_at)
  VALUES ('ability_log', NEW.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
END;
--> statement-breakpoint
CREATE TRIGGER assessments_queue_push AFTER INSERT ON assessments
BEGIN
  INSERT OR IGNORE INTO sync_outbox (table_name, row_id, queued_at)
  VALUES ('assessments', NEW.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
END;
