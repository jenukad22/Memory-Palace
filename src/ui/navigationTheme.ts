/**
 * Default screen options for expo-router's native stacks, built from the tokens
 * (DESIGN.md sec 1.1/1.2) so the navigator chrome reads as part of the app
 * rather than the platform's white default.
 *
 * This is styling only: it declares no routes and performs no navigation, so
 * DESIGN.md sec 3 ("navigation — expo-router owns it") still holds. Layouts
 * apply it once at the navigator level; screens never restyle their own header.
 */

import type { NativeStackNavigationOptions } from 'expo-router';
import { color, typeScale } from './tokens';

export const stackScreenOptions = {
  headerStyle: { backgroundColor: color.bg0 },
  // Tints the back arrow. It is the only interactive element in the header, so
  // it takes the accent; the title is plain text and stays textPrimary.
  headerTintColor: color.accent,
  headerTitleStyle: {
    color: color.textPrimary,
    fontSize: typeScale.heading.fontSize,
    fontWeight: typeScale.heading.fontWeight,
  },
  headerTitleAlign: 'left',
  // Elevation is surface steps and hairlines, never shadow (DESIGN.md
  // prohibition 1) — this drops Android's header elevation and iOS's border.
  headerShadowVisible: false,
  // Back arrow only, no "‹ Modules" label trailing off the arrow.
  headerBackButtonDisplayMode: 'minimal',
  // The ground behind a screen during the push/pop transition, before the
  // screen's own ScreenShell paints. Without it, transitions flash white.
  contentStyle: { backgroundColor: color.bg0 },
} satisfies NativeStackNavigationOptions;

/**
 * A readable header title for a route expo-router named after its file.
 *
 * The fallback matters as much as the explicit titles: a route that nobody
 * remembered to name should read "Palace builder", never "palace-builder" and
 * never "index". Segments are used from the right, skipping `index`, so
 * `memory/index` becomes "Memory" and `attention/pvt` becomes "Pvt" (which the
 * navigator's own title map then overrides with "PVT-B").
 */
export function humanizeRouteName(routeName: string): string {
  const segments = routeName
    .split('/')
    .map((s) => s.replace(/^\[\.{0,3}/, '').replace(/\]$/, '')) // [id], [...rest]
    .filter((s) => s.length > 0 && s !== 'index');
  const words = (segments[segments.length - 1] ?? '').replace(/[-_]+/g, ' ').trim();
  if (words.length === 0) return 'Home';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The tokenized defaults plus a per-route title, for a navigator's
 * `screenOptions`. Titles are supplied as a map keyed by expo-router's route
 * name (the path relative to the layout, e.g. `attention/pvt`); anything not
 * in the map falls back to `humanizeRouteName`, so an unlisted route still
 * gets a real title instead of its filename.
 */
export function stackScreenOptionsWithTitles(titles: Readonly<Record<string, string>>) {
  return ({ route }: { route: { name: string } }) => ({
    ...stackScreenOptions,
    title: titles[route.name] ?? humanizeRouteName(route.name),
  });
}
