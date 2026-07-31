/**
 * Auth wrapper (design doc §4). Thin on purpose: sign in, sign out, observe the
 * session. Everything else about sync is indifferent to how the user got a
 * user id.
 *
 * Every function tolerates an unconfigured build — `getSupabaseClient()`
 * returns null and these degrade to a clear "sync isn't set up" result rather
 * than throwing, because the app must run identically without Supabase.
 */

import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export interface AuthResult {
  ok: boolean;
  /** Present when ok is false — shown verbatim, so it must read plainly. */
  error?: string;
}

const NOT_CONFIGURED = 'Sync is not set up in this build.';

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await client.auth.signUp({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Signs out. Local data is deliberately left untouched — this is a local-first
 * app, and signing out of sync is not a request to delete anything. Clearing
 * the database is a separate, explicit action (§4.1).
 */
export async function signOut(): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await client.auth.signOut();
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/** Subscribe to session changes; returns an unsubscribe function. */
export function onAuthStateChange(handler: (session: Session | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}
