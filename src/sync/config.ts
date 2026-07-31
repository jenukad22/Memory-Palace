/**
 * Supabase configuration, read from the environment
 * (docs/superpowers/specs/2026-07-31-supabase-sync-design.md §4).
 *
 * **If either variable is absent, sync does not exist.** No settings entry, no
 * client, no network code reached. That is what makes this feature additive
 * rather than a dormant dependency the app now carries — a build without these
 * vars behaves exactly as it did before sync was added, and the tests below
 * pin that.
 *
 * `EXPO_PUBLIC_*` variables are inlined into the bundle by Expo, which is
 * correct here: the anon key is publishable by design. Row-level security on
 * the server is the actual boundary — never this key.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Reads config from the environment, or null when sync is not configured. */
export function readSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Whether the sync feature should appear in the UI at all. */
export function isSyncConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readSupabaseConfig(env) !== null;
}
