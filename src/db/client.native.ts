import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { runMigrations } from './migrate';
import * as schema from './schema';
import type { Db } from './types';

export type AppDb = ExpoSQLiteDatabase<typeof schema>;

export async function createDb(): Promise<AppDb> {
  const sqlite = openDatabaseSync('memory-palace.db');
  sqlite.execSync('PRAGMA journal_mode = WAL;'); // NATIVE ONLY — never issued on web
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  runMigrations(db as unknown as Db);
  return db;
}
