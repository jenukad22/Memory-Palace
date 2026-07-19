import { describe, expect, it } from 'vitest';
import { color, motion, radius, space, typeScale } from './tokens';

/** WCAG relative luminance from a #RRGGBB hex. */
function luminance(hex: string): number {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) throw new Error(`not a 6-digit hex color: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('token contrast floors (DESIGN.md sec 1.1)', () => {
  it('textPrimary >= 7:1 on bg0 and surface1', () => {
    expect(contrast(color.textPrimary, color.bg0)).toBeGreaterThanOrEqual(7);
    expect(contrast(color.textPrimary, color.surface1)).toBeGreaterThanOrEqual(7);
  });

  it('textSecondary >= 4.5:1 on bg0 and surface1', () => {
    expect(contrast(color.textSecondary, color.bg0)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.textSecondary, color.surface1)).toBeGreaterThanOrEqual(4.5);
  });

  it('ink >= 4.5:1 on accent', () => {
    expect(contrast(color.ink, color.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('scale invariants (DESIGN.md sec 1.2-1.3)', () => {
  it('spacing is the 4-pt scale, strictly ascending', () => {
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
  });

  it('radii and motion match the spec', () => {
    expect(radius).toEqual({ sm: 6, md: 10, lg: 16, full: 999 });
    expect(motion).toEqual({ tapFlashMs: 150, advanceMs: 250 });
  });

  it('every type variant has a line-height at or above its font size', () => {
    for (const t of Object.values(typeScale)) {
      expect(t.lineHeight).toBeGreaterThanOrEqual(t.fontSize);
    }
  });
});
