import { describe, expect, it } from 'vitest';

describe('engine test harness', () => {
  it('runs under vitest with strict TS', () => {
    expect(1 + 1).toBe(2);
  });
});
