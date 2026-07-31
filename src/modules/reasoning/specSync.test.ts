import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BASE_RATE_ITEMS_PER_RUN,
  BASE_RATE_POPULATION,
  CALIBRATION_ITEMS_PER_RUN,
  CONFIDENCE_LEVELS,
  DISCONFIRMATION_PROMPTS_PER_RUN,
  HYPOTHESES_PROMPTS_PER_RUN,
  MAX_HYPOTHESES_PER_PROMPT,
} from '@/engine';

/**
 * Doc-code drift guard, the same discipline as
 * `modules/attention/specSync.test.ts`: the reasoning paradigm numbers exist
 * twice — once as constants in `engine/reasoning/*.ts`, once as recorded
 * decisions in `assessment/SPEC.md` §9/§12 and this module's own SPEC.md —
 * and a reader has no way to tell which one is stale. Every expectation below
 * is *derived from the constant*, so changing a constant without updating the
 * docs fails here, naming the value it expected to find.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url)); // .../src/modules/reasoning/
const ROOT = join(HERE, '..', '..', '..');

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** The text of one `## n. Title` (or `### n.n Title`) section of a markdown doc. */
function section(markdown: string, heading: RegExp, subheading = false): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => heading.test(line));
  expect(start, `section ${heading} not found`).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const boundary = subheading ? /^###? / : /^## /;
  const end = rest.findIndex((line) => boundary.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

describe('assessment/SPEC.md §9 records reasoning as built, with the actual numbers', () => {
  const reasoningSection = section(read('src/assessment/SPEC.md'), /^## 9\. Reasoning/);

  it('records the base-rate run size and population', () => {
    expect(reasoningSection).toContain(`${BASE_RATE_ITEMS_PER_RUN} items/run`);
    expect(reasoningSection).toContain(`population ${BASE_RATE_POPULATION}`);
  });

  it('records the hypotheses run size and per-prompt cap', () => {
    expect(reasoningSection).toContain(`${HYPOTHESES_PROMPTS_PER_RUN} prompts/run`);
    expect(reasoningSection).toContain(`cap ${MAX_HYPOTHESES_PER_PROMPT} entries/prompt`);
  });

  it('records the disconfirmation run size', () => {
    expect(reasoningSection).toContain(`${DISCONFIRMATION_PROMPTS_PER_RUN} claims/run`);
  });

  it('records the calibration run size and confidence scale', () => {
    expect(reasoningSection).toContain(`${CALIBRATION_ITEMS_PER_RUN} questions/run`);
    expect(reasoningSection).toContain(CONFIDENCE_LEVELS.join('/'));
  });

  it('states plainly that the originally recorded matrix-reasoning instrument was not built', () => {
    expect(reasoningSection).toMatch(/not built/i);
    expect(reasoningSection).toMatch(/matrix reasoning/i);
  });

  it('no longer carries the deferred-status marker', () => {
    expect(reasoningSection).not.toMatch(/\*\*DEFERRED/);
  });
});

describe('assessment/SPEC.md §12 carries the reasoning binding numbers', () => {
  const summary = section(read('src/assessment/SPEC.md'), /^## 12\./);

  it('records all four tasks’ run sizes', () => {
    expect(summary).toContain(`${BASE_RATE_ITEMS_PER_RUN} items/run`);
    expect(summary).toContain(`${HYPOTHESES_PROMPTS_PER_RUN} prompts/run`);
    expect(summary).toContain(`${DISCONFIRMATION_PROMPTS_PER_RUN} claims/run`);
    expect(summary).toContain(`${CALIBRATION_ITEMS_PER_RUN} questions/run`);
  });

  it('records the confidence scale', () => {
    expect(summary).toContain(CONFIDENCE_LEVELS.join('/'));
  });
});

describe('modules/reasoning/SPEC.md matches the constants it documents', () => {
  const spec = read('src/modules/reasoning/SPEC.md');

  it('records the base-rate run composition', () => {
    const s = section(spec, /^### 4\.1 Base-rate items/, true);
    expect(s).toContain(`BASE_RATE_ITEMS_PER_RUN = ${BASE_RATE_ITEMS_PER_RUN}`);
  });

  it('records the hypotheses cap and run size', () => {
    const s = section(spec, /^### 4\.2 Hypothesis fluency/, true);
    expect(s).toContain(`MAX_HYPOTHESES_PER_PROMPT = ${MAX_HYPOTHESES_PER_PROMPT}`);
    expect(s).toContain(`HYPOTHESES_PROMPTS_PER_RUN = ${HYPOTHESES_PROMPTS_PER_RUN}`);
  });

  it('records the disconfirmation run size', () => {
    const s = section(spec, /^### 4\.3 Disconfirmation self-rating/, true);
    expect(s).toContain(`DISCONFIRMATION_PROMPTS_PER_RUN = ${DISCONFIRMATION_PROMPTS_PER_RUN}`);
  });

  it('records the calibration confidence scale and run size', () => {
    const s = section(spec, /^### 4\.4 Calibration/, true);
    expect(s).toContain(`[${CONFIDENCE_LEVELS.join(', ')}]`);
    expect(s).toContain(`CALIBRATION_ITEMS_PER_RUN = ${CALIBRATION_ITEMS_PER_RUN}`);
  });
});
