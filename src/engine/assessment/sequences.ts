/**
 * Seeded sequence generation for the span instruments. Pure and deterministic:
 * the same seed always yields the same sequence, so tests are reproducible and
 * a run can be replayed from its seed.
 */

export type Rng = () => number;

/** mulberry32 — a small, fast, deterministic PRNG returning values in [0, 1). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick an integer in [0, count), excluding `exclude` when it is in range (pass -1 for none). */
function pickExcluding(rng: Rng, count: number, exclude: number): number {
  if (exclude < 0 || exclude >= count) return Math.floor(rng() * count);
  const d = Math.floor(rng() * (count - 1));
  return d >= exclude ? d + 1 : d;
}

function strictlyMonotonic(seq: number[]): boolean {
  const up = seq.every((d, i) => i === 0 || d > seq[i - 1]!);
  const down = seq.every((d, i) => i === 0 || d < seq[i - 1]!);
  return up || down;
}

const MAX_ATTEMPTS = 50;

/**
 * A sequence of single digits (0-9) with no immediately repeated digit, and —
 * for length >= 3 — never a strict monotonic run (no 3-4-5-6 or 9-8-7-6).
 */
export function generateDigitSequence(length: number, rng: Rng): number[] {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const seq: number[] = [];
    for (let i = 0; i < length; i += 1) {
      seq.push(pickExcluding(rng, 10, i === 0 ? -1 : seq[i - 1]!));
    }
    if (length < 3 || !strictlyMonotonic(seq)) return seq;
  }
  // Exhausting attempts is statistically implausible for length >= 3; fall back
  // rather than loop forever.
  const seq: number[] = [];
  for (let i = 0; i < length; i += 1) {
    seq.push(pickExcluding(rng, 10, i === 0 ? -1 : seq[i - 1]!));
  }
  return seq;
}

/**
 * A sequence of Corsi block positions (0-8) with no immediately repeated block.
 * Arbitrary jumps are allowed (no path or adjacency constraints).
 */
export function generateCorsiSequence(length: number, rng: Rng): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i += 1) {
    seq.push(pickExcluding(rng, 9, i === 0 ? -1 : seq[i - 1]!));
  }
  return seq;
}
