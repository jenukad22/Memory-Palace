/**
 * CPT go/no-go stream generation and scoring (modules/attention/SPEC.md §4.2).
 *
 * Respond to every target letter; withhold on the one designated distractor.
 * A press on a distractor is a commission error, a missed target an omission
 * error — both are counted, and d′ reports the two together so that "pressed at
 * everything" cannot read as good performance.
 */

import type { Rng } from '../assessment/sequences';
import { median } from './latency';
import { criterion, dPrime, maxDPrime } from './signalDetection';
import { CPT_DISTRACTOR_RATE, CPT_TRIALS } from './timing';

/** Consonants only — no vowels, so the stream never spells a word to latch onto. */
export const CPT_GO_LETTERS = [
  'B',
  'C',
  'D',
  'F',
  'G',
  'H',
  'J',
  'K',
  'L',
  'M',
  'N',
  'P',
  'R',
  'S',
  'T',
  'V',
  'W',
  'Z',
] as const;

/** The single withhold-on letter. Not in CPT_GO_LETTERS, so it is unambiguous. */
export const CPT_DISTRACTOR_LETTER = 'X';

export interface CptStimulus {
  letter: string;
  /** True = respond (go); false = the distractor, withhold. */
  isTarget: boolean;
}

export interface CptStreamOptions {
  trials?: number;
  distractorRate?: number;
}

/**
 * A stream with an exact distractor count, never two distractors in a row,
 * never a distractor first, and no immediately repeated go letter.
 *
 * The adjacency and first-trial rules exist so every no-go is preceded by at
 * least one go: withholding is only measurable against an established go
 * response, and back-to-back distractors would make a single lapse of
 * withholding look like two.
 */
export function generateCptStream(rng: Rng, options: CptStreamOptions = {}): CptStimulus[] {
  const trials = options.trials ?? CPT_TRIALS;
  const rate = options.distractorRate ?? CPT_DISTRACTOR_RATE;
  const distractors = Math.round(trials * rate);
  const positions = pickDistractorPositions(rng, trials, distractors);

  const stream: CptStimulus[] = [];
  let lastGo = '';
  for (let i = 0; i < trials; i += 1) {
    if (positions.has(i)) {
      stream.push({ letter: CPT_DISTRACTOR_LETTER, isTarget: false });
      continue;
    }
    const letter = pickGoLetter(rng, lastGo);
    lastGo = letter;
    stream.push({ letter, isTarget: true });
  }
  return stream;
}

function pickGoLetter(rng: Rng, exclude: string): string {
  const pool = CPT_GO_LETTERS.filter((l) => l !== exclude);
  return pool[Math.floor(rng() * pool.length)] ?? CPT_GO_LETTERS[0];
}

/**
 * Distractor slots in [1, trials): never adjacent to each other. Candidates are
 * walked in a seeded random order and accepted when they still fit; if the
 * request is too dense to satisfy (more than the spacing rule allows), the
 * remainder are placed at the first legal slots so the count is always exact.
 */
function pickDistractorPositions(rng: Rng, trials: number, count: number): Set<number> {
  const chosen = new Set<number>();
  const legal = (i: number) => i >= 1 && i < trials && !chosen.has(i - 1) && !chosen.has(i + 1);

  const candidates: number[] = [];
  for (let i = 1; i < trials; i += 1) candidates.push(i);
  // Fisher-Yates with the seeded rng, so the layout is reproducible from a seed.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }

  for (const i of candidates) {
    if (chosen.size >= count) break;
    if (legal(i)) chosen.add(i);
  }
  for (let i = 1; i < trials && chosen.size < count; i += 1) {
    if (!chosen.has(i)) chosen.add(i);
  }
  return chosen;
}

/** One recorded trial: what was shown, whether the user pressed, and how fast. */
export interface CptTrialResult {
  isTarget: boolean;
  responded: boolean;
  /** ms from painted onset to the press; null when nothing was pressed. */
  rtMs: number | null;
}

export interface CptMetrics {
  trials: number;
  targets: number;
  distractors: number;
  /** Presses on targets. */
  hits: number;
  /** Targets that went unanswered. */
  omissions: number;
  /** Presses on distractors — the withhold failures. */
  commissions: number;
  correctRejections: number;
  hitRate: number | null;
  omissionRate: number | null;
  commissionRate: number | null;
  meanHitRtMs: number | null;
  medianHitRtMs: number | null;
  /** SD of hit RT — how steady the responding was, not how fast. */
  rtSdMs: number | null;
  /** SD / mean: RT spread scaled by speed, comparable across runs. */
  rtCoefficientOfVariation: number | null;
  /** Sensitivity across hits and commissions together. */
  dPrime: number;
  /** The best d′ this run's trial counts allow, for reading the one above. */
  maxDPrime: number;
  /** Response bias: negative = pressed readily, positive = withheld readily. */
  criterion: number;
}

export function scoreCpt(results: readonly CptTrialResult[]): CptMetrics {
  const targets = results.filter((r) => r.isTarget);
  const distractors = results.filter((r) => !r.isTarget);
  const hits = targets.filter((r) => r.responded);
  const commissions = distractors.filter((r) => r.responded).length;
  const hitRts = hits
    .map((r) => r.rtMs)
    .filter((rt): rt is number => rt !== null)
    .sort((a, b) => a - b);

  const counts = {
    hits: hits.length,
    signals: targets.length,
    falseAlarms: commissions,
    noise: distractors.length,
  };
  const meanRt = hitRts.length === 0 ? null : hitRts.reduce((a, b) => a + b, 0) / hitRts.length;
  const sd =
    meanRt === null || hitRts.length < 2
      ? null
      : Math.sqrt(hitRts.reduce((a, rt) => a + (rt - meanRt) ** 2, 0) / (hitRts.length - 1));

  return {
    trials: results.length,
    targets: targets.length,
    distractors: distractors.length,
    hits: hits.length,
    omissions: targets.length - hits.length,
    commissions,
    correctRejections: distractors.length - commissions,
    hitRate: targets.length === 0 ? null : hits.length / targets.length,
    omissionRate: targets.length === 0 ? null : (targets.length - hits.length) / targets.length,
    commissionRate: distractors.length === 0 ? null : commissions / distractors.length,
    meanHitRtMs: meanRt,
    medianHitRtMs: hitRts.length === 0 ? null : median(hitRts),
    rtSdMs: sd,
    rtCoefficientOfVariation: sd === null || meanRt === null || meanRt === 0 ? null : sd / meanRt,
    dPrime: dPrime(counts),
    maxDPrime: maxDPrime(targets.length, distractors.length),
    criterion: criterion(counts),
  };
}
