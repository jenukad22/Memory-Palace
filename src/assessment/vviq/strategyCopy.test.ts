import { describe, expect, it } from 'vitest';
import { STRATEGY_FIT_LINE, strategyCopy } from './strategyCopy';

describe('strategyCopy (SPEC.md sec 8)', () => {
  it('the two strategies produce different instructional copy', () => {
    const visual = strategyCopy('visual');
    const nonVisual = strategyCopy('non-visual');
    expect(visual.heading).not.toBe(nonVisual.heading);
    expect(visual.body).not.toBe(nonVisual.body);
    expect(visual.body.length).toBeGreaterThan(0);
    expect(nonVisual.body.length).toBeGreaterThan(0);
  });

  it('the non-visual path keeps the same cards and schedule (only encoding changes)', () => {
    expect(strategyCopy('non-visual').body).toContain('Same cards, same schedule');
  });

  it('frames the choice as fit, not deficit', () => {
    expect(STRATEGY_FIT_LINE).toBe('We use the strategy that fits how you think.');
    // No copy labels the user or names a condition — enforced repo-wide by
    // copy-honesty.test.ts; here we pin the fit framing itself.
    for (const s of ['visual', 'non-visual'] as const) {
      const c = strategyCopy(s);
      expect(`${c.heading} ${c.body}`).not.toMatch(/deficit|disorder|condition|unable|cannot/i);
    }
  });
});
