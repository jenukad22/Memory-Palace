/**
 * Change-blindness flicker scene generation and scoring
 * (modules/attention/SPEC.md §4.3).
 *
 * Scenes are generated abstract grids, not photographs — same reason the span
 * instruments generate their own sequences (assessment/SPEC.md §0). The engine
 * emits palette *indices* and unit-fraction sizes; mapping those to colours and
 * pixels is the screen's job, which keeps this file framework-free and keeps
 * the design tokens in one place.
 */

import type { Rng } from '../assessment/sequences';
import { median } from './latency';
import { FLICKER_TIMEOUT_MS, flickerCycles } from './timing';

export const FLICKER_COLS = 5;
export const FLICKER_ROWS = 4;

/** How many palette entries the screen must supply. */
export const FLICKER_COLOR_COUNT = 5;

export const FLICKER_SHAPES = ['circle', 'square', 'diamond'] as const;
export type FlickerShape = (typeof FLICKER_SHAPES)[number];

/** Element edge as a fraction of its grid cell, before the size change. */
export const FLICKER_SIZE_MIN = 0.5;
export const FLICKER_SIZE_MAX = 0.72;
/** How much a size change moves the element, as a fraction of the cell. */
export const FLICKER_SIZE_DELTA = 0.22;

/** Share of grid cells that hold an element. Gaps make it a scene, not a matrix. */
export const FLICKER_DENSITY = 0.7;
/** Floor on element count, so a sparse draw can't make the search trivial. */
export const FLICKER_MIN_ELEMENTS = 10;

export type FlickerChangeKind = 'color' | 'size' | 'presence';
export const FLICKER_CHANGE_KINDS: readonly FlickerChangeKind[] = ['color', 'size', 'presence'];

export interface FlickerCell {
  /** Row-major grid index. */
  index: number;
  col: number;
  row: number;
  shape: FlickerShape;
  /** Palette index in [0, FLICKER_COLOR_COUNT). */
  colorIndex: number;
  /** Element edge as a fraction of its cell, in (0, 1]. */
  sizeScale: number;
  /** False = an empty cell; nothing is drawn. */
  present: boolean;
}

export interface FlickerTrialSpec {
  cols: number;
  rows: number;
  /** Scene A — every grid cell, `present` says whether it holds an element. */
  base: FlickerCell[];
  /** Scene A′ — identical but for exactly one cell. */
  alternate: FlickerCell[];
  /** Grid index of the one differing cell. */
  changedIndex: number;
  change: FlickerChangeKind;
}

export interface FlickerTrialOptions {
  cols?: number;
  rows?: number;
  change?: FlickerChangeKind;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0]!;
}

function pickInt(rng: Rng, count: number): number {
  return Math.min(count - 1, Math.floor(rng() * count));
}

/**
 * One trial: a scene and its alternate, differing in exactly one element by
 * exactly one attribute. Deterministic for a seeded rng.
 */
export function generateFlickerTrial(
  rng: Rng,
  options: FlickerTrialOptions = {},
): FlickerTrialSpec {
  const cols = options.cols ?? FLICKER_COLS;
  const rows = options.rows ?? FLICKER_ROWS;
  const total = cols * rows;

  const base: FlickerCell[] = [];
  for (let index = 0; index < total; index += 1) {
    base.push({
      index,
      col: index % cols,
      row: Math.floor(index / cols),
      shape: pick(rng, FLICKER_SHAPES),
      colorIndex: pickInt(rng, FLICKER_COLOR_COUNT),
      sizeScale: FLICKER_SIZE_MIN + rng() * (FLICKER_SIZE_MAX - FLICKER_SIZE_MIN),
      present: rng() < FLICKER_DENSITY,
    });
  }

  // Top up to the element floor, filling the emptiest cells in a seeded order.
  const minElements = Math.min(FLICKER_MIN_ELEMENTS, total);
  const empties = base.filter((c) => !c.present);
  for (let i = empties.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [empties[i], empties[j]] = [empties[j]!, empties[i]!];
  }
  let presentCount = base.filter((c) => c.present).length;
  for (const cell of empties) {
    if (presentCount >= minElements) break;
    cell.present = true;
    presentCount += 1;
  }

  const change = options.change ?? pick(rng, FLICKER_CHANGE_KINDS);
  const candidates = base.filter((c) => c.present);
  const changed = candidates[pickInt(rng, candidates.length)]!;
  const alternate = base.map((c) =>
    c.index === changed.index ? applyChange(rng, c, change) : { ...c },
  );

  return { cols, rows, base, alternate, changedIndex: changed.index, change };
}

function applyChange(rng: Rng, cell: FlickerCell, change: FlickerChangeKind): FlickerCell {
  switch (change) {
    case 'presence':
      return { ...cell, present: false };
    case 'color': {
      const offset = 1 + pickInt(rng, FLICKER_COLOR_COUNT - 1);
      return { ...cell, colorIndex: (cell.colorIndex + offset) % FLICKER_COLOR_COUNT };
    }
    case 'size':
      // Always grows; FLICKER_SIZE_MAX + FLICKER_SIZE_DELTA stays inside the cell.
      return { ...cell, sizeScale: cell.sizeScale + FLICKER_SIZE_DELTA };
  }
}

/** Grid indexes where two scenes differ. Exactly one, by construction. */
export function changedCellIndexes(a: readonly FlickerCell[], b: readonly FlickerCell[]): number[] {
  const differs: number[] = [];
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.present !== y.present ||
      x.colorIndex !== y.colorIndex ||
      x.sizeScale !== y.sizeScale ||
      x.shape !== y.shape
    ) {
      differs.push(x.index);
    }
  }
  return differs;
}

export interface FlickerTrialResult {
  /** True only when the user tapped the changed element. */
  detected: boolean;
  /** ms from the first scene onset to the correct tap; null when never found. */
  detectionMs: number | null;
  /** Taps on unchanged elements — the trial continues after each. */
  falseTaps: number;
}

export interface FlickerMetrics {
  trials: number;
  detected: number;
  detectionRate: number | null;
  meanDetectionMs: number | null;
  medianDetectionMs: number | null;
  /** Median alternations before the change was found. */
  medianCycles: number | null;
  falseTaps: number;
  /**
   * Raw score: mean detection time with every missed trial imputed at the
   * timeout. Detected-only means would rank a run that found one change in 5 s
   * and gave up on three above a run that found all four in 20 s.
   */
  scoreDetectionMs: number | null;
}

export function scoreFlicker(results: readonly FlickerTrialResult[]): FlickerMetrics {
  const found = results
    .filter((r) => r.detected && r.detectionMs !== null)
    .map((r) => r.detectionMs!)
    .sort((a, b) => a - b);
  const imputed = results.map((r) =>
    r.detected && r.detectionMs !== null ? r.detectionMs : FLICKER_TIMEOUT_MS,
  );
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    trials: results.length,
    detected: found.length,
    detectionRate: results.length === 0 ? null : found.length / results.length,
    meanDetectionMs: found.length === 0 ? null : avg(found),
    medianDetectionMs: found.length === 0 ? null : median(found),
    medianCycles: found.length === 0 ? null : flickerCycles(median(found)),
    falseTaps: results.reduce((a, r) => a + r.falseTaps, 0),
    scoreDetectionMs: results.length === 0 ? null : avg(imputed),
  };
}

/** Elapsed time expressed as whole alternations, for the on-screen readout. */
export function detectionCycles(detectionMs: number): number {
  return flickerCycles(detectionMs);
}
