import { describe, expect, it } from 'vitest';
import { BASE_RATE_SCENARIO_KEYS, generateBaseRateItem, makeRng } from '@/engine';
import { renderBaseRateItem } from './baseRateCopy';

describe('renderBaseRateItem', () => {
  it('renders non-empty prompt text for every scenario in both formats', () => {
    for (const scenarioKey of BASE_RATE_SCENARIO_KEYS) {
      for (const format of ['probability', 'frequency'] as const) {
        const item = generateBaseRateItem(makeRng(1), { scenarioKey, format });
        const rendered = renderBaseRateItem(item);
        expect(rendered.promptText.length).toBeGreaterThan(20);
        expect(rendered.promptText).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('probability format asks for a 0-100 percentage', () => {
    const item = generateBaseRateItem(makeRng(3), {
      scenarioKey: 'medicalTest',
      format: 'probability',
    });
    const rendered = renderBaseRateItem(item);
    expect(rendered.answerMax).toBe(100);
    expect(rendered.answerLabel).toMatch(/0–100/);
    expect(rendered.promptText).toContain(`${item.prevalencePct}%`);
    expect(rendered.promptText).toContain(`${item.sensitivityPct}%`);
    expect(rendered.promptText).toContain(`${item.falsePositiveRatePct}%`);
  });

  it('frequency format asks for a count up to totalPositives', () => {
    const item = generateBaseRateItem(makeRng(3), {
      scenarioKey: 'medicalTest',
      format: 'frequency',
    });
    const rendered = renderBaseRateItem(item);
    expect(rendered.answerMax).toBe(item.totalPositives);
    expect(rendered.answerLabel).toContain(`${item.totalPositives}`);
    expect(rendered.promptText).toContain(`${item.n}`);
    expect(rendered.promptText).toContain(`${item.conditionCount}`);
    expect(rendered.promptText).toContain(`${item.truePositives}`);
    expect(rendered.promptText).toContain(`${item.totalPositives}`);
  });

  it('the weather-alert scenario keeps condition and flag in the correct causal order', () => {
    // The one scenario where "condition" (an event) and "flag" (an alert) are
    // temporally inverted relative to the other five — worth pinning down.
    const item = generateBaseRateItem(makeRng(2), {
      scenarioKey: 'weatherAlert',
      format: 'probability',
    });
    const rendered = renderBaseRateItem(item);
    expect(rendered.promptText).toContain('have an actual severe-weather event');
    expect(rendered.promptText).toContain('trigger a severe-weather alert');
  });
});
