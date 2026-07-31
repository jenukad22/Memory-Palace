/**
 * Streak/consistency for the progress dashboard (docs/superpowers/specs/
 * 2026-07-31-progress-dashboard-design.md §2). "Activity" is deliberately just
 * the calendar days a module has review_log rows on — see the spec for why
 * sessions rows aren't folded in.
 */

import { startOfLocalDay } from './calendarDay';

function distinctDayTimes(activityDays: Date[]): Set<number> {
  return new Set(activityDays.map((d) => startOfLocalDay(d).getTime()));
}

/**
 * Consecutive local calendar days, walking back from `now`, with at least one
 * activity day. No grace days: a gap on today itself yields 0.
 */
export function currentStreak(activityDays: Date[], now: Date): number {
  const days = distinctDayTimes(activityDays);
  let streak = 0;
  const cursor = startOfLocalDay(now);
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Fraction of the trailing `windowDays` (inclusive of today) with at least one
 * activity day. Returns a 0..1 fraction, matching this codebase's existing
 * "accuracy"-shaped values (e.g. sessions.accuracy) — formatting to a percent
 * is a UI concern.
 */
export function consistency(activityDays: Date[], now: Date, windowDays: number): number {
  const days = distinctDayTimes(activityDays);
  const today = startOfLocalDay(now).getTime();
  let active = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.getTime())) active += 1;
  }
  return active / windowDays;
}

/**
 * The same trailing window as `consistency`, as an ordered oldest→today
 * boolean array — feeds StreakStrip directly with no further shaping.
 */
export function activityWindow(activityDays: Date[], now: Date, windowDays: number): boolean[] {
  const days = distinctDayTimes(activityDays);
  const today = startOfLocalDay(now).getTime();
  const out: boolean[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(days.has(d.getTime()));
  }
  return out;
}
