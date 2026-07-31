import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CPT_BLANK_MS,
  CPT_DISTRACTOR_RATE,
  CPT_STIMULUS_MS,
  CPT_TRIALS,
  FLICKER_BLANK_MS,
  FLICKER_SCENE_MS,
  FLICKER_TIMEOUT_MS,
  FLICKER_TRIALS,
  PVTB_DURATION_MS,
  PVTB_FALSE_START_MS,
  PVTB_ISI_MAX_MS,
  PVTB_ISI_MIN_MS,
  PVTB_LAPSE_MS,
  PVTB_MAX_STIMULUS_MS,
} from '@/engine';

/**
 * Doc-code drift guard. The paradigm numbers exist twice — once as constants in
 * engine/attention/timing.ts, once as recorded decisions in the two SPEC files —
 * and a reader has no way to tell which one is stale. This makes a divergence a
 * build failure, the same way migrations-consistency.test.ts does for the
 * migration journal and tokens.test.ts does for contrast.
 *
 * Every expectation below is *derived from the constant*, so changing a constant
 * without updating the docs fails here, naming the value it expected to find.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url)); // .../src/modules/attention/
const ROOT = join(HERE, '..', '..', '..');

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** The text of one `## n. Title` section of a markdown doc. */
function section(markdown: string, heading: RegExp): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => heading.test(line));
  expect(start, `section ${heading} not found`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

describe('assessment/SPEC.md §7 records the PVT-B as implemented', () => {
  const pvtSection = section(read('src/assessment/SPEC.md'), /^## 7\. PVT/);

  it('records the run duration', () => {
    expect(pvtSection).toContain(`${PVTB_DURATION_MS / 60_000} min`);
  });

  it('records the corrected 1-4 s interval, not the 10-minute PVT interval', () => {
    expect(pvtSection).toContain(`${PVTB_ISI_MIN_MS / 1000}–${PVTB_ISI_MAX_MS / 1000} s`);
  });

  it('records the stimulus timeout', () => {
    expect(pvtSection).toContain(`${PVTB_MAX_STIMULUS_MS / 1000} s`);
  });

  it('records the 355 ms lapse threshold', () => {
    expect(pvtSection).toContain(`${PVTB_LAPSE_MS} ms`);
  });

  it('records the false-start floor', () => {
    expect(pvtSection).toContain(`${PVTB_FALSE_START_MS} ms`);
  });

  it('still explains why the interval changed, so the correction is not lost', () => {
    expect(pvtSection).toMatch(/2–10 s/); // the superseded value, named as superseded
    expect(pvtSection).toMatch(/10-minute/);
  });

  it('no longer carries the deferred-status markers', () => {
    // The word "deferred" still appears, naming the superseded 2-10 s value —
    // that is the record of the correction. What must be gone are the status
    // markers that said the instrument itself was unbuilt.
    expect(pvtSection).not.toMatch(/design only/i);
    expect(pvtSection).not.toMatch(/not built/i);
    expect(pvtSection).not.toMatch(/\*\*DEFERRED/);
  });
});

describe('assessment/SPEC.md §12 carries the attention binding numbers', () => {
  const summary = section(read('src/assessment/SPEC.md'), /^## 12\./);

  it('records the PVT-B numbers that §12 predated', () => {
    expect(summary).toContain(`${PVTB_DURATION_MS / 60_000} min`);
    expect(summary).toContain(`${PVTB_ISI_MIN_MS / 1000}–${PVTB_ISI_MAX_MS / 1000} s`);
    expect(summary).toContain(`${PVTB_LAPSE_MS} ms`);
    expect(summary).toContain(`${PVTB_FALSE_START_MS} ms`);
  });

  it('records the CPT numbers', () => {
    expect(summary).toContain(`${CPT_TRIALS} trials`);
    expect(summary).toContain(`${CPT_STIMULUS_MS} ms`);
    expect(summary).toContain(`${CPT_BLANK_MS} ms`);
    expect(summary).toContain(`${CPT_DISTRACTOR_RATE * 100} %`);
  });

  it('records the flicker numbers', () => {
    expect(summary).toContain(`${FLICKER_SCENE_MS}/${FLICKER_BLANK_MS} ms`);
    expect(summary).toContain(`${FLICKER_TIMEOUT_MS / 1000} s`);
    expect(summary).toContain(`${FLICKER_TRIALS} trials`);
  });
});

describe('modules/attention/SPEC.md matches the constants it documents', () => {
  const spec = read('src/modules/attention/SPEC.md');

  it('records the PVT-B trial classification thresholds', () => {
    const pvt = section(spec, /^### 4\.1 PVT-B/);
    expect(pvt).toContain(`[${PVTB_ISI_MIN_MS}, ${PVTB_ISI_MAX_MS}] ms`);
    expect(pvt).toContain(`${PVTB_MAX_STIMULUS_MS} ms`);
    expect(pvt).toContain(`${PVTB_LAPSE_MS} ms`);
    expect(pvt).toContain(`${PVTB_FALSE_START_MS} ms`);
  });

  it('records the CPT trial structure', () => {
    const cpt = section(spec, /^### 4\.2 CPT/);
    expect(cpt).toContain(`${CPT_TRIALS} trials`);
    expect(cpt).toContain(`${CPT_STIMULUS_MS} ms stimulus`);
    expect(cpt).toContain(`${CPT_BLANK_MS} ms blank`);
    expect(cpt).toContain(`${CPT_STIMULUS_MS + CPT_BLANK_MS} ms response window`);
    expect(cpt).toContain(`${CPT_DISTRACTOR_RATE * 100} % of trials`);
  });

  it('records the flicker alternation and timeout', () => {
    const flicker = section(spec, /^### 4\.3 Flicker/);
    expect(flicker).toContain(`(${FLICKER_SCENE_MS} ms)`);
    expect(flicker).toContain(`(${FLICKER_BLANK_MS} ms)`);
    expect(flicker).toContain(`${(FLICKER_SCENE_MS + FLICKER_BLANK_MS) * 2} ms`);
    expect(flicker).toContain(`${FLICKER_TIMEOUT_MS / 1000} s`);
    expect(flicker).toContain(`${FLICKER_TRIALS} trials`);
  });
});
