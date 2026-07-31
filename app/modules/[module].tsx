import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText, Button, ScreenShell, space } from '@/ui';

// Fallback for any domain key without its own screens — memory, attention and
// reasoning all have static routes, which expo-router matches ahead of this
// dynamic one, so this only renders for an unrecognized URL. The modules hub
// never links here; a mistyped or stale URL should still land on a styled
// screen, never raw placeholder text.
export default function ModuleDetail() {
  const router = useRouter();

  return (
    <ScreenShell kicker="Training" taskName="Module">
      <View style={{ gap: space.sp3, paddingTop: space.sp5 }}>
        <AppText variant="heading">Module not found</AppText>
        <AppText variant="secondary" color="textSecondary">
          That training module doesn’t exist. Memory, Attention and Reasoning are all available from
          the modules list.
        </AppText>
        <View style={{ paddingTop: space.sp3 }}>
          <Button label="All modules" onPress={() => router.replace('/modules')} />
        </View>
      </View>
    </ScreenShell>
  );
}
