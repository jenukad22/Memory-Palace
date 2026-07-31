import { describe, expect, it } from 'vitest';
import { linePath, makeChartScale } from './chartGeometry';

describe('makeChartScale', () => {
  it('maps domain edges to the padded pixel edges', () => {
    const scale = makeChartScale({
      width: 100,
      height: 50,
      paddingX: 0,
      paddingY: 0,
      xDomain: [0, 10],
      yDomain: [0, 100],
    });
    expect(scale.x(0)).toBe(0);
    expect(scale.x(10)).toBe(100);
    expect(scale.x(5)).toBe(50);
    // y is inverted: max data value maps to pixel 0 (top), min maps to height (bottom).
    expect(scale.y(100)).toBe(0);
    expect(scale.y(0)).toBe(50);
  });

  it('respects padding', () => {
    const scale = makeChartScale({
      width: 100,
      height: 100,
      paddingX: 10,
      paddingY: 10,
      xDomain: [0, 1],
      yDomain: [0, 1],
    });
    expect(scale.x(0)).toBe(10);
    expect(scale.x(1)).toBe(90);
    expect(scale.y(1)).toBe(10);
    expect(scale.y(0)).toBe(90);
  });

  it('centers a degenerate x domain instead of dividing by zero', () => {
    const scale = makeChartScale({
      width: 100,
      height: 100,
      paddingX: 0,
      paddingY: 0,
      xDomain: [5, 5],
      yDomain: [0, 1],
    });
    expect(scale.x(5)).toBe(50);
    expect(Number.isFinite(scale.x(5))).toBe(true);
  });

  it('centers a degenerate y domain instead of dividing by zero', () => {
    const scale = makeChartScale({
      width: 100,
      height: 100,
      paddingX: 0,
      paddingY: 0,
      xDomain: [0, 1],
      yDomain: [1200, 1200],
    });
    expect(scale.y(1200)).toBe(50);
    expect(Number.isFinite(scale.y(1200))).toBe(true);
  });
});

describe('linePath', () => {
  it('returns an empty string for no points', () => {
    expect(linePath([])).toBe('');
  });

  it('renders a single point as a lone move-to', () => {
    expect(linePath([{ x: 1, y: 2 }])).toBe('M 1 2');
  });

  it('renders multiple points as a move-to followed by line-tos', () => {
    expect(
      linePath([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 4 },
      ]),
    ).toBe('M 0 0 L 1 1 L 2 4');
  });
});
