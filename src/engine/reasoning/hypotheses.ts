/**
 * Hypothesis-fluency scoring (modules/reasoning/SPEC.md §4.2). Pure and
 * content-free — the prompt bank lives in `modules/reasoning/hypothesesBank.ts`
 * (SPEC.md §6); this file only ever sees the user's typed entries.
 *
 * Fluency is not correctness: this counts distinct non-empty entries. It
 * cannot and does not judge whether an entry is a *good* explanation — that
 * would require content understanding this file cannot have (SPEC.md §0).
 */

export const MAX_HYPOTHESES_PER_PROMPT = 8;
export const HYPOTHESES_PROMPTS_PER_RUN = 5;

function normalize(entry: string): string {
  return entry.trim().toLowerCase();
}

export interface HypothesesPromptScore {
  /** Non-empty entries after trimming. */
  entries: number;
  /** Distinct entries — exact-text duplicates only (SPEC.md §4.2). */
  uniqueCount: number;
  duplicateCount: number;
}

/**
 * Scores one prompt's entries. Deduplication is exact-text after
 * trim+lowercase, the same normalization `scoreFreeRecall` uses — two
 * different phrasings of the same idea both count, which is disclosed in
 * copy, not hidden.
 */
export function scoreHypothesesEntry(rawEntries: readonly string[]): HypothesesPromptScore {
  const seen = new Set<string>();
  let entries = 0;
  let duplicateCount = 0;
  for (const raw of rawEntries) {
    const norm = normalize(raw);
    if (norm === '') continue;
    entries += 1;
    if (seen.has(norm)) duplicateCount += 1;
    else seen.add(norm);
  }
  return { entries, uniqueCount: seen.size, duplicateCount };
}

export interface HypothesesRunMetrics {
  /** Prompts attempted. */
  trials: number;
  /** Sum of unique entries across all prompts. */
  totalUnique: number;
  /** Unique entries per prompt — the headline fluency number. */
  meanUniquePerPrompt: number | null;
  totalDuplicates: number;
}

/** Aggregates one run: a list of raw entry-lists, one per prompt shown. */
export function scoreHypothesesRun(
  entriesPerPrompt: readonly (readonly string[])[],
): HypothesesRunMetrics {
  const perPrompt = entriesPerPrompt.map(scoreHypothesesEntry);
  const totalUnique = perPrompt.reduce((a, p) => a + p.uniqueCount, 0);
  const totalDuplicates = perPrompt.reduce((a, p) => a + p.duplicateCount, 0);
  return {
    trials: perPrompt.length,
    totalUnique,
    meanUniquePerPrompt: perPrompt.length === 0 ? null : totalUnique / perPrompt.length,
    totalDuplicates,
  };
}
