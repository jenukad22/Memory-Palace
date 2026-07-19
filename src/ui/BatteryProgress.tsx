import { View } from 'react-native';
import { color, radius, space } from './tokens';

export interface BatteryProgressProps {
  /**
   * Fill per task segment (VVIQ, digit span, Corsi), each 0..1. Forward /
   * backward passes half-fill their segment — the battery reads as 3 tasks,
   * not 5 steps (DESIGN.md sec 2.8). No percentages or scores in chrome, ever.
   */
  fills: readonly [number, number, number];
}

export function BatteryProgress({ fills }: BatteryProgressProps) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sp2 - 2 }}>
      {fills.map((fill, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: radius.full, // the system's only pill
            backgroundColor: color.surface2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.min(Math.max(fill, 0), 1) * 100}%`,
              height: '100%',
              backgroundColor: color.accent,
            }}
          />
        </View>
      ))}
    </View>
  );
}
