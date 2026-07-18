import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

/**
 * tsc/Node fallback. Metro resolves `./client` to client.native.ts or
 * client.web.ts per platform; this bare file is what tsc and Vitest see.
 */
export type AppDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export function createDb(): Promise<AppDb> {
  throw new Error(
    'createDb: no platform client bundled — Metro should resolve client.native.ts or client.web.ts.',
  );
}
