import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { BatteryProgress, type BatteryProgressProps } from './BatteryProgress';
import { color, space } from './tokens';

export interface ScreenShellProps {
  /** Kicker, e.g. "Baseline · 2 of 3". Omit for chrome-less screens. */
  kicker?: string;
  /** Right-aligned task name, e.g. "Digit span". */
  taskName?: string;
  /** Battery progress; omit to hide the track. */
  fills?: BatteryProgressProps['fills'];
  children: ReactNode;
}

/** DESIGN.md sec 2.10 — safe-area ground + the shared chrome header. */
export function ScreenShell({ kicker, taskName, fills, children }: ScreenShellProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg0 }}>
      <View style={{ flex: 1, paddingHorizontal: space.sp4 }}>
        {kicker !== undefined || taskName !== undefined ? (
          <View style={{ gap: space.sp2 + 2, paddingTop: space.sp3 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              {kicker !== undefined ? (
                <AppText variant="overline" color="textSecondary">
                  {kicker}
                </AppText>
              ) : (
                <View />
              )}
              {taskName !== undefined ? (
                <AppText variant="caption" color="textSecondary">
                  {taskName}
                </AppText>
              ) : null}
            </View>
            {fills ? <BatteryProgress fills={fills} /> : null}
          </View>
        ) : null}
        <View style={{ flex: 1, paddingTop: space.sp3 }}>{children}</View>
      </View>
    </SafeAreaView>
  );
}
