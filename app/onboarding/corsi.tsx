import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// Screen implementation blocked on DESIGN.md. Will run forward then backward
// Corsi block-tapping from /src/assessment/corsi.
export default function CorsiScreen() {
  return (
    <View>
      <Text>Corsi block-tapping — forward and backward (placeholder)</Text>
      <Link href="/">
        <Text>Finish baseline, back to dashboard</Text>
      </Link>
    </View>
  );
}
