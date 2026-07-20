import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../testing';
import type { Db } from '../types';
import { getCard } from './cards';
import {
  addLocus,
  createPalace,
  createTrainingSet,
  deleteLocus,
  listLoci,
  listPalaces,
  listPlacementsBySet,
  reorderLoci,
  softDeletePalace,
} from './palaces';
import { listReviewsByCard, recordReview } from './reviews';

describe('palace + loci CRUD', () => {
  let db: Db;
  beforeEach(async () => {
    ({ db } = await createTestDb());
  });

  it('appends loci at contiguous positions from 0', () => {
    const p = createPalace(db, { name: 'Home Route' });
    addLocus(db, { palaceId: p.id, label: 'Front door' });
    addLocus(db, { palaceId: p.id, label: 'Kitchen' });
    addLocus(db, { palaceId: p.id, label: 'Study' });
    expect(listLoci(db, p.id).map((l) => [l.position, l.label])).toEqual([
      [0, 'Front door'],
      [1, 'Kitchen'],
      [2, 'Study'],
    ]);
  });

  it('soft-deletes a palace, hiding it from the list without dropping loci', () => {
    const p = createPalace(db, { name: 'Temp' });
    addLocus(db, { palaceId: p.id, label: 'A' });
    softDeletePalace(db, p.id);
    expect(listPalaces(db)).toHaveLength(0);
    expect(listLoci(db, p.id)).toHaveLength(1); // history preserved
  });
});

describe('reorderLoci', () => {
  it('rewrites positions without colliding on the UNIQUE(palace,position) index', async () => {
    const { db } = await createTestDb();
    const p = createPalace(db, { name: 'R' });
    const a = addLocus(db, { palaceId: p.id, label: 'A' });
    const b = addLocus(db, { palaceId: p.id, label: 'B' });
    const c = addLocus(db, { palaceId: p.id, label: 'C' });
    reorderLoci(db, p.id, [c.id, a.id, b.id]);
    expect(listLoci(db, p.id).map((l) => l.label)).toEqual(['C', 'A', 'B']);
  });

  it('preserves placement scheduling state across a reorder (SPEC.md §3)', async () => {
    const { db } = await createTestDb();
    const p = createPalace(db, { name: 'R' });
    const a = addLocus(db, { palaceId: p.id, label: 'A' });
    const b = addLocus(db, { palaceId: p.id, label: 'B' });
    const { setId, cardIds } = createTrainingSet(db, {
      palaceId: p.id,
      items: ['apple', 'bread'],
    });
    // Review the first placement so it carries FSRS/review history.
    recordReview(db, { cardId: cardIds[0]!, module: 'memory', rating: 'good' });
    const before = listReviewsByCard(db, cardIds[0]!).length;

    reorderLoci(db, p.id, [b.id, a.id]);

    // Scheduling untouched; drill order now follows the new positions.
    expect(listReviewsByCard(db, cardIds[0]!).length).toBe(before);
    expect(listPlacementsBySet(db, setId).map((v) => v.item)).toEqual(['bread', 'apple']);
  });
});

describe('deleteLocus', () => {
  it('soft-deletes referencing placements, compacts positions, and degrades gracefully', async () => {
    const { db } = await createTestDb();
    const p = createPalace(db, { name: 'R' });
    const a = addLocus(db, { palaceId: p.id, label: 'A' });
    const b = addLocus(db, { palaceId: p.id, label: 'B' });
    const c = addLocus(db, { palaceId: p.id, label: 'C' });
    const { setId, cardIds } = createTrainingSet(db, {
      palaceId: p.id,
      items: ['x', 'y', 'z'],
    });
    // Give the middle placement review history that must survive.
    recordReview(db, { cardId: cardIds[1]!, module: 'memory', rating: 'good' });

    deleteLocus(db, p.id, b.id);

    // Locus gone, positions compacted to contiguous 0..1.
    expect(listLoci(db, p.id).map((l) => [l.position, l.label])).toEqual([
      [0, 'A'],
      [1, 'C'],
    ]);
    // The placement card is soft-deleted, not destroyed — history remains.
    expect(getCard(db, cardIds[1]!)?.isDeleted).toBe(true);
    expect(listReviewsByCard(db, cardIds[1]!).length).toBe(1);
    // Active set now excludes the orphaned placement; survivors read fine.
    expect(listPlacementsBySet(db, setId).map((v) => v.item)).toEqual(['x', 'z']);
    void a;
    void c;
  });

  it('reads an orphaned placement from its snapshot instead of throwing', async () => {
    const { db, sqlite } = await createTestDb();
    const p = createPalace(db, { name: 'R' });
    const a = addLocus(db, { palaceId: p.id, label: 'Front door' });
    const { setId } = createTrainingSet(db, { palaceId: p.id, items: ['keys'] });
    // Simulate a vanished locus while the placement card stays active (defensive path).
    sqlite.run('DELETE FROM loci WHERE id = ?', [a.id]);
    const [view] = listPlacementsBySet(db, setId);
    expect(view).toMatchObject({ item: 'keys', locusLabel: 'Front door', orphaned: true });
  });
});
