import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { insertAssessment } from './assessments';
import { getVviqStrategy } from './vviq';

describe('getVviqStrategy', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('returns null when no VVIQ assessment exists', () => {
    expect(getVviqStrategy(db)).toBeNull();
  });

  it('is not fooled by other instruments', () => {
    insertAssessment(db, {
      instrument: 'digitspan_forward',
      rawScore: 6,
      ts: new Date('2026-07-19Z'),
    });
    expect(getVviqStrategy(db)).toBeNull();
  });

  it('routes non-visual at the threshold (<= 32)', () => {
    insertAssessment(db, { instrument: 'vviq', rawScore: 32, ts: new Date('2026-07-19Z') });
    expect(getVviqStrategy(db)).toBe('non-visual');
  });

  it('routes visual just above the threshold (33)', () => {
    insertAssessment(db, { instrument: 'vviq', rawScore: 33, ts: new Date('2026-07-19Z') });
    expect(getVviqStrategy(db)).toBe('visual');
  });

  it('a retake supersedes the prior result without any stored/updated flag', () => {
    insertAssessment(db, { instrument: 'vviq', rawScore: 20, ts: new Date('2026-07-01Z') });
    expect(getVviqStrategy(db)).toBe('non-visual');
    insertAssessment(db, { instrument: 'vviq', rawScore: 60, ts: new Date('2026-07-19Z') });
    expect(getVviqStrategy(db)).toBe('visual');
  });
});
