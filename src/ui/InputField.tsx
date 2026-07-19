import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { color, hit, radius, space, typeScale } from './tokens';

export interface InputFieldProps extends Omit<TextInputProps, 'editable'> {
  /** Error message — states the fix, no apology (DESIGN.md sec 2.4). */
  error?: string;
  disabled?: boolean;
}

export function InputField({ error, disabled, style, ...rest }: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.error : focused ? color.accent : color.lineStrong;

  return (
    <View>
      <TextInput
        {...rest}
        editable={!disabled}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor={color.textMuted}
        style={[
          {
            height: hit.controlHeight,
            backgroundColor: disabled ? color.surface2 : color.surface1,
            borderWidth: 1,
            borderColor,
            borderRadius: radius.sm,
            paddingHorizontal: space.sp4 - 2,
            fontSize: typeScale.body.fontSize,
            color: disabled ? color.textMuted : color.textPrimary,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" color="error" style={{ marginTop: space.sp2 - 2 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
