import { describe, expect, it } from 'vitest';
import { shapeAbilityHistory, type AbilityPoint } from './abilityHistory';

// Local-time fixtures (shapeAbilityHistory collapses by *local* calendar day,
// like every other calendar-day helper in this codebase — see calendarDay.ts).
const d = (year: number, month: number, day: number, hours = 12) =>
  new Date(year, month - 1, day, hours);

describe('shapeAbilityHistory', () => {
  it('returns [] for empty input', () => {
    expect(shapeAbilityHistory([])).toEqual([]);
  });

  it('returns a single point unchanged', () => {
    const points: AbilityPoint[] = [{ ts: d(2026, 7, 1), elo: 1200 }];
    expect(shapeAbilityHistory(points)).toEqual(points);
  });

  it('collapses multiple same-day points to the last one, ascending order', () => {
    const points: AbilityPoint[] = [
      { ts: d(2026, 7, 1, 8), elo: 1190 },
      { ts: d(2026, 7, 1, 20), elo: 1210 },
      { ts: d(2026, 6, 30, 10), elo: 1180 },
    ];
    expect(shapeAbilityHistory(points)).toEqual([
      { ts: d(2026, 6, 30, 10), elo: 1180 },
      { ts: d(2026, 7, 1, 20), elo: 1210 },
    ]);
  });

  it('leaves input already at or under maxPoints unchanged after day-collapse', () => {
    const points: AbilityPoint[] = [
      { ts: d(2026, 7, 1), elo: 1200 },
      { ts: d(2026, 7, 2), elo: 1210 },
      { ts: d(2026, 7, 3), elo: 1205 },
    ];
    expect(shapeAbilityHistory(points, 10)).toEqual(points);
  });

  it('stride-samples down to maxPoints while preserving the first and last point exactly', () => {
    const points: AbilityPoint[] = Array.from({ length: 400 }, (_, i) => ({
      ts: new Date(2025, 0, 1 + i, 12),
      elo: 1200 + i,
    }));
    const shaped = shapeAbilityHistory(points, 180);
    expect(shaped.length).toBeLessThanOrEqual(180);
    expect(shaped[0]).toEqual(points[0]);
    expect(shaped[shaped.length - 1]).toEqual(points[points.length - 1]);
    // ascending order preserved
    for (let i = 1; i < shaped.length; i++) {
      expect(shaped[i]!.ts.getTime()).toBeGreaterThan(shaped[i - 1]!.ts.getTime());
    }
  });
});
