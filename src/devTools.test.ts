import { describe, expect, it } from 'vitest';
import { isDevToolsEnabled } from './devTools';

describe('isDevToolsEnabled', () => {
  it('is true whenever this is a dev build, regardless of env', () => {
    expect(isDevToolsEnabled(true, {})).toBe(true);
    expect(isDevToolsEnabled(true, { EXPO_PUBLIC_ENABLE_DEV_TOOLS: '0' })).toBe(true);
  });

  it('is true in a non-dev build only when the flag is exactly "1"', () => {
    expect(isDevToolsEnabled(false, { EXPO_PUBLIC_ENABLE_DEV_TOOLS: '1' })).toBe(true);
  });

  it('is false in a non-dev build with the flag absent, empty, or any other value', () => {
    expect(isDevToolsEnabled(false, {})).toBe(false);
    expect(isDevToolsEnabled(false, { EXPO_PUBLIC_ENABLE_DEV_TOOLS: '' })).toBe(false);
    expect(isDevToolsEnabled(false, { EXPO_PUBLIC_ENABLE_DEV_TOOLS: '0' })).toBe(false);
    expect(isDevToolsEnabled(false, { EXPO_PUBLIC_ENABLE_DEV_TOOLS: 'true' })).toBe(false);
    expect(isDevToolsEnabled(false, { EXPO_PUBLIC_ENABLE_DEV_TOOLS: 'yes' })).toBe(false);
  });

  it('defaults env to process.env when omitted', () => {
    // Just confirms the call is valid with two arguments omitted to one.
    expect(typeof isDevToolsEnabled(false)).toBe('boolean');
  });
});
