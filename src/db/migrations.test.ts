import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrations.generated';

describe('migration bundle', () => {
  const allSql = MIGRATIONS.flatMap((m) => m.statements).join('\n');

  it('has the initial schema, triggers, payload-column, palace, ability-log and sync migrations', () => {
    expect(MIGRATIONS.length).toBe(8);
    expect(MIGRATIONS.at(-1)?.tag).toBe('0007_sync_dirty_triggers');
  });

  it('adds the assessments.payload column', () => {
    expect(allSql).toContain('ALTER TABLE `assessments` ADD `payload` text');
  });

  it('creates all eleven tables', () => {
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
      'sync_meta',
      'sync_outbox',
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

  it('creates the sync dirty-marking triggers for every mutable synced table', () => {
    expect(allSql).toContain('CREATE TRIGGER cards_mark_dirty');
    expect(allSql).toContain('CREATE TRIGGER palaces_mark_dirty');
    expect(allSql).toContain('CREATE TRIGGER sessions_mark_dirty');
  });

  it('bumps the parent palace on every locus change (whole-list versioning)', () => {
    expect(allSql).toContain('CREATE TRIGGER loci_bump_palace_insert');
    expect(allSql).toContain('CREATE TRIGGER loci_bump_palace_update');
    expect(allSql).toContain('CREATE TRIGGER loci_bump_palace_delete');
  });

  it('queues append-only inserts in the outbox, since they can never be marked clean', () => {
    expect(allSql).toContain('CREATE TRIGGER review_log_queue_push');
    expect(allSql).toContain('CREATE TRIGGER ability_log_queue_push');
    expect(allSql).toContain('CREATE TRIGGER assessments_queue_push');
  });
});
