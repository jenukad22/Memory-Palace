import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { BASELINE_TASKS } from '@/assessment/battery';
import {
  listAbilityHistory,
  listAssessments,
  listFsrsStatesByModule,
  listModuleActivityDays,
  useDb,
  type Db,
} from '@/db';
import {
  activityWindow,
  consistency,
  currentStreak,
  moduleRetrievabilityCurve,
  shapeAbilityHistory,
} from '@/engine';
import {
  ATTENTION_INSTRUMENTS,
  ATTENTION_MODULE,
  CPT_INSTRUMENT,
  FLICKER_INSTRUMENT,
  PVT_INSTRUMENT,
} from '@/modules/attention';
import {
  BASE_RATE_INSTRUMENT,
  CALIBRATION_INSTRUMENT,
  DISCONFIRMATION_INSTRUMENT,
  HYPOTHESES_INSTRUMENT,
  REASONING_INSTRUMENTS,
  REASONING_MODULE,
} from '@/modules/reasoning';
import { AppText, Card, ScreenShell, space } from '@/ui';
import { ModuleProgressSection, type ModuleProgressData } from './ModuleProgressSection';

const STREAK_WINDOW_DAYS = 30;

const INSTRUMENT_LABELS: Record<string, string> = {
  vviq: 'Imagery rating',
  digitspan_forward: 'Forward',
  digitspan_backward: 'Backward',
  corsi_forward: 'Forward',
  corsi_backward: 'Backward',
  [PVT_INSTRUMENT]: 'Response speed (/s)',
  [CPT_INSTRUMENT]: 'd′',
  [FLICKER_INSTRUMENT]: 'Time to find (ms)',
  [BASE_RATE_INSTRUMENT]: 'Mean error (pp)',
  [HYPOTHESES_INSTRUMENT]: 'Unique per prompt',
  [DISCONFIRMATION_INSTRUMENT]: 'Self-score (0-1)',
  [CALIBRATION_INSTRUMENT]: 'Brier score',
};

/** A task whose raw scores get a trend card, with the route that re-runs it. */
interface TrendTask {
  label: string;
  instruments: readonly string[];
  retakeRoute: string;
}

/**
 * Attention's three tasks in the same shape the baseline tasks use, so one
 * trend card renders both. These are repeatable runs rather than a one-off
 * baseline (modules/attention/SPEC.md §2), but "run it again" is the same action.
 */
const ATTENTION_TASKS: readonly TrendTask[] = [
  { label: 'PVT-B', instruments: [PVT_INSTRUMENT], retakeRoute: '/modules/attention/pvt' },
  { label: 'Go / no-go', instruments: [CPT_INSTRUMENT], retakeRoute: '/modules/attention/cpt' },
  {
    label: 'Change flicker',
    instruments: [FLICKER_INSTRUMENT],
    retakeRoute: '/modules/attention/flicker',
  },
];

/** Reasoning's four tasks, same shape (SPEC.md §2). */
const REASONING_TASKS: readonly TrendTask[] = [
  {
    label: 'Base rates',
    instruments: [BASE_RATE_INSTRUMENT],
    retakeRoute: '/modules/reasoning/base-rate',
  },
  {
    label: 'Hypotheses',
    instruments: [HYPOTHESES_INSTRUMENT],
    retakeRoute: '/modules/reasoning/hypotheses',
  },
  {
    label: 'Disconfirmation',
    instruments: [DISCONFIRMATION_INSTRUMENT],
    retakeRoute: '/modules/reasoning/disconfirmation',
  },
  {
    label: 'Calibration',
    instruments: [CALIBRATION_INSTRUMENT],
    retakeRoute: '/modules/reasoning/calibration',
  },
];

function trendSeries(db: Db, tasks: readonly TrendTask[]) {
  return tasks.map((task) => ({
    taskLabel: task.label,
    retakeRoute: task.retakeRoute,
    series: task.instruments.map((instrument) => ({
      label: INSTRUMENT_LABELS[instrument] ?? instrument,
      history: listAssessments(db, instrument)
        .slice()
        .reverse()
        .map((a) => ({ ts: a.ts, rawScore: a.rawScore })),
    })),
  }));
}

function streakParts(activityDays: Date[], now: Date) {
  return {
    streakCount: currentStreak(activityDays, now),
    consistencyPct: consistency(activityDays, now, STREAK_WINDOW_DAYS),
    streakDays: activityWindow(activityDays, now, STREAK_WINDOW_DAYS),
  };
}

