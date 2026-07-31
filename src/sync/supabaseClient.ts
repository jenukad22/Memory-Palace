/**
 * Supabase client construction (design doc §4). Returns null when sync is not
 * configured, so every caller has to handle "this feature does not exist" —
 * which is the shape that keeps the app local-first by default.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { readSupabaseConfig, type SupabaseConfig } from './config';

/**
 * Where the auth session (including the refresh token) is persisted.
 *
 * Native uses expo-secure-store — the OS keychain — rather than the app's own
 * SQLite database. The local database already holds the user's training data,
 * but a long-lived refresh token is a credential, and credentials belong behind
 * the platform's secure storage rather than in a file the rest of the app reads
 * and writes freely.
 *
 * Web falls back to localStorage, which is what supabase-js uses by default
 * there; there is no keychain equivalent in a browser.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let cached: SupabaseClient | null = null;

/** The shared client, or null when the env vars are absent. */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== null) return cached;
  const config: SupabaseConfig | null = readSupabaseConfig();
  if (config === null) return null;
  cached = createClient(config.url, config.anonKey, {
    auth: {
      // Native has no URL to parse a session out of; web does.
      detectSessionInUrl: Platform.OS === 'web',
      persistSession: true,
      autoRefreshToken: true,
      ...(Platform.OS === 'web' ? {} : { storage: secureStorage }),
    },
  });
  return cached;
}

/** Test seam — drops the memoized client so config changes take effect. */
export function resetSupabaseClient(): void {
  cached = null;
}
