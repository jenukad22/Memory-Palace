// Web-only IndexedDB persistence for the in-memory sql.js database.
//
// The project's tsconfig intentionally omits the DOM lib (it targets React
// Native), so referencing `lib.dom` here would pollute the whole program and
// clash with the Node-oriented config files. Instead we declare exactly the
// browser globals this module uses — module-scoped ambient declarations, no
// global fallout, no `any`.

interface IdbRequest<T> {
  result: T;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}
interface IdbOpenRequest extends IdbRequest<IdbDatabase> {
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
}
interface IdbObjectStore {
  get(key: string): IdbRequest<unknown>;
  put(value: unknown, key: string): IdbRequest<unknown>;
}
interface IdbTransaction {
  objectStore(name: string): IdbObjectStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  error: unknown;
}
interface IdbDatabase {
  createObjectStore(name: string): IdbObjectStore;
  transaction(store: string, mode: 'readonly' | 'readwrite'): IdbTransaction;
}

declare const indexedDB: { open(name: string, version?: number): IdbOpenRequest };
declare const window: { addEventListener(type: string, listener: () => void): void } | undefined;
declare const document: { visibilityState: string };
declare function setTimeout(handler: () => void, timeout: number): number;
declare function clearTimeout(id: number): void;

const DB_NAME = 'memory-palace-persist';
const STORE = 'sqlite';
const KEY = 'db';
const SAVE_DEBOUNCE_MS = 500;

/**
 * How long to wait for indexedDB.open() before giving up. The silent hang is
 * the actual failure mode this guards against, not any one specific cause —
 * `onblocked` (another connection holding an older version) is the known
 * culprit, but the timeout is a backstop against any stall, known or not: it
 * always turns "the app never renders" into a caught rejection DbProvider can
 * show the user.
 */
export const IDB_OPEN_TIMEOUT_MS = 10_000;

/** Exported for tests — not part of the module's public persistence API. */
export function openIdb(): Promise<IdbDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sawUpgrade = false;
    let sawBlocked = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `IndexedDB open timed out after ${IDB_OPEN_TIMEOUT_MS}ms` +
            (sawBlocked ? ' — blocked by another connection that never released it' : ''),
        ),
      );
    }, IDB_OPEN_TIMEOUT_MS);

    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      sawUpgrade = true;
      req.result.createObjectStore(STORE);
    };

    // A blocked open can still succeed once the blocking connection closes —
    // don't reject here; the timeout above is the backstop if it never does.
    req.onblocked = () => {
      sawBlocked = true;
    };

    req.onsuccess = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // __DEV__ is a real global under Metro; absent under plain Node/Vitest.
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const path = sawBlocked ? 'blocked-then-recovered' : sawUpgrade ? 'upgrade' : 'fresh open';
        console.log(`[db] IndexedDB opened (${path})`);
      }
      resolve(req.result);
    };

    req.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
  });
}

export async function loadBytes(): Promise<Uint8Array | undefined> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function putBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bytes, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Debounced autosave + flush on tab-hide. IndexedDB writes are async, so a flush
 * started in pagehide usually — but not provably — completes before the tab
 * dies. Residual risk: a crash between the last write and flush loses that
 * write. Documented in README.md.
 */
export function createPersister(exportBytes: () => Uint8Array): {
  markDirty: () => void;
  flush: () => void;
} {
  let timer: number | undefined;
  const save = () => void putBytes(exportBytes());
  const markDirty = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  };
  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    save();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
  return { markDirty, flush };
}
