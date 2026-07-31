import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button, ScreenShell, space } from '@/ui';

// Fallback for domains without their own screens yet (attention, reasoning).
// The modules hub doesn't link here, but a direct URL should still land on a
// styled "not yet available" screen, never raw placeholder text.
const TITLES: Record<string, string> = {
  attention: 'Attention',
  reasoning: 'Reasoning',
};

export default function ModuleDetail() {
  const { module } = useLocalSearchParams<{ module: string }>();
  const router = useRouter();
  const title = TITLES[module ?? ''] ?? 'Module';

  return (
    <ScreenShell kicker="Training" taskName={title}>
      <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="secondary" color="textSecondary">
          This module isn’t available yet — it arrives in a later phase. Memory training is ready to
          use now.
        </AppText>
        <View style={{ paddingTop: space.sp3, gap: space.sp2 }}>
          <Button label="Open Memory" onPress={() => router.replace('/modules/memory')} />
          <Button kind="secondary" label="All modules" onPress={() => router.replace('/modules')} />
        </View>
      </View>
    </ScreenShell>
  );
}
