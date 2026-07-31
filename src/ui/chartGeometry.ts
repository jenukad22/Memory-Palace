/**
 * Pure chart scale/path math for LineChart — framework-free so it's
 * unit-testable without rendering, same extraction pattern as corsiLayout.ts.
 */

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartScale {
  x(value: number): number;
  y(value: number): number;
}

export interface ChartLayout {
  width: number;
  height: number;
  paddingX?: number;
  paddingY?: number;
  xDomain: [number, number];
  yDomain: [number, number];
}

const DEFAULT_PADDING_X = 4;
const DEFAULT_PADDING_Y = 8;

/**
 * Maps a data-space point to pixel space inside `width`x`height`, inset by
 * padding. A degenerate domain (min === max, e.g. a single data point) centers
 * that value in the plot area instead of dividing by zero.
 */
export function makeChartScale(layout: ChartLayout): ChartScale {
  const paddingX = layout.paddingX ?? DEFAULT_PADDING_X;
  const paddingY = layout.paddingY ?? DEFAULT_PADDING_Y;
  const [xMin, xMax] = layout.xDomain;
  const [yMin, yMax] = layout.yDomain;
  const plotWidth = Math.max(0, layout.width - paddingX * 2);
  const plotHeight = Math.max(0, layout.height - paddingY * 2);
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;

  return {
    x(value: number): number {
      if (xSpan === 0) return paddingX + plotWidth / 2;
      return paddingX + ((value - xMin) / xSpan) * plotWidth;
    },
    // Pixel y grows downward; data y grows upward, so this is inverted.
    y(value: number): number {
      if (ySpan === 0) return paddingY + plotHeight / 2;
      return paddingY + (1 - (value - yMin) / ySpan) * plotHeight;
    },
  };
}

/** SVG path `d` for a polyline through `points`, already in pixel space. */
export function linePath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first!.x} ${first!.y}` + rest.map((p) => ` L ${p.x} ${p.y}`).join('');
}
