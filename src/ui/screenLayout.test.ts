import { describe, expect, it } from 'vitest';
import { shellLayout, type EdgeInsets } from './screenLayout';
import { space } from './tokens';

const NONE: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
/** Pixel 8-class portrait insets: status bar on top, gesture bar at the bottom. */
const ANDROID_PORTRAIT: EdgeInsets = { top: 24, right: 0, bottom: 48, left: 0 };
/** Notched phone in landscape — the cutout is on one side. */
const IOS_LANDSCAPE: EdgeInsets = { top: 0, right: 59, bottom: 21, left: 59 };

describe('shellLayout — safe area', () => {
  it('reserves the status bar when the screen draws its own chrome', () => {
    const { ground } = shellLayout({ insets: ANDROID_PORTRAIT });
    expect(ground.paddingTop).toBe(24);
  });

  it('does not reserve the status bar twice under a native header', () => {
    // The native header already sits below the status bar; adding the inset
    // again would open a status-bar-sized gap under the header.
    const { ground } = shellLayout({ insets: ANDROID_PORTRAIT, headerHeight: 56 });
    expect(ground.paddingTop).toBe(0);
  });

  it('keeps the bottom of the content clear of the gesture bar', () => {
    // Scrolled to the end, the last control has to be above the gesture bar
    // with a gap — not flush against it and not under it.
    const scrolling = shellLayout({ insets: ANDROID_PORTRAIT, scroll: true });
    expect(scrolling.body.paddingBottom).toBe(48 + space.sp4);

    // A measured surface only needs to clear the bar; every extra pixel of
    // padding is a pixel the board loses.
    const fixed = shellLayout({ insets: ANDROID_PORTRAIT, scroll: false });
    expect(fixed.body.paddingBottom).toBe(48);
  });

  it('pushes content past a landscape cutout without losing the gutter', () => {
    const { ground } = shellLayout({ insets: IOS_LANDSCAPE });
    expect(ground.paddingLeft).toBe(space.sp4 + 59);
    expect(ground.paddingRight).toBe(space.sp4 + 59);
  });

  it('falls back to the plain gutter with no insets at all (web, old Android)', () => {
    const { ground, body } = shellLayout({ insets: NONE });
    expect(ground).toEqual({
      paddingTop: 0,
      paddingLeft: space.sp4,
      paddingRight: space.sp4,
    });
    expect(body.paddingBottom).toBe(space.sp4);
  });

  it('ignores negative or non-finite insets rather than shrinking the gutter', () => {
    const { ground, body } = shellLayout({
      insets: { top: -10, right: Number.NaN, bottom: Number.NaN, left: -1 },
    });
    expect(ground.paddingTop).toBe(0);
    expect(ground.paddingLeft).toBe(space.sp4);
    expect(ground.paddingRight).toBe(space.sp4);
    expect(body.paddingBottom).toBe(space.sp4);
  });

  it('treats a zero-height header as no header', () => {
    // expo-router reports 0 rather than undefined when headerShown is false.
    const { ground } = shellLayout({ insets: ANDROID_PORTRAIT, headerHeight: 0 });
    expect(ground.paddingTop).toBe(24);
  });
});

describe('shellLayout — defaults', () => {
  it('scrolls by default, so a new screen cannot ship unreachable controls', () => {
    // The default is the whole point: forgetting the prop must give you the
    // safe behaviour, not the device-only bug.
    const implicit = shellLayout({ insets: ANDROID_PORTRAIT });
    const explicit = shellLayout({ insets: ANDROID_PORTRAIT, scroll: true });
    expect(implicit).toEqual(explicit);
  });

  it('gives the body the sp3 gap under the chrome header (DESIGN.md sec 2.10)', () => {
    expect(shellLayout({ insets: NONE }).body.paddingTop).toBe(space.sp3);
    expect(shellLayout({ insets: NONE, scroll: false }).body.paddingTop).toBe(space.sp3);
  });
});
