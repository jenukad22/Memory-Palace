import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button, Card, ScreenShell, space } from '@/ui';

// Memory training hub. Links to the two builders and their drills; the dynamic
// [module] route still serves attention/reasoning placeholders.
export default function MemoryHub() {
  const router = useRouter();
  return (
    <ScreenShell kicker="Training" taskName="Memory">
      <View style={{ gap: space.sp4, paddingTop: space.sp4 }}>
        <AppText variant="heading">Memory</AppText>
        <Card>
          <AppText variant="bodyStrong">Memory Palace</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingVertical: space.sp2 }}>
            Build a route of loci, place items along it, then recall each from memory.
          </AppText>
          <Button
            label="Open builder"
            onPress={() => router.push('/modules/memory/palace-builder')}
          />
        </Card>
        <Card>
          <AppText variant="bodyStrong">PAO</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingVertical: space.sp2 }}>
            Author your 00–99 Person/Action/Object list, then drill 6-digit numbers as scenes.
          </AppText>
          <View style={{ gap: space.sp2 }}>
            <Button
              label="Open builder"
              onPress={() => router.push('/modules/memory/pao-builder')}
            />
            <Button
              kind="secondary"
              label="Start drill"
              onPress={() => router.push('/modules/memory/pao-drill')}
            />
          </View>
        </Card>
        <Card>
          <AppText variant="bodyStrong">6-week campaign</AppText>
          <AppText variant="secondary" color="textSecondary" style={{ paddingVertical: space.sp2 }}>
            A guided method-of-loci program: a 72-word recall test, six weeks of daily route
            practice, then the same test again to see your own before/after change.
          </AppText>
          <Button label="Open campaign" onPress={() => router.push('/campaign')} />
        </Card>
      </View>
    </ScreenShell>
  );
}
