import {
  campaignStatus,
  dayThresholdMet,
  isSameLocalDay,
  setupReady,
  startOfLocalDay,
  type CampaignStatus,
} from '@/engine';
import { newId } from '../id';
import { sessions, type PalaceRow } from '../schema';
import type { Db } from '../types';
import { listPalaces, listLoci } from './palaces';
import { listAssessments } from './assessments';
import { moduleReviewStatsSince } from './reviews';
import { listSessions } from './sessions';

export const CAMPAIGN_MODULE = 'campaign';
export const PALACE_MODULE = 'memory';

export const FREE_RECALL_PRETEST_INSTRUMENT = 'freerecall_pre';
export const FREE_RECALL_POSTTEST_INSTRUMENT = 'freerecall_post';

/** The palace the campaign trains — the one with the most loci (SPEC.md §7.2), or null if none. */
export function bestPalaceForCampaign(db: Db): { palace: PalaceRow; lociCount: number } | null {
  let best: { palace: PalaceRow; lociCount: number } | null = null;
  for (const palace of listPalaces(db)) {
    const lociCount = listLoci(db, palace.id).length;
    if (!best || lociCount > best.lociCount) best = { palace, lociCount };
  }
  return best;
}

/** Whether the setup gate is satisfied — a qualifying palace exists (SPEC.md §7.2). */
export function isSetupReady(db: Db): boolean {
  return setupReady(bestPalaceForCampaign(db)?.lociCount ?? 0);
}

/** How many campaign-day sessions exist — the campaign's day counter (SPEC.md §7.4). */
export function countCampaignDaysCompleted(db: Db): number {
  return listSessions(db, CAMPAIGN_MODULE).length;
}

export function getCampaignStatus(db: Db): CampaignStatus {
  return campaignStatus(countCampaignDaysCompleted(db));
}

/** Whether a campaign-day session has already been recorded today (at most one per calendar day). */
export function hasCampaignSessionToday(db: Db, now: Date = new Date()): boolean {
  const rows = listSessions(db, CAMPAIGN_MODULE);
  return rows.length > 0 && isSameLocalDay(rows[0]!.started, now);
}

/** Today's palace-module review count/hits, for the day-completion progress readout. */
export function todaysPalaceReviewStats(db: Db, now: Date = new Date()) {
  return moduleReviewStatsSince(db, PALACE_MODULE, startOfLocalDay(now));
}

/** Whether today's review count clears the threshold to finish the day (SPEC.md §7.4). */
export function canFinishToday(db: Db, now: Date = new Date()): boolean {
  if (hasCampaignSessionToday(db, now)) return false;
  return dayThresholdMet(todaysPalaceReviewStats(db, now).count);
}

/**
 * Finish today's campaign day: one `sessions` row, `module = 'campaign'`, with
 * items/accuracy computed from today's actual palace-module review stats.
 * `started`/`ended` are both `now` — no elapsed-time instrumentation exists, so
 * we do not fabricate a duration (SPEC.md §7.4). Throws if the day is not yet
 * eligible (threshold unmet, or today's day already recorded).
 */
export function finishCampaignDay(db: Db, now: Date = new Date()): void {
  if (!canFinishToday(db, now)) {
    throw new Error('campaign day is not eligible to finish yet');
  }
  const stats = todaysPalaceReviewStats(db, now);
  db.insert(sessions)
    .values({
      id: newId(),
      started: now,
      ended: now,
      module: CAMPAIGN_MODULE,
      items: stats.count,
      accuracy: stats.count > 0 ? stats.hits / stats.count : 0,
    })
    .run();
}

/** The latest free-recall pretest/posttest result, or undefined if not yet taken. */
export function getFreeRecallPretest(db: Db) {
  return listAssessments(db, FREE_RECALL_PRETEST_INSTRUMENT)[0];
}

export function getFreeRecallPosttest(db: Db) {
  return listAssessments(db, FREE_RECALL_POSTTEST_INSTRUMENT)[0];
}
