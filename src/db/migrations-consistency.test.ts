import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrations.generated';

/**
 * Guards the drizzle-kit numbering invariant. The hand-authored trigger
 * migration (0001_review_log_append_only) is not something drizzle-kit can
 * generate — triggers aren't representable in its snapshots — so it must be
 * registered in `meta/_journal.json` by hand. If it (or any future hand
 * migration) is added without a journal entry, drizzle-kit's next `generate`
 * reuses that number and can overwrite an existing migration — including the
 * append-only trigger DDL. These assertions make that drift fail CI instead of
 * silently landing, so the fix can't be forgotten.
 */
const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

interface JournalEntry {
  idx: number;
  tag: string;
}
interface Journal {
  entries: JournalEntry[];
}

describe('migration numbering consistency', () => {
  const sqlTags = readdirSync(url('./migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''))
    .sort();

  const journal = JSON.parse(
    readFileSync(url('./migrations/meta/_journal.json'), 'utf8'),
  ) as Journal;
  const journalTags = [...journal.entries].sort((a, b) => a.idx - b.idx).map((e) => e.tag);

  const bundleTags = MIGRATIONS.map((m) => m.tag);

  it('every .sql file has a journal entry and vice versa (next generate will not collide)', () => {
    expect(journalTags).toEqual(sqlTags);
  });

  it('the runtime bundle matches the on-disk migrations, in order', () => {
    expect(bundleTags).toEqual(sqlTags);
  });

  it('journal indexes are contiguous from 0 (next generate lands on the next free number)', () => {
    const idxs = journal.entries.map((e) => e.idx).sort((a, b) => a - b);
    expect(idxs).toEqual(idxs.map((_, i) => i));
  });
});
