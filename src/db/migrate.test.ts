import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate';
import { createTestDb } from './testing';
import type { Db } from './types';

describe('runMigrations', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  const names = (type: string) =>
    (db.all(sql`SELECT name FROM sqlite_master WHERE type = ${type}`) as { name: string }[]).map(
      (r) => r.name,
    );

  it('creates all six tables', () => {
    const tables = names('table');
    for (const t of [
      'cards',
      'fsrs_state',
      'review_log',
      'assessments',
      'ability_ratings',
      'sessions',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('creates the four indexes', () => {
    const idx = names('index');
    for (const i of [
      'cards_module_is_deleted_idx',
      'fsrs_state_due_idx',
      'review_log_card_id_idx',
      'review_log_ts_idx',
    ]) {
      expect(idx).toContain(i);
    }
  });

  it('creates the append-only triggers', () => {
    expect(names('trigger')).toEqual(
      expect.arrayContaining(['review_log_no_update', 'review_log_no_delete']),
    );
  });

  it('is idempotent (second run applies nothing new)', () => {
    runMigrations(db); // already ran in createTestDb; must not throw
    const applied = db.all(sql`SELECT tag FROM _migrations`) as { tag: string }[];
    expect(applied.length).toBe(2);
  });

  it('blocks UPDATE and DELETE on review_log via triggers', () => {
    db.run(
      sql`INSERT INTO cards (id, module, front, back, created_at, is_synced, is_deleted) VALUES ('c1','memory','f','b',0,0,0)`,
    );
    db.run(
      sql`INSERT INTO review_log (id, card_id, ts, rating, elapsed_ms, difficulty, stability, retrievability) VALUES ('r1','c1',0,'good',10,5,1,0.9)`,
    );
    // The RAISE(ABORT) message is wrapped differently per driver (sql.js hides
    // it), so assert the mutation throws AND leaves the row intact — that proves
    // the trigger blocked it rather than some unrelated error.
    expect(() => db.run(sql`UPDATE review_log SET rating = 'easy' WHERE id = 'r1'`)).toThrow();
    expect(() => db.run(sql`DELETE FROM review_log WHERE id = 'r1'`)).toThrow();
    const rows = db.all(sql`SELECT rating FROM review_log WHERE id = 'r1'`) as { rating: string }[];
    expect(rows).toEqual([{ rating: 'good' }]);
  });
});
