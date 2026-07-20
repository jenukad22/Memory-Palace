/**
 * PAO (Person-Action-Object) system — pure encoding math (modules/memory/SPEC.md
 * §1). The user authors a 00–99 alphabet; a 6-digit number compresses into one
 * scene by taking the Person of the 1st pair, the Action of the 2nd, and the
 * Object of the 3rd. No I/O, no framework — testable in isolation (engine rule).
 */

export const PAO_MIN = 0;
export const PAO_MAX = 99;
/** A complete alphabet covers every number 00–99. */
export const PAO_COUNT = 100;

export interface PaoEntry {
  /** 0–99. The 2-digit identity of the entry. */
  n: number;
  person: string;
  action: string;
  object: string;
}

/** One compressed scene: Person of pair 1, Action of pair 2, Object of pair 3. */
export interface Scene {
  person: string;
  action: string;
  object: string;
}

export interface PaoListStatus {
  /** All 100 numbers 00–99 are present exactly once. */
  complete: boolean;
  /** Numbers 0–99 with no entry, ascending. */
  missing: number[];
  /** Numbers that appear more than once, ascending. */
  duplicates: number[];
  /** Count of distinct in-range numbers present. */
  count: number;
}

function assertPaoNumber(n: number): void {
  if (!Number.isInteger(n) || n < PAO_MIN || n > PAO_MAX) {
    throw new RangeError(`PAO number must be an integer in [${PAO_MIN}, ${PAO_MAX}], got ${n}`);
  }
}

/** Format a 0–99 number as its 2-digit label ("7" -> "07"). */
export function pad2(n: number): string {
  assertPaoNumber(n);
  return String(n).padStart(2, '0');
}

/**
 * Split a 6-digit string into its three 2-digit numbers [pair1, pair2, pair3].
 * Rejects anything that is not exactly six digits — the drill only compresses
 * complete 6-digit numbers.
 */
export function splitSixDigits(digits: string): [number, number, number] {
  if (!/^\d{6}$/.test(digits)) {
    throw new RangeError(`expected exactly 6 digits, got ${JSON.stringify(digits)}`);
  }
  return [Number(digits.slice(0, 2)), Number(digits.slice(2, 4)), Number(digits.slice(4, 6))];
}

/** Combine three entries into one scene (Person·Action·Object across the pairs). */
export function composeScene(entries: readonly [PaoEntry, PaoEntry, PaoEntry]): Scene {
  return {
    person: entries[0].person,
    action: entries[1].action,
    object: entries[2].object,
  };
}

/**
 * Look up the three entries a 6-digit number maps to, in pair order. Throws if
 * any pair has no authored entry — the caller (a drill) should only run over
 * numbers whose pairs are all covered.
 */
export function entriesForNumber(
  digits: string,
  byNumber: ReadonlyMap<number, PaoEntry>,
): [PaoEntry, PaoEntry, PaoEntry] {
  const pairs = splitSixDigits(digits);
  return pairs.map((n) => {
    const entry = byNumber.get(n);
    if (!entry) throw new RangeError(`no PAO entry for ${pad2(n)}`);
    return entry;
  }) as [PaoEntry, PaoEntry, PaoEntry];
}

/** Index a list of entries by their number, keeping the last on collision. */
export function indexByNumber(entries: readonly PaoEntry[]): Map<number, PaoEntry> {
  const map = new Map<number, PaoEntry>();
  for (const e of entries) map.set(e.n, e);
  return map;
}

/** Completeness / duplicate report for an authored alphabet. */
export function validatePaoList(entries: readonly PaoEntry[]): PaoListStatus {
  const seen = new Map<number, number>();
  for (const e of entries) {
    if (!Number.isInteger(e.n) || e.n < PAO_MIN || e.n > PAO_MAX) continue;
    seen.set(e.n, (seen.get(e.n) ?? 0) + 1);
  }
  const missing: number[] = [];
  for (let n = PAO_MIN; n <= PAO_MAX; n += 1) {
    if (!seen.has(n)) missing.push(n);
  }
  const duplicates = [...seen.entries()]
    .filter(([, c]) => c > 1)
    .map(([n]) => n)
    .sort((a, b) => a - b);
  return {
    complete: missing.length === 0 && duplicates.length === 0,
    missing,
    duplicates,
    count: seen.size,
  };
}
