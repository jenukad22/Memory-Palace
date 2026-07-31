import { describe, expect, it } from 'vitest';
import { resolveRow, shouldApplyRemote, type SyncableRow } from './resolve';

const row = (over: Partial<SyncableRow> = {}): SyncableRow => ({
  id: 'r1',
  updatedAt: 1000,
  isDeleted: false,
  deviceId: 'device-a',
  ...over,
});

describe('resolveRow', () => {
  it('takes the remote row when there is no local row', () => {
    expect(resolveRow(undefined, row(), false)).toBe('remote');
    expect(resolveRow(undefined, row({ isDeleted: true }), false)).toBe('remote');
  });

  it('does NOT let an older remote row clobber a newer clean local row', () => {
    // The server is dumb storage and can legitimately hold an older version
    // (another device pushed a stale row after ours). Overwriting on "local is
    // clean" alone would silently regress the row to that older state.
    const local = row({ updatedAt: 9999 });
    const remote = row({ updatedAt: 1, deviceId: 'device-b' });
    expect(resolveRow(local, remote, false)).toBe('local');
  });

  it('takes a genuinely newer remote row over a clean local one', () => {
    const local = row({ updatedAt: 1000 });
    const remote = row({ updatedAt: 2000, deviceId: 'device-b' });
    expect(resolveRow(local, remote, false)).toBe('remote');
  });

  it('applies last-writer-wins between two genuinely concurrent edits', () => {
    const local = row({ updatedAt: 2000 });
    const newer = row({ updatedAt: 3000, deviceId: 'device-b' });
    const older = row({ updatedAt: 1000, deviceId: 'device-b' });
    expect(resolveRow(local, newer, true)).toBe('remote');
    expect(resolveRow(local, older, true)).toBe('local');
  });

  it('lets a remote tombstone beat a newer local edit', () => {
    const local = row({ updatedAt: 5000, isDeleted: false });
    const remoteDelete = row({ updatedAt: 1000, isDeleted: true, deviceId: 'device-b' });
    expect(resolveRow(local, remoteDelete, true)).toBe('remote');
  });

  it('lets a local tombstone beat a newer remote edit', () => {
    const localDelete = row({ updatedAt: 1000, isDeleted: true });
    const remoteEdit = row({ updatedAt: 5000, isDeleted: false, deviceId: 'device-b' });
    expect(resolveRow(localDelete, remoteEdit, true)).toBe('local');
  });

  it('falls back to timestamps when both sides are tombstones', () => {
    const local = row({ updatedAt: 1000, isDeleted: true });
    const remote = row({ updatedAt: 2000, isDeleted: true, deviceId: 'device-b' });
    expect(resolveRow(local, remote, true)).toBe('remote');
  });

  it('breaks an exact timestamp tie on device id, the same way on both machines', () => {
    const a = row({ updatedAt: 4000, deviceId: 'device-a' });
    const b = row({ updatedAt: 4000, deviceId: 'device-b' });
    // Machine A sees (local=a, remote=b); machine B sees (local=b, remote=a).
    // Both must end up with b's copy, or the two devices never converge.
    expect(resolveRow(a, b, true)).toBe('remote'); // A takes b
    expect(resolveRow(b, a, true)).toBe('local'); // B keeps b
  });

  it('is deterministic — resolving twice gives the same answer', () => {
    const local = row({ updatedAt: 2000 });
    const remote = row({ updatedAt: 2000, deviceId: 'device-z' });
    expect(resolveRow(local, remote, true)).toBe(resolveRow(local, remote, true));
  });

  it('never loses a delete in either direction', () => {
    // Whichever way round, the surviving decision is the tombstone side.
    const del = row({ updatedAt: 100, isDeleted: true, deviceId: 'device-a' });
    const edit = row({ updatedAt: 900, isDeleted: false, deviceId: 'device-b' });
    expect(resolveRow(edit, del, true)).toBe('remote'); // remote delete wins
    expect(resolveRow(del, edit, true)).toBe('local'); // local delete wins
  });
});

describe('shouldApplyRemote', () => {
  it('applies a row the device has never seen', () => {
    expect(shouldApplyRemote(undefined, row(), false)).toBe(true);
  });

  it('applies a genuinely newer remote row', () => {
    const local = row({ updatedAt: 2000 });
    expect(shouldApplyRemote(local, row({ updatedAt: 3000, deviceId: 'device-b' }), true)).toBe(
      true,
    );
  });

  it('skips a row we already hold at the same version — pulls must be idempotent', () => {
    // Without this, every pull rewrites every row it sees, the dirty trigger
    // re-fires, and the device pushes back what it was just given, forever.
    expect(shouldApplyRemote(row(), row({ deviceId: 'device-b' }), false)).toBe(false);
  });

  it('still resolves a same-timestamp row when the local copy is dirty', () => {
    // Equal timestamps plus a real unpushed local edit is a genuine conflict,
    // so it goes through resolution rather than being skipped.
    const local = row({ updatedAt: 4000, deviceId: 'device-a' });
    const remote = row({ updatedAt: 4000, deviceId: 'device-b' });
    expect(shouldApplyRemote(local, remote, true)).toBe(true);
  });

  it('does not skip when the tombstone flag differs at the same timestamp', () => {
    const local = row({ updatedAt: 4000, isDeleted: false });
    const remote = row({ updatedAt: 4000, isDeleted: true, deviceId: 'device-b' });
    expect(shouldApplyRemote(local, remote, false)).toBe(true);
  });

  it('does not apply an older remote row', () => {
    const local = row({ updatedAt: 2000 });
    expect(shouldApplyRemote(local, row({ updatedAt: 10, deviceId: 'device-b' }), true)).toBe(
      false,
    );
  });
});
