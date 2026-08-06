import { describe, expect, it } from 'vitest';
import {
  humanizeRouteName,
  stackScreenOptions,
  stackScreenOptionsWithTitles,
} from './navigationTheme';
import { color, typeScale } from './tokens';

describe('stackScreenOptions (DESIGN.md sec 1.1)', () => {
  it('paints the header and the transition ground in the app ground colour', () => {
    // The bug this replaces: an unstyled navigator renders a white header
    // above a #0B0E14 screen.
    expect(stackScreenOptions.headerStyle.backgroundColor).toBe(color.bg0);
    expect(stackScreenOptions.contentStyle.backgroundColor).toBe(color.bg0);
  });

  it('tints the back arrow with the accent and the title with textPrimary', () => {
    expect(stackScreenOptions.headerTintColor).toBe(color.accent);
    expect(stackScreenOptions.headerTitleStyle.color).toBe(color.textPrimary);
  });

  it('sets the title from the type scale, not a literal size', () => {
    expect(stackScreenOptions.headerTitleStyle.fontSize).toBe(typeScale.heading.fontSize);
    expect(stackScreenOptions.headerTitleStyle.fontWeight).toBe(typeScale.heading.fontWeight);
  });

  it('has no shadow or elevation (DESIGN.md prohibition 1)', () => {
    expect(stackScreenOptions.headerShadowVisible).toBe(false);
  });

  it('uses only token values — no colour literals leak into the chrome', () => {
    const tokenValues = new Set<unknown>(Object.values(color));
    const colors = [
      stackScreenOptions.headerStyle.backgroundColor,
      stackScreenOptions.contentStyle.backgroundColor,
      stackScreenOptions.headerTintColor,
      stackScreenOptions.headerTitleStyle.color,
    ];
    for (const value of colors) {
      expect(tokenValues.has(value), `${String(value)} is not a token`).toBe(true);
    }
  });
});

describe('humanizeRouteName', () => {
  it('never returns a filename as a title — the reported bug', () => {
    // "index" in the header is what the device test saw.
    expect(humanizeRouteName('index')).toBe('Home');
    expect(humanizeRouteName('memory/index')).toBe('Memory');
    expect(humanizeRouteName('modules/attention/index')).toBe('Attention');
  });

  it('turns a kebab-case filename into a sentence', () => {
    expect(humanizeRouteName('memory/palace-builder')).toBe('Palace builder');
    expect(humanizeRouteName('reasoning/base-rate')).toBe('Base rate');
    expect(humanizeRouteName('pao_drill')).toBe('Pao drill');
  });

  it('strips dynamic-segment brackets', () => {
    expect(humanizeRouteName('[module]')).toBe('Module');
    expect(humanizeRouteName('modules/[...rest]')).toBe('Rest');
  });

  it('survives degenerate names instead of rendering an empty header', () => {
    expect(humanizeRouteName('')).toBe('Home');
    expect(humanizeRouteName('/')).toBe('Home');
    expect(humanizeRouteName('index/index')).toBe('Home');
  });
});

describe('stackScreenOptionsWithTitles', () => {
  const options = stackScreenOptionsWithTitles({ index: 'Training', 'attention/pvt': 'PVT-B' });

  it('applies the mapped title and keeps the tokenized defaults', () => {
    const opts = options({ route: { name: 'attention/pvt' } });
    expect(opts.title).toBe('PVT-B');
    expect(opts.headerStyle.backgroundColor).toBe(color.bg0);
    expect(opts.headerTintColor).toBe(color.accent);
  });

  it('falls back to a humanized title for a route nobody listed', () => {
    // A new route file must not be able to ship a filename header.
    expect(options({ route: { name: 'memory/palace-builder' } }).title).toBe('Palace builder');
    expect(options({ route: { name: 'reasoning/index' } }).title).toBe('Reasoning');
  });
});
