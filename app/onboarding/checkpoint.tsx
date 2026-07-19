import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { batteryFills, checkpointCopy, doneSet, nextRoute } from '@/assessment/battery';
import { endSession, listAssessments, useDb } from '@/db';
import { useBatterySession } from '@/state';
import { CheckpointSheet, ScreenShell, space } from '@/ui';

// The between-instruments checkpoint (SPEC.md sec 1). Deferral closes the
// sessions row (accuracy stays 0 for batteries, sec 10); resuming later opens
// a new one from the onboarding index.
export default function CheckpointRoute() {
  const db = useDb();
  const router = useRouter();
  const done = useMemo(() => doneSet(listAssessments(db)), [db]);
  const copy = checkpointCopy(done);

  const finishLater = () => {
    const { sessionId, itemsDone } = useBatterySession.getState();
    if (sessionId !== null) {
      endSession(db, sessionId, { items: itemsDone, accuracy: 0 });
    }
    useBatterySession.getState().reset();
    router.replace('/');
  };

  return (
    <ScreenShell kicker="Baseline" fills={batteryFills(done)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: space.sp5 }}>
        <CheckpointSheet
          title={copy.title}
          body={copy.body}
          continueLabel={copy.continueLabel}
          onContinue={() => router.replace(nextRoute(done))}
          onDefer={finishLater}
        />
      </View>
    </ScreenShell>
  );
}
