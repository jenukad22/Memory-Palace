export { isSyncConfigured, readSupabaseConfig, type SupabaseConfig } from './config';
export {
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type AuthResult,
} from './auth';
export { getSupabaseClient, resetSupabaseClient } from './supabaseClient';
export { createSupabaseTransport } from './supabaseTransport';
export { getLastSyncedAt, runSync, type RunSyncOptions, type SyncOutcome } from './runSync';
export { DifferentUserError, type PullResult, type SyncTransport } from './transport';
