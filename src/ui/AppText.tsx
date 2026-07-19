import { Text, type TextProps, type TextStyle } from 'react-native';
import { color, typeScale, type ColorToken, type TypeVariant } from './tokens';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: ColorToken;
  /** Force tabular figures on variants that don't set them (DESIGN.md sec 2.1). */
  tabular?: boolean;
}

export function AppText({
  variant = 'body',
  color: colorToken = 'textPrimary',
  tabular,
  style,
  children,
  ...rest
}: AppTextProps) {
  const t = typeScale[variant];
  const s: TextStyle = {
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: t.fontWeight,
    color: color[colorToken],
  };
  if ('letterSpacing' in t) s.letterSpacing = t.letterSpacing;
  if ('uppercase' in t && t.uppercase) s.textTransform = 'uppercase';
  if (tabular ?? ('tabular' in t && t.tabular)) s.fontVariant = ['tabular-nums'];
  return (
    <Text {...rest} style={[s, style]}>
      {children}
    </Text>
  );
}
