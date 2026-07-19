import { Stack } from 'expo-router';

// Baseline battery flow (SPEC.md sec 1): VVIQ -> digit span -> Corsi, one
// session with finish-later checkpoints between instruments. Headers off —
// mid-task back-navigation is not part of the administration.
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
