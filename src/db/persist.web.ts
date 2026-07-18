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

function openIdb(): Promise<IdbDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
