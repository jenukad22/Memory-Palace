import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrations.generated';

describe('migration bundle', () => {
  const allSql = MIGRATIONS.flatMap((m) => m.statements).join('\n');

  it('has the initial schema, triggers, and payload-column migrations', () => {
    expect(MIGRATIONS.length).toBe(3);
    expect(MIGRATIONS.at(-1)?.tag).toBe('0002_robust_arclight');
  });

  it('adds the assessments.payload column', () => {
    expect(allSql).toContain('ALTER TABLE `assessments` ADD `payload` text');
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
