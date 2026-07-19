import { Pressable, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { color, radius, space } from './tokens';

export interface DigitKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  /** True when all slots are filled — digit keys ignore taps. */
  digitsDisabled?: boolean;
  /** True when nothing is entered — backspace/clear ignore taps. */
  editDisabled?: boolean;
}

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['back', '0', 'clear'],
];

/**
 * Pick B3, keypad half (DESIGN.md sec 2.6): phone layout, function keys in the
 * corners. Submit is NOT here — it is a separate pinned primary Button so it
 * can't be fat-fingered mid-entry.
 */
export function DigitKeypad({
  onDigit,
  onBackspace,
  onClear,
  digitsDisabled,
  editDisabled,
}: DigitKeypadProps) {
  const key = (pressed: boolean, disabled: boolean): ViewStyle => ({
    flex: 1,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: pressed && !disabled ? color.surface2 : color.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <View style={{ gap: space.sp2 }}>
      {ROWS.map((row) => (
        <View key={row.join()} style={{ flexDirection: 'row', gap: space.sp2 }}>
          {row.map((k) => {
            const isFn = k === 'back' || k === 'clear';
            const disabled = isFn ? editDisabled === true : digitsDisabled === true;
            const act = k === 'back' ? onBackspace : k === 'clear' ? onClear : () => onDigit(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={k === 'back' ? 'backspace' : k === 'clear' ? 'clear' : k}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={act}
                style={({ pressed }) => key(pressed, disabled)}
              >
                {isFn ? (
                  <AppText
                    variant="secondary"
                    color={disabled ? 'textMuted' : 'textSecondary'}
                    style={{ fontWeight: '600' }}
                  >
                    {k === 'back' ? '⌫' : 'Clear'}
                  </AppText>
                ) : (
                  <AppText variant="digitKey" color={disabled ? 'textMuted' : 'textPrimary'}>
                    {k}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
