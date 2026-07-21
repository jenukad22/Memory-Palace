/**
 * End-to-end smoke test through the DB + engine layers only.
 *
 * Scope (what this proves): one continuous, deterministic walkthrough against
 * a single fresh in-memory sql.js database — migrations, the baseline
 * assessment battery, the palace/PAO review pipeline, the daily due-card
 * queue, and the six-week campaign path — asserting the real persisted state
 * at each step, the same way the screens would leave it. Every timestamp is
 * explicit; nothing depends on real wall-clock time.
 *
 * Scope (what this does NOT prove): it never renders a screen, never touches
 * React/React Native/Expo Router, and says nothing about whether the web
 * platform's async bootstrap (DbProvider -> client.web.ts -> sql.js WASM +
 * IndexedDB persistence) actually resolves in a real browser. That crosses a
 * boundary (WASM instantiation, IndexedDB) this Node/Vitest environment does
 * not have and cannot simulate — it has to be checked with `expo start --web`
 * in an actual browser tab.
 *
 * `it()` blocks below run in declaration order and share one `db` (via
 * `beforeAll`, not `beforeEach`) because each stage's assertions depend on
 * state the previous stage left behind — this is intentionally one ordered
 * walkthrough, not a set of independent unit tests.
 */
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { SPAN_INSTRUMENTS, spanPayload, type SpanTrialLogEntry } from '@/assessment/battery';
import { getAbility, upsertAbility } from '../db/queries/ability';
import { insertAssessment, listAssessments } from '../db/queries/assessments';
import {
  bestPalaceForCampaign,
  canFinishToday,
  countCampaignDaysCompleted,
  finishCampaignDay,
  FREE_RECALL_POSTTEST_INSTRUMENT,
  FREE_RECALL_PRETEST_INSTRUMENT,
  getFreeRecallPosttest,
  getFreeRecallPretest,
  hasCampaignSessionToday,
  isSetupReady,
} from '../db/queries/campaign';
import { createCard, getFsrsState } from '../db/queries/cards';
import { listDueCards } from '../db/queries/due';
import { addLocus, createPalace, createTrainingSet, listLoci } from '../db/queries/palaces';
import { listPaoCards, upsertPaoEntry } from '../db/queries/pao';
import { listReviewsByCard, recordReview } from '../db/queries/reviews';
import { endSession, listSessions, startSession } from '../db/queries/sessions';
import { createTestDb } from '../db/testing';
import type { Db } from '../db/types';
import {
  CORSI_SPAN_START,
  DIGIT_SPAN_START,
  ELO_MAX,
  ELO_MIN,
  FREE_RECALL_LIST_LENGTH,
  MIN_REVIEWS_PER_CAMPAIGN_DAY,
  SPAN_MAX_LENGTH,
  WORD_BANK,
  initSpanState,
  makeRng,
  normalizeSpan,
  recordSpanTrial,
  sampleWordList,
  scoreFreeRecall,
  seedModuleElo,
  vviqTotal,
  type SpanState,
} from '@/engine';

// Fixed instants — every write in this file threads one of these through
// explicitly, so the suite is reproducible regardless of when it runs.
const NOW = new Date('2026-07-21T09:00:00.000Z');
// Deliberately a different calendar day from NOW, so the campaign day's review
// count doesn't pick up the palace/PAO reviews logged earlier under NOW.
const CAMPAIGN_DAY = new Date('2026-08-01T09:00:00.000Z');

const EXPECTED_MIGRATION_TAGS = [
  '0000_known_mephisto',
  '0001_review_log_append_only',
  '0002_robust_arclight',
  '0003_tranquil_guardsmen',
];

const PLACEMENT_ITEMS = [
  'a brass key',
  'a ripe tomato',
  'a paper crane',
  'a violin',
  'a green umbrella',
];

/** Drive a span instrument's state machine to completion via the real engine rule. */
function driveSpanToFinish(
  startLength: number,
  targetSpan: number,
  maxLength: number,
): { state: SpanState; trials: SpanTrialLogEntry[] } {
  let state = initSpanState(startLength);
  const trials: SpanTrialLogEntry[] = [];
  while (!state.finished) {
    const passed = state.currentLength <= targetSpan;
    trials.push({ length: state.currentLength, passed });
    state = recordSpanTrial(state, passed, { maxLength });
  }
  return { state, trials };
}

