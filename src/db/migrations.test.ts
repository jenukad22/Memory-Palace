import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrations.generated';

describe('migration bundle', () => {
  const allSql = MIGRATIONS.flatMap((m) => m.statements).join('\n');

  it('has the initial schema, triggers, payload-column, palace, and ability-log migrations', () => {
    expect(MIGRATIONS.length).toBe(6);
    expect(MIGRATIONS.at(-1)?.tag).toBe('0005_ability_log_append_only');
  });

  it('adds the assessments.payload column', () => {
    expect(allSql).toContain('ALTER TABLE `assessments` ADD `payload` text');
  });

  it('creates all nine tables', () => {
    for (const table of [
      'cards',
      'fsrs_state',
      'review_log',
      'assessments',
      'ability_ratings',
      'ability_log',
      'sessions',
      'palaces',
      'loci',
    ]) {
      expect(allSql).toContain(`CREATE TABLE \`${table}\``);
    }
  });

  it('enforces locus ordering with a composite unique index', () => {
    expect(allSql).toContain('CREATE UNIQUE INDEX `loci_palace_position_unq`');
  });

  it('creates the append-only triggers', () => {
    expect(allSql).toContain('CREATE TRIGGER review_log_no_update');
    expect(allSql).toContain('CREATE TRIGGER review_log_no_delete');
    expect(allSql).toContain('CREATE TRIGGER ability_log_no_update');
    expect(allSql).toContain('CREATE TRIGGER ability_log_no_delete');
  });
});
