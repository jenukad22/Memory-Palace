import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function ModuleDetail() {
  const { module } = useLocalSearchParams<{ module: string }>();
  return (
    <View>
      <Text>Module: {module} (placeholder)</Text>
      <Text>Training sessions for this module arrive in a later phase.</Text>
    </View>
  );
}
