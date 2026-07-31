import { describe, expect, it } from 'vitest';
import { activityWindow, consistency, currentStreak } from './streak';

const day = (offsetFromToday: number, base: Date) => {
  const d = new Date(base);
  d.setDate(d.getDate() - offsetFromToday);
  return d;
};

describe('currentStreak', () => {
  const now = new Date(2026, 6, 31, 10, 0, 0); // 2026-07-31

  it('is 0 with no activity', () => {
    expect(currentStreak([], now)).toBe(0);
  });

  it('is 1 with a single activity day today', () => {
    expect(currentStreak([day(0, now)], now)).toBe(1);
  });

  it('counts a consecutive run and stops at the first gap', () => {
    // today, yesterday, day-before all active; then a gap at day-3.
    const activity = [day(0, now), day(1, now), day(2, now), day(4, now)];
    expect(currentStreak(activity, now)).toBe(3);
  });

  it('is 0 when today has no activity, even if yesterday did', () => {
    expect(currentStreak([day(1, now)], now)).toBe(0);
  });

  it('dedupes multiple timestamps on the same day', () => {
    const morning = new Date(2026, 6, 31, 6, 0, 0);
    const night = new Date(2026, 6, 31, 23, 0, 0);
    expect(currentStreak([morning, night], now)).toBe(1);
  });
});

describe('consistency', () => {
  const now = new Date(2026, 6, 31, 10, 0, 0);

  it('is 0 with no activity', () => {
    expect(consistency([], now, 30)).toBe(0);
  });

  it('counts active days within the window as a fraction', () => {
    const activity = [day(0, now), day(5, now), day(10, now)];
    expect(consistency(activity, now, 30)).toBeCloseTo(3 / 30);
  });

  it('includes the window boundary day (windowDays - 1) and excludes windowDays', () => {
    const withinBoundary = [day(29, now)];
    expect(consistency(withinBoundary, now, 30)).toBeCloseTo(1 / 30);
    const outsideBoundary = [day(30, now)];
    expect(consistency(outsideBoundary, now, 30)).toBe(0);
  });
});

describe('activityWindow', () => {
  const now = new Date(2026, 6, 31, 10, 0, 0);

  it('returns an oldest-to-today boolean array of length windowDays', () => {
    const activity = [day(0, now), day(2, now)];
    const window = activityWindow(activity, now, 5);
    expect(window).toHaveLength(5);
    // index 4 = today (active), index 2 = two days ago (active), rest false.
    expect(window[4]).toBe(true);
    expect(window[2]).toBe(true);
    expect(window[0]).toBe(false);
    expect(window[1]).toBe(false);
    expect(window[3]).toBe(false);
  });

  it('is all false with no activity', () => {
    expect(activityWindow([], now, 3)).toEqual([false, false, false]);
  });
});
