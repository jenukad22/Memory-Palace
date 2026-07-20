import { and, asc, eq } from 'drizzle-orm';
import {
  buildRouteDrill,
  compactPositions,
  nextPosition,
  orderLoci,
  reorderPositions,
  type LocusLike,
} from '@/engine';
import { newId } from '../id';
import { cards, loci, palaces, type LocusRow, type PalaceRow } from '../schema';
import type { Db } from '../types';
import { createCard, softDeleteCard } from './cards';

const MEMORY_MODULE = 'memory';
// Positions are UNIQUE(palace_id, position); a reorder stages every row above the
// valid range first so no in-progress statement collides (SPEC.md §3).
const REORDER_OFFSET = 1_000_000;

// ---- Palaces ---------------------------------------------------------------

export interface NewPalaceInput {
  name: string;
  id?: string;
  now?: Date;
}

export function createPalace(db: Db, input: NewPalaceInput): PalaceRow {
  const row: PalaceRow = {
    id: input.id ?? newId(),
    name: input.name,
    createdAt: input.now ?? new Date(),
    isDeleted: false,
  };
  db.insert(palaces).values(row).run();
  return row;
}

export function listPalaces(db: Db): PalaceRow[] {
  return db
    .select()
    .from(palaces)
    .where(eq(palaces.isDeleted, false))
    .orderBy(asc(palaces.createdAt))
    .all();
}

export function getPalace(db: Db, id: string): PalaceRow | undefined {
  return db.select().from(palaces).where(eq(palaces.id, id)).get();
}

/** Soft-delete only (SPEC.md §3): loci and placement cards — and their review history — survive. */
export function softDeletePalace(db: Db, id: string): void {
  db.update(palaces).set({ isDeleted: true }).where(eq(palaces.id, id)).run();
}

// ---- Loci ------------------------------------------------------------------

export interface NewLocusInput {
  palaceId: string;
  label: string;
  cue?: string | null;
  id?: string;
  now?: Date;
}

/** Append a locus at the next free position (one past the current maximum). */
export function addLocus(db: Db, input: NewLocusInput): LocusRow {
  const existing = listLoci(db, input.palaceId);
  const row: LocusRow = {
    id: input.id ?? newId(),
    palaceId: input.palaceId,
    position: nextPosition(existing),
    label: input.label,
    cue: input.cue ?? null,
    createdAt: input.now ?? new Date(),
  };
  db.insert(loci).values(row).run();
  return row;
}

export function listLoci(db: Db, palaceId: string): LocusRow[] {
  return db
    .select()
    .from(loci)
    .where(eq(loci.palaceId, palaceId))
    .orderBy(asc(loci.position))
    .all();
}

export function updateLocus(
  db: Db,
  id: string,
  patch: { label?: string; cue?: string | null },
): void {
  const set: Partial<Pick<LocusRow, 'label' | 'cue'>> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.cue !== undefined) set.cue = patch.cue;
  if (Object.keys(set).length === 0) return;
  db.update(loci).set(set).where(eq(loci.id, id)).run();
}

/**
 * Reorder a palace's loci to the given id order. Only `position` changes, so
 * placement scheduling state (keyed on card id / stable locus id) is untouched
 * (SPEC.md §3). Two passes inside one transaction dodge the UNIQUE constraint.
 */
export function reorderLoci(db: Db, palaceId: string, orderedIds: readonly string[]): void {
  const current = listLoci(db, palaceId);
  const plan = reorderPositions(current, orderedIds);
  db.transaction((tx) => {
    for (const l of current) {
      tx.update(loci)
        .set({ position: l.position + REORDER_OFFSET })
        .where(eq(loci.id, l.id))
        .run();
    }
    for (const { id, position } of plan) {
      tx.update(loci).set({ position }).where(eq(loci.id, id)).run();
    }
  });
}

/**
 * Delete a locus (SPEC.md §3): soft-delete every active placement card that
 * references it (preserving append-only review history), hard-delete the locus,
 * then compact remaining positions — all in one transaction.
 */
