import { describe, expect, it } from 'vitest';
import { encodingCopy } from './copy';

describe('encodingCopy (VVIQ-routed encoding instructions)', () => {
  it('gives distinct, non-empty copy per strategy', () => {
    const visual = encodingCopy('visual');
    const nonVisual = encodingCopy('non-visual');
    for (const c of [visual, nonVisual]) {
      expect(c.placePrompt.length).toBeGreaterThan(0);
      expect(c.paoScenePrompt.length).toBeGreaterThan(0);
    }
    expect(visual.placePrompt).not.toBe(nonVisual.placePrompt);
    expect(visual.paoScenePrompt).not.toBe(nonVisual.paoScenePrompt);
  });

  it('never asks the non-visual path to see or picture', () => {
    const nonVisual = encodingCopy('non-visual');
    const text = `${nonVisual.placePrompt} ${nonVisual.paoScenePrompt}`.toLowerCase();
    for (const word of ['see ', 'picture', 'visualiz', 'imagine', 'vivid']) {
      expect(text).not.toContain(word);
    }
  });

  it('uses imagery language on the visual path', () => {
    const visual = encodingCopy('visual');
    const text = `${visual.placePrompt} ${visual.paoScenePrompt}`.toLowerCase();
    expect(text).toMatch(/see|picture|vivid|scene/);
  });
});
