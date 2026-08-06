import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `semver` is npm's own range implementation, already hoisted to the root of
 * this tree by the Expo toolchain. It is loaded this way — rather than
 * imported, or added to devDependencies alongside @types/semver — for one
 * reason: adding a dependency means running `npm install`, and doing that on
 * Windows is what wrote the broken lockfile this file exists to catch. If it
 * ever stops being reachable the tests below fail loudly, which is the right
 * outcome for a guard.
 */
const semver = createRequire(import.meta.url)('semver') as {
  satisfies(
    version: string,
    range: string,
    options?: { includePrerelease?: boolean; loose?: boolean },
  ): boolean;
};

/**
 * Guards the lockfile defects that have actually broken EAS builds here — both
 * of which surfaced ~15 minutes into a remote build rather than locally.
 *
 * 1. A PEER EDGE RESOLVING TO A NON-SATISFYING VERSION. `vite` (under `vitest`)
 *    declares `esbuild` as an optional peer at `^0.27.0 || ^0.28.0`, and npm
 *    satisfies it with a nested `vitest/node_modules/esbuild@0.28.1` plus that
 *    package's 26 platform-specific `@esbuild/*` entries. A regenerate run by
 *    npm 11 on Windows dropped that whole nested subtree, so `vite` fell
 *    through to the hoisted `esbuild@0.25.12` that `drizzle-kit` pins — which
 *    does not satisfy the range. EAS's `npm ci --include=dev` on npm 10.9.8
 *    then rebuilt its ideal tree, wanted the missing platform packages, and
 *    failed with "Missing from lock file".
 *
 *    Absence alone is legal here (the peer is optional), and every dependency
 *    edge still resolved to *something* — which is why a reachability check
 *    passes on the broken lockfile. The signal that actually separates the two
 *    is semver satisfaction, the same thing `npm ls` reports as `invalid`.
 *
 * 2. PLATFORM-RESTRICTED BUT NOT OPTIONAL. The original failure: an entry
 *    carrying `os`/`cpu` but lacking `optional: true` is a hard install
 *    requirement on platforms it cannot run on. That is how
 *    `@esbuild/aix-ppc64` — an AIX binary nothing here wants — became a
 *    mandatory install on Linux and failed with EBADPLATFORM.
 *
 * What is NOT asserted: an earlier version of this file required zero
 * `extraneous: true` entries, on the theory that they marked stale Windows
 * node_modules cruft. That was wrong twice over — npm 10.9.8 on Linux writes
 * this same subtree with no such marker while npm 11 marks it (so the flag
 * tracked npm version, not corruption), and the entries it marked were
 * load-bearing rather than junk. That assertion would have passed on the exact
 * lockfile that broke the build.
 *
 * This file is a cheap first line of defence, not the whole gate: reproducing
 * npm's ideal-tree construction statically is not tractable, so CI also runs
 * the real `npm ci --include=dev` on ubuntu-latest at EAS's pinned npm
 * version. See .github/workflows/ci.yml.
 */

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

interface LockPackageEntry {
  version?: string;
  optional?: boolean;
  os?: string[];
  cpu?: string[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface PackageLock {
  lockfileVersion: number;
  packages: Record<string, LockPackageEntry>;
}

/**
 * Reimplements npm's resolution: look for `depName` in the importer's own
 * node_modules, then in each ancestor's, up to the root. Returns the entry
 * that satisfies the edge, or null if nothing does.
 */
function resolveFrom(
  importer: string,
  depName: string,
  packages: Record<string, LockPackageEntry>,
): LockPackageEntry | null {
  let scope = importer;
  for (;;) {
    const candidate = `${scope ? `${scope}/` : ''}node_modules/${depName}`;
    const entry = packages[candidate];
    if (entry !== undefined) return entry;
    if (scope === '') return null;
    const parent = scope.lastIndexOf('/node_modules/');
    scope = parent === -1 ? '' : scope.slice(0, parent);
  }
}

describe('package-lock.json consistency', () => {
  // package-lock.json lives at the repo root; this file is one level down.
  const lock = JSON.parse(readFileSync(url('../package-lock.json'), 'utf8')) as PackageLock;
  const entries = Object.entries(lock.packages);

  it('is lockfileVersion 3 (the format every other assertion here assumes)', () => {
    expect(lock.lockfileVersion).toBe(3);
  });

  it('scanned more than a handful of packages — the scan must actually be scanning', () => {
    expect(entries.length).toBeGreaterThan(100);
  });

  it('resolves every peer edge to a version that satisfies its range', () => {
    // An unresolved peer is legal (optional peers are routinely absent, and a
    // consumer may supply its own). A peer that resolves to a version outside
    // the declared range is not — it means a nested copy that used to satisfy
    // it went missing and the edge silently fell through to a hoisted one.
    const violations: string[] = [];
    for (const [name, pkg] of entries) {
      for (const [depName, range] of Object.entries(pkg.peerDependencies ?? {})) {
        // "*" and "" accept anything; skip rather than pay the semver call.
        if (range === '*' || range === '') continue;
        const resolved = resolveFrom(name, depName, lock.packages);
        if (resolved?.version === undefined) continue;
        if (!semver.satisfies(resolved.version, range, { includePrerelease: true, loose: true })) {
          violations.push(
            `${name || '(root)'} peer ${depName}@"${range}" -> got ${resolved.version}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('records an entry for every dependency edge, including other platforms', () => {
    // peerDependencies are excluded here — absence is legal for those, and the
    // assertion above covers the case that actually matters. dependencies and
    // optionalDependencies must resolve: npm ci errors if the entry is absent.
    const unresolved: string[] = [];
    for (const [name, pkg] of entries) {
      const edges = { ...pkg.dependencies, ...pkg.optionalDependencies };
      for (const depName of Object.keys(edges)) {
        if (resolveFrom(name, depName, lock.packages) === null) {
          unresolved.push(`${name || '(root)'} -> ${depName}`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('marks every platform-restricted package optional', () => {
    // A package declaring os/cpu but NOT optional is a hard install
    // requirement on every platform, including ones it cannot run on.
    // The root package ("") legitimately has no os/cpu restriction.
    const wronglyRequired = entries
      .filter(([name]) => name !== '')
      .filter(([, pkg]) => (pkg.os !== undefined || pkg.cpu !== undefined) && pkg.optional !== true)
      .map(([name]) => name);
    expect(wronglyRequired).toEqual([]);
  });
});
