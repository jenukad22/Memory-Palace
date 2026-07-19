import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// One entry per cognitive domain (/src/modules). attention and reasoning are
// later phases; routes exist so the IA is reviewable.
export default function ModulesIndex() {
  return (
    <View>
      <Text>Training modules (placeholder)</Text>
      <Link href="/modules/memory">
        <Text>Memory</Text>
      </Link>
      <Link href="/modules/attention">
        <Text>Attention</Text>
      </Link>
      <Link href="/modules/reasoning">
        <Text>Reasoning</Text>
      </Link>
    </View>
  );
}
