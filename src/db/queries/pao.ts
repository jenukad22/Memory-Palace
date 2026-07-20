import { and, eq } from 'drizzle-orm';
import { pad2, validatePaoList, type PaoEntry, type PaoListStatus } from '@/engine';
import { cards, type CardRow } from '../schema';
import type { Db } from '../types';
import { createCard } from './cards';

export const PAO_MODULE = 'pao';

/** A PAO card's back text: "Person · Action · Object". */
export function paoBack(person: string, action: string, object: string): string {
  return `${person} · ${action} · ${object}`;
}

function getPaoCard(db: Db, n: number): CardRow | undefined {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.module, PAO_MODULE), eq(cards.front, pad2(n)), eq(cards.isDeleted, false)))
    .get();
}

/**
 * Author or overwrite the entry for one number. The number's 2-digit label is
 * the card `front`, so an entry is addressable without querying JSON; a second
 * author for the same number updates in place rather than duplicating (keeping
 * its FSRS/review history).
 */
export function upsertPaoEntry(db: Db, entry: PaoEntry, now: Date = new Date()): CardRow {
  const front = pad2(entry.n);
  const back = paoBack(entry.person, entry.action, entry.object);
  const payload = JSON.stringify(entry);
  const existing = getPaoCard(db, entry.n);
  if (existing) {
    db.update(cards).set({ back, payload }).where(eq(cards.id, existing.id)).run();
    return { ...existing, back, payload };
  }
  return createCard(db, { module: PAO_MODULE, front, back, payload: entry, now });
}

/** The authored alphabet as engine `PaoEntry` records (ascending by number). */
export function listPaoEntries(db: Db): PaoEntry[] {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.module, PAO_MODULE), eq(cards.isDeleted, false)))
    .all()
    .map((c) => JSON.parse(c.payload ?? '{}') as PaoEntry)
    .filter((e) => Number.isInteger(e.n))
    .sort((a, b) => a.n - b.n);
}

export interface PaoCard {
  cardId: string;
  entry: PaoEntry;
}

/** Authored entries paired with their card ids, ascending by number — for drills that log reviews. */
export function listPaoCards(db: Db): PaoCard[] {
  return db
    .select({ id: cards.id, payload: cards.payload })
    .from(cards)
    .where(and(eq(cards.module, PAO_MODULE), eq(cards.isDeleted, false)))
    .all()
    .map((c) => ({ cardId: c.id, entry: JSON.parse(c.payload ?? '{}') as PaoEntry }))
    .filter((c) => Number.isInteger(c.entry.n))
    .sort((a, b) => a.entry.n - b.entry.n);
}

/** Completeness / duplicate report for the authored alphabet. */
export function paoStatus(db: Db): PaoListStatus {
  return validatePaoList(listPaoEntries(db));
}
