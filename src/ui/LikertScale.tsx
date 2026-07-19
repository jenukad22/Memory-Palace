import { Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { color, radius, space } from './tokens';

export interface LikertOption {
  value: number;
  label: string;
}

export interface LikertScaleProps {
  /** Anchor content is screen-owned (DESIGN.md sec 3); the kit renders it. */
  options: LikertOption[];
  value: number | null;
  onSelect: (value: number) => void;
}

/**
 * Pick A3 (DESIGN.md sec 2.5): stacked full-width rows, every point labelled.
 * Selection only reports onSelect; the screen owns the auto-advance timer.
 */
export function LikertScale({ options, value, onSelect }: LikertScaleProps) {
  return (
    <View style={{ gap: space.sp2 }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const row = (pressed: boolean): ViewStyle => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sp3,
          minHeight: 48,
          borderRadius: radius.sm,
          paddingVertical: space.sp3,
          paddingHorizontal: space.sp4 - 2,
          borderWidth: 1,
          borderColor: selected ? color.accent : color.line,
          backgroundColor: selected ? color.accentTint : pressed ? color.surface2 : color.surface1,
        });
        const circle: ViewStyle = {
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: selected ? color.accent : color.lineStrong,
          backgroundColor: selected ? color.accent : 'transparent',
        };
        const anchor: TextStyle = { lineHeight: 18, flexShrink: 1 };
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onSelect(opt.value)}
            style={({ pressed }) => row(pressed)}
          >
            <View style={circle}>
              <AppText
                variant="caption"
                color={selected ? 'ink' : 'textSecondary'}
                style={{ fontWeight: '600', letterSpacing: 0 }}
              >
                {opt.value}
              </AppText>
            </View>
            <AppText
              variant="secondary"
              color={selected ? 'textPrimary' : 'textSecondary'}
              style={anchor}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
