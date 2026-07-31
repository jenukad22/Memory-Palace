import { View } from 'react-native';
import { AppText } from './AppText';
import { color, radius, space } from './tokens';

/** Shared "not yet available" tag — modules hub and the progress dashboard both need it. */
export function ComingSoonTag() {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: color.surface2,
        borderRadius: radius.sm,
        paddingHorizontal: space.sp2,
        paddingVertical: space.sp1,
      }}
    >
      <AppText variant="overline" color="textMuted">
        Not yet available
      </AppText>
    </View>
  );
}
