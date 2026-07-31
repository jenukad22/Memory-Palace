import { describe, expect, it } from 'vitest';
import { FLICKER_COLS, FLICKER_ROWS } from '@/engine';
import { hit, space } from '@/ui/tokens';
import { FLICKER_MAX_BOARD_SIDE, flickerCellSide, isBelowMinTapTarget } from './boardLayout';

const cell = (w: number, h: number) => flickerCellSide(w, h, FLICKER_COLS, FLICKER_ROWS);

/**
 * Viewports the board has to survive. Widths are the *content* width — the
 * screen width minus ScreenShell's horizontal padding on both sides.
 */
const content = (screenWidth: number) => screenWidth - space.sp4 * 2;
/** Rough height left for the board after the caption row and the give-up button. */
const boardHeight = (screenHeight: number) => screenHeight - 220;

describe('flickerCellSide', () => {
  it('returns 0 for a not-yet-measured or degenerate box', () => {
    expect(cell(0, 0)).toBe(0);
    expect(cell(-100, 400)).toBe(0);
    expect(flickerCellSide(400, 400, 0, 4)).toBe(0);
    expect(flickerCellSide(Number.NaN, 400, 5, 4)).toBe(0);
  });

  it('never overflows the box it is given — the Corsi failure mode', () => {
    const boxes: [number, number][] = [
      [320, 480],
      [360, 640],
      [768, 1024],
      [1440, 900],
      [2560, 1440],
      [300, 200],
    ];
    for (const [w, h] of boxes) {
      const side = cell(w, h);
      expect(side * FLICKER_COLS).toBeLessThanOrEqual(w + 1e-9);
      expect(side * FLICKER_ROWS).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  it('stops growing at the cap on a wide desktop window', () => {
    const side = cell(2560, 1440);
    expect(side).toBeCloseTo(FLICKER_MAX_BOARD_SIDE / FLICKER_COLS, 10);
    expect(side * FLICKER_COLS).toBeLessThanOrEqual(FLICKER_MAX_BOARD_SIDE);
  });

  it('is limited by width on a narrow portrait phone and by height on a short window', () => {
    expect(cell(328, 900)).toBeCloseTo(328 / FLICKER_COLS, 10);
    expect(cell(1200, 240)).toBeCloseTo(240 / FLICKER_ROWS, 10);
  });
});

describe('tap targets at real viewport sizes', () => {
  // A mistap here is a wrong trial, not a cosmetic issue, so the sizes the app
  // is actually used at must clear DESIGN.md's minimum.
  const phones: [string, number, number][] = [
    ['iPhone SE portrait', 320, 568],
    ['iPhone 12/13 portrait', 390, 844],
    ['Pixel portrait', 412, 915],
    ['small tablet portrait', 768, 1024],
    ['desktop window', 1440, 900],
    ['narrow desktop column', 400, 800],
  ];

  for (const [name, w, h] of phones) {
    it(`clears the ${hit.minTarget}px minimum on ${name}`, () => {
      const side = cell(content(w), boardHeight(h));
      expect(side).toBeGreaterThanOrEqual(hit.minTarget);
      expect(isBelowMinTapTarget(side)).toBe(false);
    });
  }

  it('flags — rather than hides — a box too small to give a full-size target', () => {
    // A very short landscape window: fitting still beats overflowing, but the
    // squeeze is reported instead of passing silently.
    const side = cell(content(640), boardHeight(360));
    expect(side * FLICKER_ROWS).toBeLessThanOrEqual(boardHeight(360));
    expect(isBelowMinTapTarget(side)).toBe(true);
  });

  it('does not flag an unmeasured box as a squeezed one', () => {
    expect(isBelowMinTapTarget(0)).toBe(false);
  });
});
