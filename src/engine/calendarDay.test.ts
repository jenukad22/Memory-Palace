import { describe, expect, it } from 'vitest';
import { isSameLocalDay, startOfLocalDay } from './calendarDay';

describe('startOfLocalDay / isSameLocalDay', () => {
  it('floors an instant to local midnight', () => {
    const d = new Date(2026, 6, 21, 23, 59, 59);
    const start = startOfLocalDay(d);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(21);
  });

  it('treats two instants on the same calendar day as the same day', () => {
    const morning = new Date(2026, 6, 21, 6, 0, 0);
    const night = new Date(2026, 6, 21, 23, 30, 0);
    expect(isSameLocalDay(morning, night)).toBe(true);
  });

  it('treats midnight-adjacent instants on different days as different', () => {
    const lateNight = new Date(2026, 6, 21, 23, 59, 59);
    const nextMorning = new Date(2026, 6, 22, 0, 0, 1);
    expect(isSameLocalDay(lateNight, nextMorning)).toBe(false);
  });
});
