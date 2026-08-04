/**
 * Whether developer tools (the `/dev` route, the DB self-test button) should
 * be reachable in this build.
 *
 * True in Expo's own dev client (`__DEV__`), or when a build was explicitly
 * given `EXPO_PUBLIC_ENABLE_DEV_TOOLS=1` — the mechanism that lets an EAS
 * "preview" build (an installable APK, `__DEV__` false) still carry the
 * self-test button. That button is the only way to exercise the real
 * expo-sqlite native driver before a store build; see the verification
 * checklist in src/db/README.md.
 *
 * `__DEV__` is injected by the RN bundler and isn't defined under plain
 * Node/Vitest, so it's a parameter here rather than read directly — the same
 * shape `readSupabaseConfig` uses for `env`, and it's what keeps this
 * function callable (and testable) outside a bundled app.
 */
export function isDevToolsEnabled(
  isDevBuild: boolean,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isDevBuild || env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === '1';
}
