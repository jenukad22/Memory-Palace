import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * Common handle for query functions. Both the expo-sqlite and sql.js Drizzle
 * databases are synchronous SQLite drivers and satisfy this type.
 */
export type Db = BaseSQLiteDatabase<'sync', unknown>;
