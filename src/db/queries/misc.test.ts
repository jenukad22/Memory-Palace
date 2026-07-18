import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { getAbility, upsertAbility } from './ability';
import { insertAssessment, listAssessments } from './assessments';
import { endSession, listSessions, startSession } from './sessions';

describe('assessments / ability / sessions queries', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('inserts and lists assessments (newest first, optional filter)', () => {
    insertAssessment(db, {
      instrument: 'nback',
      rawScore: 0.8,
      normalized: 1.1,
      ts: new Date('2026-07-10Z'),
    });
    insertAssessment(db, { instrument: 'pvt', rawScore: 320, ts: new Date('2026-07-20Z') });
    expect(listAssessments(db).map((a) => a.instrument)).toEqual(['pvt', 'nback']);
    expect(listAssessments(db, 'nback').map((a) => a.instrument)).toEqual(['nback']);
    expect(listAssessments(db, 'pvt')[0]?.normalized).toBeNull();
  });

  it('upserts an ability rating per module', () => {
    upsertAbility(db, 'memory', 1500, new Date('2026-07-18Z'));
    expect(getAbility(db, 'memory')?.elo).toBe(1500);
    upsertAbility(db, 'memory', 1520, new Date('2026-07-19Z'));
    expect(getAbility(db, 'memory')?.elo).toBe(1520);
    expect(listAssessments(db).length).toBe(0); // no cross-table leakage
  });

  it('starts and ends a session', () => {
    const id = startSession(db, 'attention', new Date('2026-07-18T00:00:00Z'));
    expect(listSessions(db, 'attention')[0]?.ended).toBeNull();
    endSession(db, id, { items: 30, accuracy: 0.87, ended: new Date('2026-07-18T00:05:00Z') });
    const s = listSessions(db, 'attention')[0];
    expect(s?.items).toBe(30);
    expect(s?.accuracy).toBeCloseTo(0.87);
    expect(s?.ended).not.toBeNull();
  });
});