describe('end-to-end smoke test (DB + engine layers)', () => {
  let db: Db;
  let palaceId: string;
  let placementCardIds: string[];
  let paoCardIds: string[];
  let pretestWords: string[];

  beforeAll(async () => {
    ({ db } = await createTestDb());
  });

  it('1. applies every migration to a fresh DB, in order', () => {
    const rows = db.all(sql`SELECT tag FROM _migrations ORDER BY rowid`) as { tag: string }[];
    // Note: 4 migrations, not 3 — 0003 (palaces/loci) was added in an earlier
    // phase of this project. This assertion reflects the current codebase.
    expect(rows.map((r) => r.tag)).toEqual(EXPECTED_MIGRATION_TAGS);
  });

  it('2. runs the full baseline battery: 5 assessment rows, a plausible memory Elo, session closed', () => {
    const sessionId = startSession(db, 'memory', NOW);
    let itemsDone = 0;

    const vviqResponses = Array(16).fill(4) as number[];
    insertAssessment(db, {
      instrument: 'vviq',
      rawScore: vviqTotal(vviqResponses),
      payload: JSON.stringify({ responses: vviqResponses }),
      ts: NOW,
    });
    itemsDone += 1;

    const forwardDigit = driveSpanToFinish(DIGIT_SPAN_START, 6, SPAN_MAX_LENGTH);
    insertAssessment(db, {
      instrument: 'digitspan_forward',
      rawScore: forwardDigit.state.span,
      payload: spanPayload(forwardDigit.trials),
      ts: NOW,
    });
    itemsDone += 1;

    const backwardDigit = driveSpanToFinish(DIGIT_SPAN_START, 5, SPAN_MAX_LENGTH);
    insertAssessment(db, {
      instrument: 'digitspan_backward',
      rawScore: backwardDigit.state.span,
      payload: spanPayload(backwardDigit.trials),
      ts: NOW,
    });
    itemsDone += 1;

    const forwardCorsi = driveSpanToFinish(CORSI_SPAN_START, 5, SPAN_MAX_LENGTH);
    insertAssessment(db, {
      instrument: 'corsi_forward',
      rawScore: forwardCorsi.state.span,
      payload: spanPayload(forwardCorsi.trials),
      ts: NOW,
    });
    itemsDone += 1;

    const backwardCorsi = driveSpanToFinish(CORSI_SPAN_START, 4, SPAN_MAX_LENGTH);
    insertAssessment(db, {
      instrument: 'corsi_backward',
      rawScore: backwardCorsi.state.span,
      payload: spanPayload(backwardCorsi.trials),
      ts: NOW,
    });
    itemsDone += 1;

    // Mirrors CorsiScreen.finalizeBattery: seed memory Elo from the four span rows.
    const normalized = SPAN_INSTRUMENTS.map((instrument) => {
      const rows = listAssessments(db, instrument);
      const samples = rows.map((r) => r.rawScore);
      return normalizeSpan(rows[0]!.rawScore, samples);
    });
    upsertAbility(db, 'memory', seedModuleElo(normalized), NOW);
    endSession(db, sessionId, { items: itemsDone, accuracy: 0, ended: NOW });

    expect(listAssessments(db)).toHaveLength(5);
    for (const instrument of [
      'vviq',
      'digitspan_forward',
      'digitspan_backward',
      'corsi_forward',
      'corsi_backward',
    ]) {
      expect(listAssessments(db, instrument)).toHaveLength(1);
    }

    const ability = getAbility(db, 'memory');
    expect(ability).toBeDefined();
    expect(Number.isFinite(ability!.elo)).toBe(true);
    expect(ability!.elo).toBeGreaterThanOrEqual(ELO_MIN);
    expect(ability!.elo).toBeLessThanOrEqual(ELO_MAX);

    const [session] = listSessions(db, 'memory');
    expect(session?.ended?.getTime()).toBe(NOW.getTime());
    expect(session?.items).toBe(5);
    expect(session?.accuracy).toBe(0);
  });

  it('3. authors a palace with loci + placement cards, and PAO entries', () => {
    const palace = createPalace(db, { name: 'Smoke Test Route', now: NOW });
    palaceId = palace.id;
    // 12 loci comfortably clears the campaign's MIN_LOCI_TO_START gate (10).
    for (let i = 0; i < 12; i += 1) {
      addLocus(db, { palaceId, label: `Stop ${i}`, now: NOW });
    }
    expect(listLoci(db, palaceId)).toHaveLength(12);

    const { cardIds } = createTrainingSet(db, { palaceId, items: PLACEMENT_ITEMS, now: NOW });
    placementCardIds = cardIds;
    expect(placementCardIds).toHaveLength(PLACEMENT_ITEMS.length);

    upsertPaoEntry(db, { n: 7, person: 'Diver', action: 'juggling', object: 'anchor' }, NOW);
    upsertPaoEntry(db, { n: 23, person: 'Chef', action: 'skating', object: 'kettle' }, NOW);
    const paoEntries = listPaoCards(db);
    expect(paoEntries).toHaveLength(2);
    paoCardIds = paoEntries.map((e) => e.cardId);
  });

  it('3b. recordReview appends review_log, advances FSRS, and moves Elo — atomically', () => {
    const cardId = placementCardIds[0]!;
    const before = getFsrsState(db, cardId)!;
    expect(before.phase).toBe('new');
    const eloBefore = getAbility(db, 'memory')!.elo;
    const reviewsBefore = listReviewsByCard(db, cardId).length;

    recordReview(db, { cardId, module: 'memory', rating: 'good', now: NOW });

    expect(listReviewsByCard(db, cardId)).toHaveLength(reviewsBefore + 1);
    const after = getFsrsState(db, cardId)!;
    expect(after.phase).not.toBe('new');
    expect(after.due.getTime()).toBeGreaterThan(before.due.getTime());
    expect(getAbility(db, 'memory')!.elo).not.toBe(eloBefore);

    // Same pipeline for a PAO entry, module 'pao'.
    recordReview(db, { cardId: paoCardIds[0]!, module: 'pao', rating: 'good', now: NOW });
    expect(getAbility(db, 'pao')).toBeDefined();
  });

  it('4. a freshly rated card drops out of listDueCards immediately, and a new card leaves the new phase after first rating', () => {
    // placementCardIds[0] was reviewed in 3b -> should no longer be due.
    expect(listDueCards(db, NOW).map((c) => c.cardId)).not.toContain(placementCardIds[0]);

    // A never-reviewed placement card starts in the new phase and is due immediately.
    const freshCardId = placementCardIds[1]!;
    const beforeDue = listDueCards(db, NOW).find((c) => c.cardId === freshCardId);
    expect(beforeDue?.phase).toBe('new');

    recordReview(db, { cardId: freshCardId, module: 'memory', rating: 'good', now: NOW });

    expect(listDueCards(db, NOW).map((c) => c.cardId)).not.toContain(freshCardId);
    expect(getFsrsState(db, freshCardId)!.phase).not.toBe('new');
  });

  it('5. campaign: pretest -> qualifying day derived from real review activity -> posttest -> delta', () => {
    expect(isSetupReady(db)).toBe(true);
    expect(bestPalaceForCampaign(db)?.palace.id).toBe(palaceId);

    // Pretest: sample 72 words, simulate a modest baseline recall of 20.
    pretestWords = sampleWordList(WORD_BANK, FREE_RECALL_LIST_LENGTH, makeRng(1));
    const pretestRecalled = pretestWords.slice(0, 20);
    const pretestScore = scoreFreeRecall(pretestWords, pretestRecalled);
    expect(pretestScore.count).toBe(20);
    insertAssessment(db, {
      instrument: FREE_RECALL_PRETEST_INSTRUMENT,
      rawScore: pretestScore.count,
      payload: JSON.stringify({
        list: pretestWords,
        recalled: pretestRecalled,
        correct: pretestScore.correct,
        missed: pretestScore.missed,
        intrusions: pretestScore.intrusions,
      }),
      ts: NOW,
    });

    // Day completion must derive from real review_log activity, not merely
    // from the calendar day having started.
    expect(canFinishToday(db, CAMPAIGN_DAY)).toBe(false);

    for (let i = 0; i < MIN_REVIEWS_PER_CAMPAIGN_DAY; i += 1) {
      const card = createCard(db, {
        module: 'memory',
        front: `smoke-${i}`,
        back: 'x',
        now: CAMPAIGN_DAY,
      });
      recordReview(db, { cardId: card.id, module: 'memory', rating: 'good', now: CAMPAIGN_DAY });
    }
    expect(canFinishToday(db, CAMPAIGN_DAY)).toBe(true);

    finishCampaignDay(db, CAMPAIGN_DAY);
    expect(countCampaignDaysCompleted(db)).toBe(1);
    expect(hasCampaignSessionToday(db, CAMPAIGN_DAY)).toBe(true);

    // Posttest: fully disjoint word list, higher recall than pretest.
    const posttestWords = sampleWordList(
      WORD_BANK,
      FREE_RECALL_LIST_LENGTH,
      makeRng(2),
      new Set(pretestWords),
    );
    expect(posttestWords.some((w) => pretestWords.includes(w))).toBe(false);

    const posttestRecalled = posttestWords.slice(0, 35);
    const posttestScore = scoreFreeRecall(posttestWords, posttestRecalled);
    expect(posttestScore.count).toBe(35);
    insertAssessment(db, {
      instrument: FREE_RECALL_POSTTEST_INSTRUMENT,
      rawScore: posttestScore.count,
      payload: JSON.stringify({
        list: posttestWords,
        recalled: posttestRecalled,
        correct: posttestScore.correct,
        missed: posttestScore.missed,
        intrusions: posttestScore.intrusions,
      }),
      ts: CAMPAIGN_DAY,
    });

    // Delta reads back correctly — exactly what CampaignResultsScreen computes.
    const pretestRow = getFreeRecallPretest(db)!;
    const posttestRow = getFreeRecallPosttest(db)!;
    expect(pretestRow.rawScore).toBe(20);
    expect(posttestRow.rawScore).toBe(35);
    expect(posttestRow.rawScore - pretestRow.rawScore).toBe(15);
  });
});
