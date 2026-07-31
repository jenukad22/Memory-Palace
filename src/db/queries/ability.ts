import { asc, eq } from 'drizzle-orm';
import { newId } from '../id';
import { abilityLog, abilityRatings, type AbilityLogRow, type AbilityRow } from '../schema';
import type { Db } from '../types';

export function getAbility(db: Db, module: string): AbilityRow | undefined {
  return db.select().from(abilityRatings).where(eq(abilityRatings.module, module)).get();
}

/**
 * Updates the current-value cache (ability_ratings) and appends to the
 * append-only history (ability_log) — no internal db.transaction(), so this
 * composes correctly both bare and when called from inside an ambient
 * transaction (see recordReview in queries/reviews.ts).
 */
export function upsertAbility(
  db: Db,
  module: string,
  elo: number,
  now: Date = new Date(),
): AbilityRow {
  const row: AbilityRow = { module, elo, updatedAt: now };
  db.insert(abilityRatings)
    .values(row)
    .onConflictDoUpdate({ target: abilityRatings.module, set: { elo, updatedAt: now } })
    .run();
  appendAbilityLog(db, module, elo, now);
  return row;
}

export function appendAbilityLog(
  db: Db,
  module: string,
  elo: number,
  now: Date = new Date(),
): AbilityLogRow {
  const row: AbilityLogRow = { id: newId(), module, elo, ts: now };
  db.insert(abilityLog).values(row).run();
  return row;
}

/** A module's full Elo history, ascending by time — feeds the progress dashboard's chart. */
export function listAbilityHistory(db: Db, module: string): AbilityLogRow[] {
  return db
    .select()
    .from(abilityLog)
    .where(eq(abilityLog.module, module))
    .orderBy(asc(abilityLog.ts))
    .all();
}
