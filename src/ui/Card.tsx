import { View, type ViewProps } from 'react-native';
import { color, radius, space } from './tokens';

/** DESIGN.md sec 2.3 — surface1 + hairline, r-md, no shadow, non-interactive. */
export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: color.surface1,
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: radius.md,
          padding: space.sp4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
