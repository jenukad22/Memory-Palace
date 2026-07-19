import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Copy-honesty enforcement (SPEC.md sec 0, CLAUDE.md). Results are
 * task-specific only: no screen or route may frame anything as a measure of
 * intellect, name an age for the mind, imply a health reading, or attach a
 * condition label to the user. Prose rules stop holding once screens multiply
 * — this makes banned framing a build failure, like tokens.test.ts does for
 * contrast. Scans code files in /src/assessment and /app (not .md docs, which
 * SPEC.md sec 0 explicitly permits to carry orientation terminology).
 */

const HERE = fileURLToPath(new URL('.', import.meta.url)); // .../src/assessment/
const ROOT = join(HERE, '..', '..');
const SCAN_DIRS = [
  { name: 'src/assessment', dir: HERE },
  { name: 'app', dir: join(ROOT, 'app') },
];

const BANNED: { label: string; re: RegExp }[] = [
  { label: 'intellect-quotient framing', re: /\biq\b/i },
  { label: 'intellect framing', re: /intellig/i },
  { label: 'age-of-the-mind framing', re: /\b(?:brain|cognitive|memory|mental)[\s-]+age\b/i },
  { label: 'health-reading framing', re: /diagnos/i },
  { label: 'imagery-condition label', re: /aphantas/i },
  { label: 'health-context framing', re: /\bclinical/i },
  { label: 'beyond-the-task ability framing', re: /general[\s-]+abilit/i },
  { label: 'beyond-the-task improvement claim', re: /\bsmarter\b/i },
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function scannable(file: string): boolean {
  if (!/\.tsx?$/.test(file)) return false;
  if (/\.test\.tsx?$/.test(file)) return false; // tests may spell the patterns
  return true;
}

describe('copy honesty (task-specific reporting only)', () => {
  it('no banned framing in /src/assessment or /app code', () => {
    const violations: string[] = [];
    let scanned = 0;
    for (const { name, dir } of SCAN_DIRS) {
      for (const file of walk(dir)) {
        if (!scannable(file)) continue;
        scanned += 1;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          for (const { label, re } of BANNED) {
            if (re.test(line)) {
              violations.push(`${name}/${relative(dir, file)}:${i + 1} — ${label}`);
            }
          }
        });
      }
    }
    expect(scanned).toBeGreaterThan(10); // the scan must actually be scanning
    expect(violations).toEqual([]);
  });
});
