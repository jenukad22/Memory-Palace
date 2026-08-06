import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DbProvider } from '@/db';
import { stackScreenOptions } from '@/ui';

// Root navigator inside the db gate: screens render once migrations have run.
//
// SafeAreaProvider wraps everything because Android draws edge-to-edge — the
// status bar and gesture bar sit over the app — and ScreenShell reserves those
// insets from the values this publishes.
//
// Native headers stay off at this level: ScreenShell owns the chrome on the
// dashboard and its siblings (DESIGN.md sec 2.10). The tokenized defaults are
// still applied so any screen that does turn its header on inherits them
// rather than the platform's white default.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <DbProvider>
        <Stack screenOptions={{ ...stackScreenOptions, headerShown: false }} />
      </DbProvider>
    </SafeAreaProvider>
  );
}
