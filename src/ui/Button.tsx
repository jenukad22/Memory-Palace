import { useState } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { color, hit, radius, type ColorToken } from './tokens';

export type ButtonKind = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  kind?: ButtonKind;
  size?: 'md' | 'sm';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * DESIGN.md sec 2.2. All kinds keep a constant 1px border (transparent where
 * invisible) so the focus border-swap to accent never shifts layout. Disabled
 * swaps ground/content tokens — never opacity fades.
 */
export function Button({ kind = 'primary', size = 'md', label, onPress, disabled }: ButtonProps) {
  const [focused, setFocused] = useState(false);

  const frame = (pressed: boolean): ViewStyle => {
    const base: ViewStyle = {
      height: size === 'md' ? hit.controlHeight : hit.controlHeightSm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
    };
    if (kind === 'primary') {
      base.backgroundColor = disabled
        ? color.surface2
        : pressed
          ? color.accentPressed
          : color.accent;
    } else if (kind === 'secondary') {
      base.borderColor = disabled ? color.line : color.lineStrong;
      if (pressed && !disabled) base.backgroundColor = color.surface2;
    } else {
      if (pressed && !disabled) base.backgroundColor = color.accentTint;
    }
    if (focused && !disabled) base.borderColor = color.accent;
    return base;
  };

  const labelColor: ColorToken = disabled
    ? 'textMuted'
    : kind === 'primary'
      ? 'ink'
      : kind === 'secondary'
        ? 'textPrimary'
        : 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => frame(pressed)}
    >
      <AppText variant="bodyStrong" color={labelColor}>
        {label}
      </AppText>
    </Pressable>
  );
}
