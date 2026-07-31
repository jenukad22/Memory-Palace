import { View } from 'react-native';
import { AppText } from './AppText';
import { color, radius, space } from './tokens';

export interface StreakStripProps {
  /** From engine's activityWindow — oldest to today, already shaped. */
  days: boolean[];
  streakCount: number;
  /** 0..1 fraction, as returned by engine's consistency(). */
  consistencyPct: number;
}

/**
 * Purely presentational — all shaping (window, streak count, consistency
 * fraction) is done by src/engine/streak.ts. radius.sm cells, not radius.full
 * (DESIGN.md reserves that for BatteryProgress only).
 */
export function StreakStrip({ days, streakCount, consistencyPct }: StreakStripProps) {
  return (
    <View style={{ gap: space.sp3 }}>
      <View style={{ flexDirection: 'row', gap: space.sp5 }}>
        <View>
          <AppText variant="heading" tabular>
            {streakCount}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            day streak
          </AppText>
        </View>
        <View>
          <AppText variant="heading" tabular>
            {Math.round(consistencyPct * 100)}%
          </AppText>
          <AppText variant="caption" color="textSecondary">
            consistency
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {days.map((active, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 20,
              borderRadius: radius.sm,
              backgroundColor: active ? color.accent : color.surface2,
            }}
          />
        ))}
      </View>
    </View>
  );
}