function loadMemoryProgress(db: Db, now: Date): ModuleProgressData {
  const history = shapeAbilityHistory(
    listAbilityHistory(db, 'memory').map((r) => ({ ts: r.ts, elo: r.elo })),
  );
  const cardStates = listFsrsStatesByModule(db, 'memory');
  return {
    eloPoints: history.map((p) => ({ x: p.ts.getTime(), y: p.elo })),
    retentionPoints: moduleRetrievabilityCurve(cardStates, now, 30).map((p) => ({
      x: p.daysFromNow,
      y: p.retrievability,
    })),
    ...streakParts(listModuleActivityDays(db, 'memory'), now),
    baselineTasks: trendSeries(db, BASELINE_TASKS),
  };
}

/**
 * Attention progress. Two shape differences from memory, both because attention
 * runs are timed tasks rather than scheduled reviews: there is no FSRS
 * retention curve to draw (`retentionPoints: null`), and activity days come
 * from the assessment rows the tasks write, since attention logs no reviews.
 */
function loadAttentionProgress(db: Db, now: Date): ModuleProgressData {
  const history = shapeAbilityHistory(
    listAbilityHistory(db, ATTENTION_MODULE).map((r) => ({ ts: r.ts, elo: r.elo })),
  );
  const activityDays = ATTENTION_INSTRUMENTS.flatMap((instrument) =>
    listAssessments(db, instrument).map((row) => row.ts),
  );
  return {
    eloPoints: history.map((p) => ({ x: p.ts.getTime(), y: p.elo })),
    retentionPoints: null,
    ...streakParts(activityDays, now),
    baselineTasks: trendSeries(db, ATTENTION_TASKS),
    eloEmptyLabel: 'Finish an attention task to see this.',
  };
}

/** Reasoning progress. Same shape as attention — no scheduled cards, activity
 *  days come from the assessment rows the tasks write. */
function loadReasoningProgress(db: Db, now: Date): ModuleProgressData {
  const history = shapeAbilityHistory(
    listAbilityHistory(db, REASONING_MODULE).map((r) => ({ ts: r.ts, elo: r.elo })),
  );
  const activityDays = REASONING_INSTRUMENTS.flatMap((instrument) =>
    listAssessments(db, instrument).map((row) => row.ts),
  );
  return {
    eloPoints: history.map((p) => ({ x: p.ts.getTime(), y: p.elo })),
    retentionPoints: null,
    ...streakParts(activityDays, now),
    baselineTasks: trendSeries(db, REASONING_TASKS),
    eloEmptyLabel: 'Finish a reasoning task to see this.',
  };
}

/**
 * Progress dashboard (docs/superpowers/specs/2026-07-31-progress-dashboard-design.md).
 * Every number below reports performance on the specific task it comes from —
 * see the honesty note. All three modules have real content.
 */
export function ProgressDashboardScreen() {
  const db = useDb();
  const router = useRouter();
  const [memoryData, setMemoryData] = useState<ModuleProgressData | null>(null);
  const [attentionData, setAttentionData] = useState<ModuleProgressData | null>(null);
  const [reasoningData, setReasoningData] = useState<ModuleProgressData | null>(null);

  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setMemoryData(loadMemoryProgress(db, now));
      setAttentionData(loadAttentionProgress(db, now));
      setReasoningData(loadReasoningProgress(db, now));
    }, [db]),
  );

  return (
    <ScreenShell kicker="Progress" taskName="Dashboard">
      <ScrollView contentContainerStyle={{ gap: space.sp4, paddingVertical: space.sp4 }}>
        <AppText variant="title">Progress</AppText>

        <Card>
          <AppText variant="bodyStrong">What this does and doesn’t mean</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingTop: space.sp2 }}>
            Every number here reflects performance on the specific task it comes from — a rating for
            graded reviews in this module, a retention estimate for the cards you’ve studied, or a
            raw score on one baseline task. Improvement shown here is tied to the training you’ve
            done and doesn’t say anything about your abilities outside these tasks.
          </AppText>
        </Card>

        {memoryData ? (
          <ModuleProgressSection
            title="Memory"
            data={memoryData}
            onRetake={(route) => router.push(route)}
          />
        ) : null}

        {attentionData ? (
          <ModuleProgressSection
            title="Attention"
            data={attentionData}
            onRetake={(route) => router.push(route)}
          />
        ) : null}

        {reasoningData ? (
          <ModuleProgressSection
            title="Reasoning"
            data={reasoningData}
            onRetake={(route) => router.push(route)}
          />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
