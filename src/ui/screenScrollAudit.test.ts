import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A guard for a bug class that only shows up on a phone: a screen whose content
 * is taller than the viewport with no way to scroll to the rest of it. On the
 * first Android device test the modules hub's Reasoning button was below the
 * fold and simply unreachable; every web test passed, because a desktop window
 * is taller than anything we render.
 *
 * We cannot measure content height in CI — that needs a real renderer with a
 * real viewport, which would mean new devDependencies (see the note at the
 * bottom of this file). What we *can* pin is the structural invariant the fix
 * rests on: ScreenShell scrolls by default, so the only way back into the bug
 * is a screen opting out. This test makes every opt-out a deliberate,
 * reviewed, written-down decision instead of a silent default, and stops a
 * page-level ScrollView from being hand-rolled around the shell again.
 *
 * It is a source scan, not a render: cheap, dependency-free, and it fails on
 * the change that would reintroduce the bug rather than on the bug's symptom.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Screens whose body is deliberately not a scroll container, and why. A screen
 * belongs here only if its surface measures itself against the box it is
 * given — a scroll container hands children unbounded height, so such a
 * surface would size itself off the viewport and overflow it.
 */
const FIXED_SURFACE_SCREENS: Readonly<Record<string, string>> = {
  'src/assessment/corsi/CorsiScreen.tsx':
    'The Corsi board sizes itself to the leftover box (corsiLayout.ts); unbounded height puts the lower blocks off-screen, which would corrupt the recorded span.',
  'src/assessment/freerecall/FreeRecallScreen.tsx':
    'The entered-words list is its own scroll region between a pinned input and a pinned Finish button.',
  'src/modules/attention/CptScreen.tsx':
    'The running phase is a flex:1 response pad; a tap anywhere in it is a trial response.',
  'src/modules/attention/PvtScreen.tsx':
    'The running phase is a flex:1 response pad; reaction time is measured from a tap in it.',
  'src/modules/attention/FlickerScreen.tsx':
    'The flicker board sizes itself to the leftover box (boardLayout.ts) and its cells must stay above the minimum tap target.',
};

/** ScreenShell owns the one legitimate page-level ScrollView. */
const THE_SHELL = 'src/ui/ScreenShell.tsx';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

interface ScreenFile {
  path: string;
  source: string;
  rendersShell: boolean;
  optsOutOfScroll: boolean;
  rendersOwnScrollView: boolean;
}

const files: ScreenFile[] = ['app', 'src'].flatMap((top) =>
  walk(join(ROOT, top)).map((full) => {
    const source = readFileSync(full, 'utf8');
    return {
      path: relative(ROOT, full).split(sep).join('/'),
      source,
      rendersShell: source.includes('<ScreenShell'),
      optsOutOfScroll: /\bscroll=\{/.test(source),
      rendersOwnScrollView: source.includes('<ScrollView'),
    };
  }),
);

const shellScreens = files.filter((f) => f.rendersShell);

describe('every screen can reach its own content', () => {
  it('finds the screens to audit at all', () => {
    // Without this the whole suite passes vacuously if the globs ever go stale.
    expect(shellScreens.length).toBeGreaterThan(20);
  });

  it('only opts out of scrolling where a registered reason says why', () => {
    const unregistered = shellScreens
      .filter((f) => f.optsOutOfScroll && !(f.path in FIXED_SURFACE_SCREENS))
      .map((f) => f.path);
    expect(
      unregistered,
      'These screens pass `scroll` to ScreenShell without a registered reason. ' +
        'A screen that does not scroll has unreachable controls the moment its content ' +
        'outgrows a phone viewport. If the surface really must be fixed, add it to ' +
        'FIXED_SURFACE_SCREENS with the reason.',
    ).toEqual([]);
  });

  it('keeps every registered reason attached to a screen that still opts out', () => {
    // A stale entry is worse than none: it grants a future screen a silent pass.
    for (const [path, reason] of Object.entries(FIXED_SURFACE_SCREENS)) {
      const file = files.find((f) => f.path === path);
      expect(file, `${path} is registered as a fixed surface but no longer exists`).toBeDefined();
      expect(file!.rendersShell, `${path} no longer renders a ScreenShell`).toBe(true);
      expect(
        file!.optsOutOfScroll,
        `${path} now scrolls — drop it from FIXED_SURFACE_SCREENS`,
      ).toBe(true);
      expect(reason.length, `${path} needs a real reason, not a placeholder`).toBeGreaterThan(30);
    }
  });

  it('leaves the page-level scroll container to ScreenShell', () => {
    // Hand-rolling a ScrollView inside the shell is how the padding and the
    // safe-area insets get bypassed, and nesting two of them breaks the inner
    // one's scrolling on Android. A nested scroll region is only legitimate on
    // a screen that has already turned the shell's own scrolling off.
    const handRolled = files
      .filter(
        (f) => f.rendersOwnScrollView && f.path !== THE_SHELL && !(f.path in FIXED_SURFACE_SCREENS),
      )
      .map((f) => f.path);
    expect(
      handRolled,
      'These files render their own ScrollView. ScreenShell already scrolls its body — ' +
        'remove the inner one, or register the screen in FIXED_SURFACE_SCREENS if it ' +
        'genuinely needs a bounded scroll region of its own.',
    ).toEqual([]);
  });
});

/**
 * What this does *not* catch, stated plainly so nobody reads a green suite as
 * more than it is:
 *
 *  - A registered fixed-surface screen whose content genuinely outgrows the
 *    viewport. Those five are fixed because their surface is measured, and the
 *    measuring functions have their own bounds tests (corsiLayout.test.ts,
 *    boardLayout.test.ts) — that is the coverage for them.
 *  - Overflow *within* a scrolling screen's non-scrolling child.
 *
 * Catching real overflow would mean rendering each screen at phone viewport
 * sizes and comparing content height against the viewport — react-test-renderer
 * or @testing-library/react-native plus a jsdom/RN preset. That is three new
 * devDependencies and a lockfile regeneration, which this repo cannot do safely
 * on Windows (npm 11 drops optional-peer subtrees and breaks the EAS install);
 * see the CI lockfile guard. Not worth it for a bug whose entry point is a
 * single, now-guarded prop.
 */
