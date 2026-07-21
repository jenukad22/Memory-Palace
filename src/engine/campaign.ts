/**
 * Six-week method-of-loci campaign (modules/memory/SPEC.md §7) — pure day/week
 * math, the setup gate, and calendar-day helpers. No FSRS/Elo of its own: the
 * daily drill is the existing palace trainer: this module only decides when a
 * day counts as done and what week it falls in.
 */

export const CAMPAIGN_TOTAL_DAYS = 42;
export const CAMPAIGN_WEEKS = 6;
export const DAYS_PER_WEEK = 7;

/** Floor on loci before day 1 can start — enough stops for a session to be worth running. */
export const MIN_LOCI_TO_START = 10;

/** Reviews needed on today's calendar day before "Finish today's session" unlocks. */
export const MIN_REVIEWS_PER_CAMPAIGN_DAY = 15;

export interface CampaignStatus {
  /** 1-indexed day the user is on (next day to complete), capped at CAMPAIGN_TOTAL_DAYS. */
  day: number;
  /** 1-indexed week containing `day`. */
  week: number;
  daysCompleted: number;
  daysRemaining: number;
  isProgramComplete: boolean;
}

/** Which week (1-indexed) a 1-indexed day number falls in. */
export function campaignWeekForDay(day: number): number {
  return Math.min(CAMPAIGN_WEEKS, Math.ceil(day / DAYS_PER_WEEK));
}

/** Program status derived purely from how many campaign-day sessions exist. */
export function campaignStatus(daysCompleted: number): CampaignStatus {
  const isProgramComplete = daysCompleted >= CAMPAIGN_TOTAL_DAYS;
  const day = Math.min(daysCompleted + 1, CAMPAIGN_TOTAL_DAYS);
  return {
    day,
    week: campaignWeekForDay(day),
    daysCompleted,
    daysRemaining: Math.max(0, CAMPAIGN_TOTAL_DAYS - daysCompleted),
    isProgramComplete,
  };
}

/** Whether the setup gate (SPEC.md §7.2) is satisfied. */
export function setupReady(bestPalaceLociCount: number): boolean {
  return bestPalaceLociCount >= MIN_LOCI_TO_START;
}

/** Whether today's review count clears the day-completion threshold (SPEC.md §7.4). */
export function dayThresholdMet(reviewsToday: number): boolean {
  return reviewsToday >= MIN_REVIEWS_PER_CAMPAIGN_DAY;
}

/** Local midnight for the given instant — the calendar-day boundary this module uses throughout. */
export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whether two instants fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime();
}
