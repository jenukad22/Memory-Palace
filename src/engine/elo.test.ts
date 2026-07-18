import { describe, expect, it } from 'vitest';
import { DEFAULT_K_FACTOR, expectedScore, update } from './elo';

describe('expectedScore', () => {
  it('is 0.5 for evenly matched user and item', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it('is symmetric: E(a,b) + E(b,a) = 1', () => {
    expect(expectedScore(1200, 900) + expectedScore(900, 1200)).toBeCloseTo(1, 10);
  });

  it('approaches 1 when the user vastly outrates the item', () => {
    expect(expectedScore(2400, 800)).toBeGreaterThan(0.99);
    expect(expectedScore(800, 2400)).toBeLessThan(0.01);
  });
});

describe('update', () => {
  it('raises the user and lowers the item on a correct answer', () => {
    const { user, item } = update(1000, 1000, true);
    expect(user).toBeGreaterThan(1000);
    expect(item).toBeLessThan(1000);
  });

  it('lowers the user and raises the item on an incorrect answer', () => {
    const { user, item } = update(1000, 1000, false);
    expect(user).toBeLessThan(1000);
    expect(item).toBeGreaterThan(1000);
  });

  it('moves evenly matched ratings by exactly K/2', () => {
    const { user, item } = update(1000, 1000, true);
    expect(user - 1000).toBeCloseTo(DEFAULT_K_FACTOR / 2, 10);
    expect(1000 - item).toBeCloseTo(DEFAULT_K_FACTOR / 2, 10);
  });

  it('is zero-sum: the user gains exactly what the item loses', () => {
    const cases: [number, number, boolean][] = [
      [1000, 1000, true],
      [1400, 900, false],
      [850, 1600, true],
    ];
    for (const [u, i, correct] of cases) {
      const result = update(u, i, correct);
      expect(result.user - u).toBeCloseTo(i - result.item, 10);
    }
  });

  it('gives an underdog a larger gain than a favorite for the same correct answer', () => {
    const underdog = update(900, 1400, true);
    const favorite = update(1400, 900, true);
    expect(underdog.user - 900).toBeGreaterThan(favorite.user - 1400);
  });

  it('is symmetric across roles: user gain for a win mirrors user loss for the mirrored loss', () => {
    const win = update(1100, 1300, true);
    const loss = update(1300, 1100, false);
    expect(win.user - 1100).toBeCloseTo(-(loss.user - 1300), 10);
  });

  it('respects a custom K-factor', () => {
    const small = update(1000, 1000, true, { kFactor: 8 });
    const large = update(1000, 1000, true, { kFactor: 64 });
    expect(small.user - 1000).toBeCloseTo(4, 10);
    expect(large.user - 1000).toBeCloseTo(32, 10);
  });

  it('leaves ratings unchanged when K is 0', () => {
    const { user, item } = update(1234, 987, true, { kFactor: 0 });
    expect(user).toBe(1234);
    expect(item).toBe(987);
  });

  it('is deterministic for identical inputs', () => {
    expect(update(1050, 975, true)).toEqual(update(1050, 975, true));
  });
});
