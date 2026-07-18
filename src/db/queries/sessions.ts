import { desc, eq } from 'drizzle-orm';
import { newId } from '../id';
import { sessions, type SessionRow } from '../schema';
import type { Db } from '../types';

export interface EndSessionInput {
  items: number;
  accuracy: number;
  ended?: Date;
}

export function startSession(
  db: Db,
  module: string,
  now: Date = new Date(),
  id: string = newId(),
): string {
  db.insert(sessions)
    .values({ id, module, started: now, ended: null, items: 0, accuracy: 0 })
    .run();
  return id;
}

export function endSession(db: Db, id: string, input: EndSessionInput): void {
  db.update(sessions)
    .set({ items: input.items, accuracy: input.accuracy, ended: input.ended ?? new Date() })
    .where(eq(sessions.id, id))
    .run();
}

export function listSessions(db: Db, module?: string): SessionRow[] {
  const base = db.select().from(sessions);
  return module
    ? base.where(eq(sessions.module, module)).orderBy(desc(sessions.started)).all()
    : base.orderBy(desc(sessions.started)).all();
}
