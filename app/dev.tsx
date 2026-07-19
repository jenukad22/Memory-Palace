import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { runDbSelfTest, useDb, type SelfTestResult } from '@/db';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

// Developer tools. Hosts the DB self-test button that makes the
// src/db/README.md iOS checklist runnable on a device/simulator.
export default function DevRoute() {
  const db = useDb();
  const router = useRouter();
  const [result, setResult] = useState<SelfTestResult | null>(null);

  return (
    <ScreenShell>
      <View style={{ gap: space.sp4, paddingTop: space.sp5 }}>
        <AppText variant="title">Developer</AppText>
        <Button label="Run DB self-test" onPress={() => setResult(runDbSelfTest(db))} />
        {result !== null ? (
          <Card>
            <AppText variant="overline" color="textSecondary">
              {result.ok ? 'Self-test passed' : 'Self-test FAILED'}
            </AppText>
            <View style={{ marginTop: space.sp2, gap: space.sp1 }}>
              {result.steps.map((s) => (
                <AppText key={s.name} variant="secondary" color={s.ok ? 'success' : 'error'}>
                  {s.ok ? '✓' : '✗'} {s.name}
                </AppText>
              ))}
            </View>
          </Card>
        ) : null}
        <Button kind="ghost" label="Back" onPress={() => router.back()} />
      </View>
    </ScreenShell>
  );
}
