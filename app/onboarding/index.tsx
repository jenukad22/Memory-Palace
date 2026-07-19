import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { batteryFills, doneSet, nextRoute } from '@/assessment/battery';
import { listAssessments, startSession, useDb } from '@/db';
import { useBatterySession } from '@/state';
import { AppText, Button, ScreenShell, space } from '@/ui';

export default function OnboardingIndex() {
  const db = useDb();
  const router = useRouter();
  const done = useMemo(() => doneSet(listAssessments(db)), [db]);
  const next = nextRoute(done);
  const resuming = done.size > 0 && next !== '/onboarding/complete';

  const begin = () => {
    const sessionId = startSession(db, 'memory');
    useBatterySession.getState().begin(sessionId);
    router.replace(next);
  };

  return (
    <ScreenShell kicker="Baseline" fills={batteryFills(done)}>
      <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
        <AppText variant="title">Baseline assessment</AppText>
        <AppText variant="secondary" color="textSecondary">
          Three short tasks — imagery ratings, digit span, and Corsi block-tapping. About 15 minutes
          in all. You can pause between tasks and pick up where you left off.
        </AppText>
        <View style={{ paddingTop: space.sp3, gap: space.sp2 }}>
          {next === '/onboarding/complete' ? (
            <Button
              kind="secondary"
              label="See your results"
              onPress={() => router.replace('/onboarding/complete')}
            />
          ) : (
            <Button label={resuming ? 'Resume' : 'Begin'} onPress={begin} />
          )}
          <Button kind="ghost" label="Back" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenShell>
  );
}
