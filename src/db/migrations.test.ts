import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrations.generated';

describe('migration bundle', () => {
  const allSql = MIGRATIONS.flatMap((m) => m.statements).join('\n');

  it('has the initial schema migration and the triggers migration', () => {
    expect(MIGRATIONS.length).toBe(2);
    expect(MIGRATIONS.at(-1)?.tag).toBe('0001_review_log_append_only');
  });

  it('creates all six tables', () => {
    for (const table of [
      'cards',
      'fsrs_state',
      'review_log',
      'assessments',
      'ability_ratings',
      'sessions',
    ]) {
      expect(allSql).toContain(`CREATE TABLE \`${table}\``);
    }
  });

  it('creates the append-only triggers', () => {
    expect(allSql).toContain('CREATE TRIGGER review_log_no_update');
    expect(allSql).toContain('CREATE TRIGGER review_log_no_delete');
  });
});
