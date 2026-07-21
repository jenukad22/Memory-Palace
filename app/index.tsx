import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { doneSet, nextRoute } from '@/assessment/battery';
import { getAbility, listAssessments, listDueCards, useDb, type AssessmentRow } from '@/db';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

// Dashboard. Everything shown is task- or module-specific output — a span, a
// rating for one module — never anything broader (CLAUDE.md).
export default function Dashboard() {
  const db = useDb();
  const router = useRouter();
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [memoryElo, setMemoryElo] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRows(listAssessments(db));
      setMemoryElo(getAbility(db, 'memory')?.elo ?? null);
      setDueCount(listDueCards(db).length);
    }, [db]),
  );

  const done = doneSet(rows);
  const batteryComplete = nextRoute(done) === '/onboarding/complete';

  return (
    <ScreenShell>
      <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
        <AppText variant="title">Memory Palace</AppText>

        {memoryElo !== null ? (
          <Card>
            <AppText variant="overline" color="textSecondary">
              Memory module
            </AppText>
            <AppText variant="heading" tabular style={{ marginTop: space.sp1 }}>
              Rating {Math.round(memoryElo)}
            </AppText>
          </Card>
        ) : null}

        {batteryComplete ? (
          <Button
            kind="secondary"
            label="Baseline results"
            onPress={() => router.push('/onboarding/complete')}
          />
        ) : (
          <Button
            label={done.size > 0 ? 'Resume baseline assessment' : 'Start baseline assessment'}
            onPress={() => router.push('/onboarding')}
          />
        )}

        <Button kind="secondary" label="Training modules" onPress={() => router.push('/modules')} />

        <Button
          kind="secondary"
          label={dueCount > 0 ? `Daily review · ${dueCount} due` : 'Daily review'}
          onPress={() => router.push('/review')}
        />

        {__DEV__ ? (
          <Button kind="ghost" label="Developer tools" onPress={() => router.push('/dev')} />
        ) : null}
      </View>
    </ScreenShell>
  );
}
