/**
 * Memory-palace route math (modules/memory/SPEC.md §1, §3) — pure and framework-
 * free. Loci carry an explicit `position`; this module owns ordering, position
 * assignment on insert/delete/reorder, drill construction, and answer scoring.
 * Persistence (the DB) applies whatever position plan these functions return.
 */

import type { Rng } from './assessment';

export interface LocusLike {
  id: string;
  position: number;
  label: string;
}

/** A to-be-remembered item placed on a stop, in route order. */
export interface Placement {
  locusId: string;
  position: number;
  item: string;
}

/** Ascending-by-position copy of loci (never mutates the input). */
export function orderLoci<T extends { position: number }>(loci: readonly T[]): T[] {
  return [...loci].sort((a, b) => a.position - b.position);
}

/** Next free position when appending a locus: one past the current maximum. */
export function nextPosition(loci: readonly { position: number }[]): number {
  return loci.reduce((max, l) => Math.max(max, l.position + 1), 0);
}

/**
 * Reindex loci to contiguous positions 0..n-1 in ascending order. Used after a
 * deletion so no gap remains, and to normalise any drift. Returns the id ->
 * position plan; the DB applies it (via an offset pass, since positions are
 * UNIQUE per palace).
 */
export function compactPositions(loci: readonly LocusLike[]): { id: string; position: number }[] {
  return orderLoci(loci).map((l, i) => ({ id: l.id, position: i }));
}

/**
 * Position plan for an explicit new order given by id. Every current locus id
 * must appear exactly once in `orderedIds`, else the requested order is
 * ambiguous and we throw rather than silently drop or duplicate a stop.
 */
export function reorderPositions(
  loci: readonly LocusLike[],
  orderedIds: readonly string[],
): { id: string; position: number }[] {
  const ids = new Set(loci.map((l) => l.id));
  if (orderedIds.length !== ids.size || new Set(orderedIds).size !== orderedIds.length) {
    throw new RangeError('reorderPositions requires each locus id exactly once');
  }
  for (const id of orderedIds) {
    if (!ids.has(id)) throw new RangeError(`unknown locus id ${id}`);
  }
  return orderedIds.map((id, i) => ({ id, position: i }));
}

/**
 * Zip an ordered item list onto the route in position order: item i lands on
 * stop i. Extra items (beyond the number of loci) are dropped; extra loci stay
 * empty. Encoding is always sequential along the route.
 */
export function buildRouteDrill(loci: readonly LocusLike[], items: readonly string[]): Placement[] {
  const ordered = orderLoci(loci);
  const n = Math.min(ordered.length, items.length);
  const placements: Placement[] = [];
  for (let i = 0; i < n; i += 1) {
    placements.push({ locusId: ordered[i]!.id, position: ordered[i]!.position, item: items[i]! });
  }
  return placements;
}

/**
 * The order in which to *test* placements. Recall is probed out of route order
 * so the user must retrieve each stop's item directly rather than reel off a
 * memorised serial list. Deterministic for a given seed (Fisher-Yates).
 */
export function recallOrder<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Normalise a free-text answer for comparison: trim, lowercase, collapse whitespace. */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Whether a retrieval attempt matches the expected item (normalised compare). */
export function scoreRecall(expected: string, given: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(given) && normalizeAnswer(given) !== '';
}
