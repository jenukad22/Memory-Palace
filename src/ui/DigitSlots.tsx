import { View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { color, radius, space } from './tokens';

export interface DigitSlotsProps {
  /** Expected sequence length — one cell per digit. */
  length: number;
  /** Digits entered so far, e.g. "729". */
  entered: string;
}

/**
 * Pick B3, slots half (DESIGN.md sec 2.6). The current cell (first empty)
 * carries the accent border; empty cells show a muted middot.
 */
export function DigitSlots({ length, entered }: DigitSlotsProps) {
  const cells = Array.from({ length }, (_, i) => entered[i] ?? null);
  const currentIndex = entered.length < length ? entered.length : -1;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sp2 }}>
      {cells.map((digit, i) => {
        const cell: ViewStyle = {
          width: 32,
          height: 44,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: i === currentIndex ? color.accent : color.lineStrong,
          backgroundColor: color.surface1,
          alignItems: 'center',
          justifyContent: 'center',
        };
        return (
          <View key={i} style={cell}>
            <AppText variant="digitKey" color={digit === null ? 'textMuted' : 'textPrimary'}>
              {digit ?? '·'}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
