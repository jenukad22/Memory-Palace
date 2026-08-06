import { useContext, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Layout only: the measured header height tells the shell whether the status
// bar has already been cleared for it. The shell reads it and never navigates,
// so DESIGN.md sec 3 ("navigation — expo-router owns it") still holds.
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { AppText } from './AppText';
import { BatteryProgress, type BatteryProgressProps } from './BatteryProgress';
import { shellLayout } from './screenLayout';
import { color, space } from './tokens';

export interface ScreenShellProps {
  /** Kicker, e.g. "Baseline · 2 of 3". Omit for chrome-less screens. */
  kicker?: string;
  /** Right-aligned task name, e.g. "Digit span". */
  taskName?: string;
  /** Battery progress; omit to hide the track. */
  fills?: BatteryProgressProps['fills'];
  /**
   * Scroll the body when it overflows the viewport. Defaults to true, and
   * should stay true for anything that reads as a page.
   *
   * Pass false only for a surface that measures itself against the box it is
   * given — the Corsi board, the flicker grid, a response pad. A scroll
   * container hands its children unbounded height, so those surfaces would
   * size themselves off the viewport and grow past it. Every `scroll={false}`
   * call site is registered, with its reason, in screenScrollAudit.test.ts.
   */
  scroll?: boolean;
  children: ReactNode;
}

/**
 * DESIGN.md sec 2.10 — safe-area ground + the shared chrome header.
 *
 * The chrome header stays pinned; only the body scrolls, so the kicker and the
 * battery track remain visible while a long screen is scrolled. Layout maths
 * (which insets to reserve, and what the body's padding works out to) lives in
 * the framework-free screenLayout.ts so it can be tested without rendering.
 */
export function ScreenShell({
  kicker,
  taskName,
  fills,
  scroll = true,
  children,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const layout = shellLayout({ insets, headerHeight, scroll });

  return (
    <View style={{ flex: 1, backgroundColor: color.bg0, ...layout.ground }}>
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
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          // flexGrow (not flex) so a short screen lays out exactly as a plain
          // flex column — children with flex:1 still stretch — and a tall one
          // grows past the viewport and scrolls instead of being cut off.
          contentContainerStyle={{ flexGrow: 1, ...layout.body }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, ...layout.body }}>{children}</View>
      )}
    </View>
  );
}