export function deleteLocus(db: Db, palaceId: string, locusId: string): void {
  const placementIds = listActivePlacementCardIdsForLocus(db, locusId);
  const remaining = listLoci(db, palaceId).filter((l) => l.id !== locusId);
  const plan = compactPositions(remaining as LocusLike[]);
  db.transaction((tx) => {
    for (const cardId of placementIds) softDeleteCard(tx, cardId);
    tx.delete(loci).where(eq(loci.id, locusId)).run();
    for (const l of remaining) {
      tx.update(loci)
        .set({ position: l.position + REORDER_OFFSET })
        .where(eq(loci.id, l.id))
        .run();
    }
    for (const { id, position } of plan) {
      tx.update(loci).set({ position }).where(eq(loci.id, id)).run();
    }
  });
}

// ---- Placements / training sets --------------------------------------------

export interface PlacementPayload {
  palaceId: string;
  locusId: string;
  setId: string;
  position: number;
  /** Snapshot so a placement still renders if its locus is later deleted. */
  locusLabel: string;
}

export interface PlacementView {
  cardId: string;
  item: string;
  locusId: string;
  /** Live locus label, or the payload snapshot if the locus is gone. */
  locusLabel: string;
  /** Live locus position, or the payload snapshot if the locus is gone. */
  position: number;
  /** True when the referenced locus no longer exists (degraded, still readable). */
  orphaned: boolean;
}

function placementFront(locusLabel: string): string {
  return `${locusLabel} — what did you place here?`;
}

/**
 * Load an item list onto a palace's loci as one training set: item i lands on
 * stop i, each pairing stored as a reviewable placement card (SPEC.md §1).
 * Returns the set id and the created card ids in route order.
 */
export function createTrainingSet(
  db: Db,
  input: { palaceId: string; items: readonly string[]; setId?: string; now?: Date },
): { setId: string; cardIds: string[] } {
  const lociRows = listLoci(db, input.palaceId);
  const placements = buildRouteDrill(lociRows as LocusLike[], input.items);
  const setId = input.setId ?? newId();
  const byId = new Map(lociRows.map((l) => [l.id, l]));
  const cardIds: string[] = [];
  db.transaction((tx) => {
    for (const p of placements) {
      const label = byId.get(p.locusId)!.label;
      const payload: PlacementPayload = {
        palaceId: input.palaceId,
        locusId: p.locusId,
        setId,
        position: p.position,
        locusLabel: label,
      };
      const card = createCard(tx, {
        module: MEMORY_MODULE,
        front: placementFront(label),
        back: p.item,
        payload,
        ...(input.now ? { now: input.now } : {}),
      });
      cardIds.push(card.id);
    }
  });
  return { setId, cardIds };
}

function parsePlacement(payload: string | null): PlacementPayload | null {
  if (!payload) return null;
  const parsed = JSON.parse(payload) as Partial<PlacementPayload>;
  if (typeof parsed.setId !== 'string' || typeof parsed.locusId !== 'string') return null;
  return parsed as PlacementPayload;
}

/** Active (non-deleted) placement card ids that reference a locus. */
function listActivePlacementCardIdsForLocus(db: Db, locusId: string): string[] {
  return db
    .select({ id: cards.id, payload: cards.payload })
    .from(cards)
    .where(and(eq(cards.module, MEMORY_MODULE), eq(cards.isDeleted, false)))
    .all()
    .filter((r) => parsePlacement(r.payload)?.locusId === locusId)
    .map((r) => r.id);
}

/**
 * Placements of a training set in current route order. Joins each placement to
 * its locus null-safely: a placement whose locus was deleted falls back to the
 * payload snapshot and is flagged `orphaned` — it degrades, never throws.
 */
export function listPlacementsBySet(db: Db, setId: string): PlacementView[] {
  const memoryCards = db
    .select({ id: cards.id, back: cards.back, payload: cards.payload })
    .from(cards)
    .where(and(eq(cards.module, MEMORY_MODULE), eq(cards.isDeleted, false)))
    .all();

  const views: PlacementView[] = [];
  const liveLoci = new Map<string, LocusRow>();
  for (const c of memoryCards) {
    const p = parsePlacement(c.payload);
    if (!p || p.setId !== setId) continue;
    if (!liveLoci.has(p.locusId)) {
      const l = db.select().from(loci).where(eq(loci.id, p.locusId)).get();
      if (l) liveLoci.set(p.locusId, l);
    }
    const live = liveLoci.get(p.locusId);
    views.push({
      cardId: c.id,
      item: c.back,
      locusId: p.locusId,
      locusLabel: live?.label ?? p.locusLabel,
      position: live?.position ?? p.position,
      orphaned: !live,
    });
  }
  return orderLoci(views);
}
