/**
 * Free-recall paradigm (modules/memory/SPEC.md §7.3): a word list is studied,
 * then the user free-types every word they remember, in any order. Pure list
 * sampling and scoring — no React, no timing (see timing.ts for exposure
 * constants).
 */

import type { Rng } from './sequences';

export const FREE_RECALL_LIST_LENGTH = 72;

/**
 * Draw `length` unique words from `pool` via Fisher-Yates, optionally excluding
 * words already used (so a posttest list can be disjoint from the pretest list).
 * Throws if the eligible pool is smaller than `length` — silently returning a
 * short list would understate what the user was actually asked to recall.
 */
export function sampleWordList(
  pool: readonly string[],
  length: number,
  rng: Rng,
  exclude?: ReadonlySet<string>,
): string[] {
  const eligible = exclude ? pool.filter((w) => !exclude.has(w)) : [...pool];
  if (eligible.length < length) {
    throw new RangeError(`word pool has only ${eligible.length} eligible words, need ${length}`);
  }
  for (let i = eligible.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j]!, eligible[i]!];
  }
  return eligible.slice(0, length);
}

function normalizeWord(w: string): string {
  return w.trim().toLowerCase();
}

export interface FreeRecallScore {
  /** Studied-list words the user correctly recalled (original casing, list order). */
  correct: string[];
  /** Studied-list words the user did not recall. */
  missed: string[];
  /** Recalled entries that do not match any studied word. */
  intrusions: string[];
  /** Count of distinct studied words recalled — the headline "words recalled" number. */
  count: number;
}

/**
 * Score a free-recall attempt against the studied list. Order-independent
 * (free recall, not serial recall); recalled entries are normalized
 * (trim + lowercase) and deduplicated before matching, so retyping the same
 * word twice does not inflate the count.
 */
export function scoreFreeRecall(
  list: readonly string[],
  recalled: readonly string[],
): FreeRecallScore {
  const byNormalized = new Map(list.map((w) => [normalizeWord(w), w]));
  const seen = new Set<string>();
  const intrusions: string[] = [];

  for (const entry of recalled) {
    const norm = normalizeWord(entry);
    if (norm === '' || seen.has(norm)) continue;
    seen.add(norm);
    if (!byNormalized.has(norm)) intrusions.push(entry);
  }

  const correct = list.filter((w) => seen.has(normalizeWord(w)));
  const missed = list.filter((w) => !seen.has(normalizeWord(w)));

  return { correct, missed, intrusions, count: correct.length };
}
