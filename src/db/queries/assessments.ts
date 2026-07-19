import { desc, eq } from 'drizzle-orm';
import { newId } from '../id';
import { assessments, type AssessmentRow } from '../schema';
import type { Db } from '../types';

export interface NewAssessmentInput {
  instrument: string;
  rawScore: number;
  normalized?: number | null;
  payload?: string | null;
  ts?: Date;
  id?: string;
}

export function insertAssessment(db: Db, input: NewAssessmentInput): AssessmentRow {
  const row: AssessmentRow = {
    id: input.id ?? newId(),
    instrument: input.instrument,
    rawScore: input.rawScore,
    normalized: input.normalized ?? null,
    payload: input.payload ?? null,
    ts: input.ts ?? new Date(),
  };
  db.insert(assessments).values(row).run();
  return row;
}

export function listAssessments(db: Db, instrument?: string): AssessmentRow[] {
  const base = db.select().from(assessments);
  return instrument
    ? base.where(eq(assessments.instrument, instrument)).orderBy(desc(assessments.ts)).all()
    : base.orderBy(desc(assessments.ts)).all();
}
