/**
 * ScreenShell layout math (DESIGN.md sec 2.10) — framework-free so the
 * safe-area and scroll-container geometry is unit-testable without rendering
 * (ScreenShell.tsx itself pulls in React Native and can't be imported under
 * plain Vitest/Node).
 *
 * Two device-only failure modes this exists to prevent, both found on the first
 * Android device test:
 *
 *  - The body had no scroll container, so on any screen taller than the
 *    viewport the controls below the fold were simply unreachable — on the
 *    modules hub, the Reasoning button. Web testing never saw it because a
 *    desktop window is tall enough for every screen we have.
 *  - Android draws edge-to-edge: the status bar and the gesture bar are drawn
 *    over the app, not beside it. Without reserving those insets, the chrome
 *    header sits under the clock and the last button sits under the gesture
 *    bar.
 *
 * The `flexGrow: 1` that goes with `body` on a scrolling screen is what keeps
 * short screens behaving exactly as a plain flex column would: the content
 * container is at least the viewport tall, so `flex: 1` children still stretch
 * and nothing scrolls until the content genuinely overflows.
 */

import { space } from './tokens';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ShellLayoutInput {
  /** Safe-area insets, as reported by react-native-safe-area-context. */
  insets: EdgeInsets;
  /**
   * Measured height of the navigator's native header above this screen, 0 when
   * there is none. A native header already sits below the status bar, so the
   * shell must not reserve the top inset a second time under it.
   */
  headerHeight?: number;
  /** Whether the body is a scroll container. See ScreenShell's `scroll` prop. */
  scroll?: boolean;
}

export interface ShellLayout {
  /** Padding for the app ground — the full-bleed view under the whole screen. */
  ground: { paddingTop: number; paddingLeft: number; paddingRight: number };
  /** Padding for the body, whether it is a scroll container or a plain view. */
  body: { paddingTop: number; paddingBottom: number };
}

/** Treat a missing, negative or non-finite inset as no inset at all. */
function usable(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Ground and body padding for one screen. Horizontal insets are added to the
 * standard `sp4` gutter rather than replacing it, so a landscape notch pushes
 * content in from the cutout instead of letting it touch the edge.
 */
export function shellLayout({
  insets,
  headerHeight = 0,
  scroll = true,
}: ShellLayoutInput): ShellLayout {
  const hasNativeHeader = usable(headerHeight) > 0;
  return {
    ground: {
      paddingTop: hasNativeHeader ? 0 : usable(insets.top),
      paddingLeft: space.sp4 + usable(insets.left),
      paddingRight: space.sp4 + usable(insets.right),
    },
    body: {
      paddingTop: space.sp3,
      // Scrolling content ends *at* the gesture bar, so its last row needs the
      // inset plus a resting gap. A fixed surface is sized against the box it
      // is given and only needs to clear the bar.
      paddingBottom: usable(insets.bottom) + (scroll ? space.sp4 : 0),
    },
  };
}
