import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// Screen implementation blocked on DESIGN.md. Will present the 16-item
// vividness questionnaire from /src/assessment/vviq.
export default function VviqScreen() {
  return (
    <View>
      <Text>VVIQ — imagery vividness questionnaire (placeholder)</Text>
      <Link href="/onboarding/digitspan">
        <Text>Next: digit span</Text>
      </Link>
    </View>
  );
}
