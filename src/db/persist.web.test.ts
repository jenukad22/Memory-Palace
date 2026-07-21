import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDB_OPEN_TIMEOUT_MS, openIdb } from './persist.web';

/**
 * openIdb() reads the ambient `indexedDB` global declared in persist.web.ts.
 * There is no real IndexedDB under plain Node/Vitest, so each test installs a
 * fake on `globalThis` and drives its request's callbacks by hand — the same
 * event shape a real browser would invoke, just triggered manually instead of
 * by the platform.
 */
interface FakeIdbRequest {
  result: { createObjectStore: (name: string) => void };
  error: unknown;
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

function installFakeIndexedDb(): { req: FakeIdbRequest } {
  const req: FakeIdbRequest = {
    result: { createObjectStore: () => {} },
    error: null,
    onupgradeneeded: null,
    onblocked: null,
    onsuccess: null,
    onerror: null,
  };
  (globalThis as Record<string, unknown>).indexedDB = {
    open: () => req,
  };
  return { req };
}

describe('openIdb', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).indexedDB;
    vi.useRealTimers();
  });

  it('resolves on a fresh open (no upgrade, no block)', async () => {
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.onsuccess!();
    await expect(promise).resolves.toBe(req.result);
  });

  it('resolves after onupgradeneeded fires (first-time create)', async () => {
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.onupgradeneeded!();
    req.onsuccess!();
    await expect(promise).resolves.toBe(req.result);
  });

  it('resolves once onsuccess follows onblocked (recovered, not rejected)', async () => {
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.onblocked!(); // another connection is holding an older version...
    req.onsuccess!(); // ...then it closes and the open goes through.
    await expect(promise).resolves.toBe(req.result);
  });

  it('rejects immediately when onerror fires', async () => {
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.error = new Error('boom');
    req.onerror!();
    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects after IDB_OPEN_TIMEOUT_MS when neither onsuccess nor onerror ever fires', async () => {
    vi.useFakeTimers();
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.onblocked!(); // stalls forever — the blocking connection never closes.

    const assertion = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(IDB_OPEN_TIMEOUT_MS);
    await assertion;
  });

  it('a rejection after the timeout has already fired names the blocked state in its message', async () => {
    vi.useFakeTimers();
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.onblocked!();

    const assertion = expect(promise).rejects.toThrow(/blocked by another connection/i);
    await vi.advanceTimersByTimeAsync(IDB_OPEN_TIMEOUT_MS);
    await assertion;
  });

  it('does not reject on timeout after it already settled via onsuccess', async () => {
    vi.useFakeTimers();
    const { req } = installFakeIndexedDb();
    const promise = openIdb();
    req.onsuccess!();
    await vi.advanceTimersByTimeAsync(IDB_OPEN_TIMEOUT_MS);
    await expect(promise).resolves.toBe(req.result);
  });
});
