import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import initSqlJs, { type Database } from 'sql.js';
// Metro resolves the wasm to an asset URL (see metro.config.js).
// @ts-expect-error - wasm module has no type declaration
import wasmUrl from 'sql.js/dist/sql-wasm.wasm';
import { runMigrations } from './migrate';
import { createPersister, loadBytes } from './persist.web';
import * as schema from './schema';
import type { Db } from './types';

export type AppDb = SQLJsDatabase<typeof schema>;

export async function createDb(): Promise<AppDb> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl as string });
  const saved = await loadBytes();
  const sqlite: Database = saved ? new SQL.Database(saved) : new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON;'); // matches native — no FK asymmetry
  const db = drizzle(sqlite, { schema });
  runMigrations(db as unknown as Db);

  const { markDirty } = createPersister(() => sqlite.export());
  return wrapForPersistence(db, markDirty);
}

// Mark the store dirty whenever a write builder is invoked. Wrapping at our own
// boundary (insert/update/delete/transaction) avoids depending on driver internals.
function wrapForPersistence(db: AppDb, markDirty: () => void): AppDb {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'transaction') {
        return (...args: unknown[]) => {
          markDirty();
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
