import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { AppText, Card, ComingSoonTag, ScreenShell, space } from '@/ui';
import { ModuleProgressSection, type ModuleProgressData } from './ModuleProgressSection';

const STREAK_WINDOW_DAYS = 30;

const INSTRUMENT_LABELS: Record<string, string> = {
  vviq: 'Imagery rating',
  digitspan_forward: 'Forward',
  digitspan_backward: 'Backward',
  corsi_forward: 'Forward',
  corsi_backward: 'Backward',
};

function loadModuleProgress(db: Db, module: string, now: Date): ModuleProgressData {
  const history = shapeAbilityHistory(
    listAbilityHistory(db, module).map((r) => ({ ts: r.ts, elo: r.elo })),
  );
  const eloPoints = history.map((p) => ({ x: p.ts.getTime(), y: p.elo }));

  const cardStates = listFsrsStatesByModule(db, module);
  const retentionPoints = moduleRetrievabilityCurve(cardStates, now, 30).map((p) => ({
    x: p.daysFromNow,
    y: p.retrievability,
  }));

  const activityDays = listModuleActivityDays(db, module);
  const streakCount = currentStreak(activityDays, now);
  const consistencyPct = consistency(activityDays, now, STREAK_WINDOW_DAYS);
  const streakDays = activityWindow(activityDays, now, STREAK_WINDOW_DAYS);

  const baselineTasks = BASELINE_TASKS.map((task) => ({
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

  return { eloPoints, retentionPoints, streakDays, streakCount, consistencyPct, baselineTasks };
}

/**
 * Progress dashboard (docs/superpowers/specs/2026-07-31-progress-dashboard-design.md).
 * Every number below reports performance on the specific task it comes from —
 * see the honesty note. Only `memory` has real content today; attention and
 * reasoning are still stubs, matching app/modules/index.tsx's own treatment.
 */
export function ProgressDashboardScreen() {
  const db = useDb();
  const router = useRouter();
  const [memoryData, setMemoryData] = useState<ModuleProgressData | null>(null);

  useFocusEffect(
    useCallback(() => {
      setMemoryData(loadModuleProgress(db, 'memory', new Date()));
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

        {(['Attention', 'Reasoning'] as const).map((title) => (
          <View key={title} style={{ gap: space.sp3 }}>
            <AppText variant="heading" color="textSecondary">
              {title}
            </AppText>
            <Card>
              <ComingSoonTag />
            </Card>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
