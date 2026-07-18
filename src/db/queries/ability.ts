import { eq } from 'drizzle-orm';
import { abilityRatings, type AbilityRow } from '../schema';
import type { Db } from '../types';

export function getAbility(db: Db, module: string): AbilityRow | undefined {
  return db.select().from(abilityRatings).where(eq(abilityRatings.module, module)).get();
}

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
  return row;
}
