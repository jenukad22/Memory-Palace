import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/ui';

// Baseline battery flow (SPEC.md sec 1): VVIQ -> digit span -> Corsi, one
// session with finish-later checkpoints between instruments. Headers off —
// mid-task back-navigation is not part of the administration — but the
// tokenized defaults still supply the ground behind push/pop transitions.
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerShown: false, gestureEnabled: false }} />
  );
}
