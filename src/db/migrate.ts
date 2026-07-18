import { sql } from 'drizzle-orm';
import { MIGRATIONS } from './migrations.generated';
import type { Db } from './types';

/**
 * Applies any not-yet-applied migrations in order, tracking them in a
 * `_migrations` table. Idempotent and identical on expo-sqlite and sql.js.
 */
export function runMigrations(db: Db): void {
  db.run(
    sql`CREATE TABLE IF NOT EXISTS _migrations (tag TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)`,
  );
  const appliedRows = db.all(sql`SELECT tag FROM _migrations`) as { tag: string }[];
  const applied = new Set(appliedRows.map((r) => r.tag));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.tag)) continue;
    db.transaction((tx) => {
      for (const statement of migration.statements) {
        tx.run(sql.raw(statement));
      }
      tx.run(
        sql`INSERT INTO _migrations (tag, applied_at) VALUES (${migration.tag}, ${Date.now()})`,
      );
    });
  }
}
