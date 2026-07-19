import { Stack } from 'expo-router';
import { DbProvider } from '@/db';

// Root navigator inside the db gate: screens render once migrations have run.
// Native headers stay off — ScreenShell owns the chrome (DESIGN.md sec 2.10).
export default function RootLayout() {
  return (
    <DbProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DbProvider>
  );
}
