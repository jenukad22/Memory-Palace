import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_TOTAL_DAYS,
  CAMPAIGN_WEEKS,
  MIN_LOCI_TO_START,
  MIN_REVIEWS_PER_CAMPAIGN_DAY,
  campaignStatus,
  campaignWeekForDay,
  dayThresholdMet,
  isSameLocalDay,
  setupReady,
  startOfLocalDay,
} from './campaign';

describe('campaignWeekForDay', () => {
  it('maps days 1-7 to week 1 and 8-14 to week 2', () => {
    expect(campaignWeekForDay(1)).toBe(1);
    expect(campaignWeekForDay(7)).toBe(1);
    expect(campaignWeekForDay(8)).toBe(2);
    expect(campaignWeekForDay(14)).toBe(2);
  });

  it('maps day 42 to week 6 and never exceeds CAMPAIGN_WEEKS', () => {
    expect(campaignWeekForDay(CAMPAIGN_TOTAL_DAYS)).toBe(CAMPAIGN_WEEKS);
    expect(campaignWeekForDay(CAMPAIGN_TOTAL_DAYS + 10)).toBe(CAMPAIGN_WEEKS);
  });
});

describe('campaignStatus', () => {
  it('starts at day 1 / week 1 with zero days completed', () => {
    const s = campaignStatus(0);
    expect(s).toEqual({
      day: 1,
      week: 1,
      daysCompleted: 0,
      daysRemaining: CAMPAIGN_TOTAL_DAYS,
      isProgramComplete: false,
    });
  });

  it('reports the next day to do partway through', () => {
    const s = campaignStatus(7);
    expect(s.day).toBe(8);
    expect(s.week).toBe(2);
    expect(s.daysRemaining).toBe(CAMPAIGN_TOTAL_DAYS - 7);
    expect(s.isProgramComplete).toBe(false);
  });

  it('marks the program complete at exactly CAMPAIGN_TOTAL_DAYS, day pinned to the last day', () => {
    const s = campaignStatus(CAMPAIGN_TOTAL_DAYS);
    expect(s.isProgramComplete).toBe(true);
    expect(s.day).toBe(CAMPAIGN_TOTAL_DAYS);
    expect(s.daysRemaining).toBe(0);
  });

  it('never reports a day beyond the program even if daysCompleted overshoots', () => {
    const s = campaignStatus(CAMPAIGN_TOTAL_DAYS + 5);
    expect(s.day).toBe(CAMPAIGN_TOTAL_DAYS);
    expect(s.daysRemaining).toBe(0);
    expect(s.isProgramComplete).toBe(true);
  });
});

describe('setupReady', () => {
  it('requires at least MIN_LOCI_TO_START loci', () => {
    expect(setupReady(MIN_LOCI_TO_START - 1)).toBe(false);
    expect(setupReady(MIN_LOCI_TO_START)).toBe(true);
    expect(setupReady(MIN_LOCI_TO_START + 5)).toBe(true);
  });
});

describe('dayThresholdMet', () => {
  it('requires at least MIN_REVIEWS_PER_CAMPAIGN_DAY reviews today', () => {
    expect(dayThresholdMet(MIN_REVIEWS_PER_CAMPAIGN_DAY - 1)).toBe(false);
    expect(dayThresholdMet(MIN_REVIEWS_PER_CAMPAIGN_DAY)).toBe(true);
  });
});

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
