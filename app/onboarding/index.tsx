import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function OnboardingIndex() {
  return (
    <View>
      <Text>Baseline assessment (placeholder)</Text>
      <Text>Order: VVIQ, then digit span, then Corsi block-tapping.</Text>
      <Link href="/onboarding/vviq">
        <Text>Begin: VVIQ</Text>
      </Link>
    </View>
  );
}
