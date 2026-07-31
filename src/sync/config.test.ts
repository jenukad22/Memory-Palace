import { describe, expect, it } from 'vitest';
import { isSyncConfigured, readSupabaseConfig } from './config';

const full = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('readSupabaseConfig', () => {
  it('returns the config when both variables are present', () => {
    expect(readSupabaseConfig(full)).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('returns null when either variable is missing — sync is then simply absent', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(
      readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: full.EXPO_PUBLIC_SUPABASE_URL }),
    ).toBeNull();
    expect(
      readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_ANON_KEY: full.EXPO_PUBLIC_SUPABASE_ANON_KEY }),
    ).toBeNull();
  });

  it('treats blank or whitespace-only values as unset', () => {
    expect(readSupabaseConfig({ ...full, EXPO_PUBLIC_SUPABASE_URL: '' })).toBeNull();
    expect(readSupabaseConfig({ ...full, EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' })).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(readSupabaseConfig({ ...full, EXPO_PUBLIC_SUPABASE_URL: '  https://x.co  ' })?.url).toBe(
      'https://x.co',
    );
  });
});

describe('isSyncConfigured', () => {
  it('gates the entire feature on the environment', () => {
    expect(isSyncConfigured(full)).toBe(true);
    expect(isSyncConfigured({})).toBe(false);
  });
});
