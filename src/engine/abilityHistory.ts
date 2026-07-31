/**
 * Shapes raw ability_log points for the Elo-over-time chart. ability_log gets
 * one row per graded review — unbounded and noisy to chart directly — so this
 * collapses same-local-day points and, if still too many, stride-samples down
 * while always keeping the first (baseline) and last (current) point.
 */

import { startOfLocalDay } from './calendarDay';

export interface AbilityPoint {
  ts: Date;
  elo: number;
}

const DEFAULT_MAX_POINTS = 180;

/** Collapse same-local-day points to that day's last value, ascending order. */
function collapseByDay(points: AbilityPoint[]): AbilityPoint[] {
  const byDay = new Map<number, AbilityPoint>();
  for (const p of [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime())) {
    byDay.set(startOfLocalDay(p.ts).getTime(), p);
  }
  return [...byDay.values()].sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

export function shapeAbilityHistory(
  points: AbilityPoint[],
  maxPoints: number = DEFAULT_MAX_POINTS,
): AbilityPoint[] {
  const daily = collapseByDay(points);
  if (daily.length <= maxPoints) return daily;

  // Uniform stride sample, always keeping the first and last point.
  const out: AbilityPoint[] = [daily[0]!];
  const stride = (daily.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(daily[Math.round(i * stride)]!);
  }
  out.push(daily[daily.length - 1]!);
  return out;
}
