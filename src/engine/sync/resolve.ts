/**
 * Conflict resolution for the mutable synced tables
 * (docs/superpowers/specs/2026-07-31-supabase-sync-design.md §3.3-§3.4).
 *
 * Pure and storage-free: it decides *which side wins*, and nothing else. The
 * caller applies the decision. That split is what makes the policy — the part
 * that is genuinely a judgement call, and the part that silently loses user
 * edits if it's wrong — testable without a database or a network.
 */

/** The fields resolution actually reads. Any synced mutable row supplies these. */
export interface SyncableRow {
  id: string;
  /** Client wall clock, ms. Devices skew; see the design doc §2.3. */
  updatedAt: number;
  /** Soft-delete tombstone. Tables without one always pass false. */
  isDeleted: boolean;
  /** Which device last wrote this row — breaks `updatedAt` ties deterministically. */
  deviceId: string;
}

export type Winner = 'local' | 'remote';

/**
 * Which side of a conflict wins.
 *
 * `localIsDirty` is the whole reason this is not a plain timestamp comparison:
 * a clean local row has no unpushed edit to protect, so the remote copy is
 * simply newer information and is taken unconditionally. Only a dirty local row
 * represents a real concurrent edit, and only then does policy apply.
 *
 * Tombstones win over edits. Both tables that carry one soft-delete, so a
 * delete that beats a concurrent edit destroys nothing — the row survives with
 * `isDeleted = 1` and is recoverable. The reverse (an edit resurrecting a
 * deleted row) silently undoes an explicit user action, which is the worse
 * failure.
 */
export function resolveRow(
  local: SyncableRow | undefined,
  remote: SyncableRow,
  _localIsDirty: boolean,
): Winner {
  if (local === undefined) return 'remote';
  if (remote.isDeleted && !local.isDeleted) return 'remote';
  if (local.isDeleted && !remote.isDeleted) return 'local';
  if (remote.updatedAt > local.updatedAt) return 'remote';
  if (remote.updatedAt < local.updatedAt) return 'local';
  // Equal timestamps: break on device id so both machines reach the same
  // answer independently, rather than each keeping its own copy forever.
  // The tie-break must NOT consult `localIsDirty` — each device sees itself as
  // the dirty one, so both would keep their own copy and never converge.
  return remote.deviceId > local.deviceId ? 'remote' : 'local';
}

/**
 * Whether a pulled row needs writing at all.
 *
 * Distinct from `resolveRow` on purpose. Resolution answers "whose version is
 * right"; this answers "is there anything to do", and the difference matters
 * twice over:
 *
 * - **Idempotence.** Pulling a row we already hold at the same version must be
 *   a no-op. Without this check, every pull rewrites every row it sees, and the
 *   write re-fires the dirty-marking trigger — so the device re-pushes rows it
 *   was just given, forever.
 * - **No regression.** An equal `updatedAt` with a clean local row means we
 *   already have exactly this version (typically our own row echoed back).
 *
 * A *dirty* local row at the same timestamp is a genuine concurrent edit and
 * still goes through resolution.
 */
export function shouldApplyRemote(
  local: SyncableRow | undefined,
  remote: SyncableRow,
  localIsDirty: boolean,
): boolean {
  if (local === undefined) return true;
  if (
    !localIsDirty &&
    remote.updatedAt === local.updatedAt &&
    remote.isDeleted === local.isDeleted
  ) {
    return false;
  }
  return resolveRow(local, remote, localIsDirty) === 'remote';
}
