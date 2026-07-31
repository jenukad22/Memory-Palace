import { describe, expect, it } from 'vitest';
import { CORSI_BLOCK_SIZE, CORSI_BLOCKS, CORSI_MAX_SIDE, corsiBoardSide } from './corsiLayout';

describe('CORSI_BLOCKS geometry', () => {
  it('has exactly 9 distinct blocks', () => {
    expect(CORSI_BLOCKS).toHaveLength(9);
    const keys = new Set(CORSI_BLOCKS.map((b) => `${b.x},${b.y}`));
    expect(keys.size).toBe(9);
  });

  it('every block (with its 18% footprint) fits fully inside the unit square', () => {
    // This is the layout-bounds guard: if a coordinate drifts so a block would
    // extend past the board edge, it could render clipped/unreachable. Assert
    // each block's full extent stays within [0, 1] on both axes.
    for (const [i, b] of CORSI_BLOCKS.entries()) {
      expect(b.x, `block ${i + 1} x lower bound`).toBeGreaterThanOrEqual(0);
      expect(b.y, `block ${i + 1} y lower bound`).toBeGreaterThanOrEqual(0);
      expect(b.x + CORSI_BLOCK_SIZE, `block ${i + 1} right edge`).toBeLessThanOrEqual(1);
      expect(b.y + CORSI_BLOCK_SIZE, `block ${i + 1} bottom edge`).toBeLessThanOrEqual(1);
    }
  });
});

describe('corsiBoardSide', () => {
  it('fills a square viewport up to the max cap', () => {
    expect(corsiBoardSide(300, 300)).toBe(300);
    expect(corsiBoardSide(1200, 1200)).toBe(CORSI_MAX_SIDE);
  });

  it('takes the smaller of width and height so the board never overflows either axis', () => {
    // Wide-but-short desktop: height is the limiting dimension (below the cap).
    expect(corsiBoardSide(1440, 380)).toBe(380);
    // Narrow-but-tall phone: width is the limiting dimension.
    expect(corsiBoardSide(320, 900)).toBe(320);
  });

  it('respects a custom max cap', () => {
    expect(corsiBoardSide(1000, 1000, 250)).toBe(250);
  });

  it('returns 0 for an unmeasured or degenerate box', () => {
    expect(corsiBoardSide(0, 0)).toBe(0);
    expect(corsiBoardSide(-10, 500)).toBe(0);
    expect(corsiBoardSide(Number.NaN, 500)).toBe(0);
  });

  it('never exceeds the smallest bound (property check over sample boxes)', () => {
    const samples: [number, number][] = [
      [320, 480],
      [768, 1024],
      [1440, 900],
      [390, 844],
      [600, 300],
    ];
    for (const [w, h] of samples) {
      const side = corsiBoardSide(w, h);
      expect(side).toBeLessThanOrEqual(w);
      expect(side).toBeLessThanOrEqual(h);
      expect(side).toBeLessThanOrEqual(CORSI_MAX_SIDE);
    }
  });
});
