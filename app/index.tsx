import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// Dashboard placeholder. Will show per-task progress (span length, accuracy on
// that task) once DESIGN.md lands — never a general-ability figure.
export default function Dashboard() {
  return (
    <View>
      <Text>Dashboard (placeholder)</Text>
      <Link href="/onboarding">
        <Text>Start baseline assessment</Text>
      </Link>
      <Link href="/modules">
        <Text>Training modules</Text>
      </Link>
    </View>
  );
}
