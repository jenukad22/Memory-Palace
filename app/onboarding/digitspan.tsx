import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// Screen implementation blocked on DESIGN.md. Will run forward then backward
// digit span from /src/assessment/digitspan.
export default function DigitSpanScreen() {
  return (
    <View>
      <Text>Digit span — forward and backward (placeholder)</Text>
      <Link href="/onboarding/corsi">
        <Text>Next: Corsi block-tapping</Text>
      </Link>
    </View>
  );
}
