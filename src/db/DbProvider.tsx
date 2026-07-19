import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Text } from 'react-native';
import { createDb } from './client';
import type { Db } from './types';

const DbContext = createContext<Db | null>(null);

/**
 * Opens the platform database once (migrations run inside createDb) and gates
 * children on readiness. The AppDb -> Db cast mirrors src/db/testing.ts — both
 * platform drivers satisfy the synchronous query-layer handle.
 */
export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    createDb().then(
      (d) => {
        if (live) setDb(d as unknown as Db);
      },
      (e: unknown) => {
        if (live) setError(String(e));
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (error !== null) return <Text>Database failed to open: {error}</Text>;
  if (db === null) return null;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (db === null) throw new Error('useDb must be used inside DbProvider');
  return db;
}
