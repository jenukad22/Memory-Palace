import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText, color, space } from '../ui';
import { createDb } from './client';
import type { Db } from './types';

const DbContext = createContext<Db | null>(null);

/**
 * Opens the platform database once (migrations run inside createDb) and gates
 * children on readiness. The AppDb -> Db cast mirrors src/db/testing.ts — both
 * platform drivers satisfy the synchronous query-layer handle. A rejection
 * (e.g. persist.web.ts's IndexedDB-open timeout) renders a visible error —
 * never an indefinite blank screen.
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
        if (live) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (error !== null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.bg0,
          justifyContent: 'center',
          padding: space.sp5,
        }}
      >
        <AppText variant="heading" color="error">
          Couldn’t open local database
        </AppText>
        <AppText variant="secondary" color="textSecondary" style={{ marginTop: space.sp2 }}>
          {error}
        </AppText>
      </View>
    );
  }
  if (db === null) return null;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (db === null) throw new Error('useDb must be used inside DbProvider');
  return db;
}
