import { desc, eq } from 'drizzle-orm';
import { vviqStrategy, type MemoryStrategy } from '../../engine/assessment';
import { assessments } from '../schema';
import type { Db } from '../types';

const VVIQ_INSTRUMENT = 'vviq';

/**
 * Derived, not stored (SPEC.md sec 8/12): the substitute-strategy flag is
 * recomputed from the most recent `vviq` assessment row, so a retake
 * naturally supersedes the prior result with no mutation or second write.
 */
export function getVviqStrategy(db: Db): MemoryStrategy | null {
  const row = db
    .select()
    .from(assessments)
    .where(eq(assessments.instrument, VVIQ_INSTRUMENT))
    .orderBy(desc(assessments.ts))
    .limit(1)
    .get();
  return row ? vviqStrategy(row.rawScore) : null;
}
