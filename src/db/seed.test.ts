import { beforeEach, describe, expect, it } from 'vitest';
import { listCardsByModule } from './queries/cards';
import { seedDemoCards } from './seed';
import { runDbSelfTest } from './selftest';
import { createTestDb } from './testing';
import type { Db } from './types';

describe('seed + self-test', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('seeds demo cards and is idempotent', () => {
    expect(seedDemoCards(db)).toBe(5);
    expect(seedDemoCards(db)).toBe(0); // re-seed inserts nothing
    expect(listCardsByModule(db, 'memory').length).toBe(5);
  });

  it('self-test passes on a fresh db', () => {
    const result = runDbSelfTest(db);
    expect(result.ok).toBe(true);
    expect(result.steps.every((s) => s.ok)).toBe(true);
  });
});
