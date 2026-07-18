import { drizzle } from 'drizzle-orm/sql-js';
import initSqlJs from 'sql.js';
import { runMigrations } from './migrate';
import * as schema from './schema';
import type { Db } from './types';

/**
 * Fresh in-memory sql.js database with foreign keys on and all migrations
 * applied. Test-only — exercises the real schema/migrations/queries in Node.
 */
export async function createTestDb(): Promise<{ db: Db; sqlite: import('sql.js').Database }> {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema }) as unknown as Db;
  runMigrations(db);
  return { db, sqlite };
}
