/**
 * Original two-choice factual comparisons for calibration training (SPEC.md
 * §2.4). Hand-picked for a settled, non-contested answer with a comfortable
 * margin. Population and GDP figures are deliberately excluded — they drift
 * year to year and are frequently disputed at the margin, which would make an
 * item's "correct" answer a moving target (assessment/SPEC.md §0's stance on
 * not building scoring on shifting ground applies to content, not just norms).
 *
 * Deliberately mixes trivial items (populate the high-confidence end of the
 * curve) with genuinely counter-intuitive ones (Australia is larger than
 * Greenland; Venus is hotter than Mercury; a dog has more chromosomes than a
 * human) so miscalibration has something to show up on.
 *
 * The engine never reads this file (SPEC.md §4.4) — it only ever sees
 * `{ confidencePct, correct }`. Correctness is resolved here, where the
 * content lives.
 */

import type { Rng } from '@/engine';
import { CALIBRATION_ITEMS_PER_RUN } from '@/engine';

export type CalibrationOption = 'A' | 'B';

export interface CalibrationItem {
  id: string;
  prompt: string;
  optionA: string;
  optionB: string;
  correctOption: CalibrationOption;
}

export const CALIBRATION_ITEMS: readonly CalibrationItem[] = [
  // Geography
  {
    id: 'geo-river-length',
    prompt: 'Which river is longer?',
    optionA: 'The Yangtze',
    optionB: 'The Thames',
    correctOption: 'A',
  },
  {
    id: 'geo-mountain-height',
    prompt: 'Which mountain is taller?',
    optionA: 'Mount Everest',
    optionB: 'Mount Kilimanjaro',
    correctOption: 'A',
  },
  {
    id: 'geo-country-area',
    prompt: 'Which country has more land area?',
    optionA: 'Russia',
    optionB: 'Canada',
    correctOption: 'A',
  },
  {
    id: 'geo-desert-area',
    prompt: 'Which desert covers more area?',
    optionA: 'The Sahara',
    optionB: 'The Gobi',
    correctOption: 'A',
  },
  {
    id: 'geo-trench-depth',
    prompt: 'Which ocean trench is deeper?',
    optionA: 'The Mariana Trench',
    optionB: 'The Puerto Rico Trench',
    correctOption: 'A',
  },
  {
    id: 'geo-lake-area',
    prompt: 'Which covers more area?',
    optionA: 'The Caspian Sea',
    optionB: 'Lake Superior',
    correctOption: 'A',
  },
  {
    id: 'geo-wall-reef-length',
    prompt: 'Which is longer?',
    optionA: 'The Great Wall of China',
    optionB: 'The Great Barrier Reef',
    correctOption: 'A',
  },
  {
    id: 'geo-range-length',
    prompt: 'Which mountain range is longer?',
    optionA: 'The Andes',
    optionB: 'The Rocky Mountains',
    correctOption: 'A',
  },
  {
    id: 'geo-australia-greenland',
    prompt: 'Which has more land area?',
    optionA: 'Australia',
    optionB: 'Greenland',
    correctOption: 'A',
  },

  // Astronomy
  {
    id: 'astro-jupiter-saturn',
    prompt: 'Which planet is larger?',
    optionA: 'Jupiter',
    optionB: 'Saturn',
    correctOption: 'A',
  },
  {
    id: 'astro-venus-mars-distance',
    prompt: 'Which planet is closer to the Sun?',
    optionA: 'Venus',
    optionB: 'Mars',
    correctOption: 'A',
  },
  {
    id: 'astro-moon-pluto',
    prompt: 'Which is larger in diameter?',
    optionA: 'Earth’s Moon',
    optionB: 'Pluto',
    correctOption: 'A',
  },
  {
    id: 'astro-sun-proxima',
    prompt: 'Which star is closer to Earth?',
    optionA: 'The Sun',
    optionB: 'Proxima Centauri',
    correctOption: 'A',
  },
  {
    id: 'astro-earth-mars-orbit',
    prompt: 'Which takes longer to orbit the Sun?',
    optionA: 'Mars',
    optionB: 'Earth',
    correctOption: 'A',
  },
  {
    id: 'astro-saturn-earth-moons',
    prompt: 'Which has more moons?',
    optionA: 'Saturn',
    optionB: 'Earth',
    correctOption: 'A',
  },
  {
    id: 'astro-venus-mercury-heat',
    prompt: 'Which planet is hotter on average at the surface?',
    optionA: 'Venus',
    optionB: 'Mercury',
    correctOption: 'A',
  },

  // History
  {
    id: 'hist-press-columbus',
    prompt: 'Which came first?',
    optionA: 'The invention of the printing press',
    optionB: 'Columbus’s first voyage to the Americas',
    correctOption: 'A',
  },
  {
    id: 'hist-rome-magnacarta',
    prompt: 'Which came first?',
    optionA: 'The fall of the Western Roman Empire',
    optionB: 'The signing of the Magna Carta',
    correctOption: 'A',
  },
  {
    id: 'hist-oxford-harvard',
    prompt: 'Which university is older?',
    optionA: 'The University of Oxford',
    optionB: 'Harvard University',
    correctOption: 'A',
  },
  {
    id: 'hist-frenchrev-civilwar',
    prompt: 'Which came first?',
    optionA: 'The French Revolution',
    optionB: 'The American Civil War',
    correctOption: 'A',
  },
  {
    id: 'hist-locomotive-automobile',
    prompt: 'Which came first?',
    optionA: 'The steam locomotive',
    optionB: 'The automobile',
    correctOption: 'A',
  },
  {
    id: 'hist-moonlanding-web',
    prompt: 'Which came first?',
    optionA: 'The first Moon landing',
    optionB: 'The invention of the World Wide Web',
    correctOption: 'A',
  },
  {
    id: 'hist-pyramid-rome',
    prompt: 'Which came first?',
    optionA: 'The construction of the Great Pyramid of Giza',
    optionB: 'The founding of Rome',
    correctOption: 'A',
  },
  {
    id: 'hist-wright-wwi',
    prompt: 'Which came first?',
    optionA: 'The Wright brothers’ first powered flight',
    optionB: 'The start of World War I',
    correctOption: 'A',
  },
  {
    id: 'hist-titanic-wwi',
    prompt: 'Which came first?',
    optionA: 'The sinking of the Titanic',
    optionB: 'The start of World War I',
    correctOption: 'A',
  },

  // Biology
  {
    id: 'bio-elephant-rhino-weight',
    prompt: 'Which is heavier on average?',
    optionA: 'An African elephant',
    optionB: 'A white rhinoceros',
    correctOption: 'A',
  },
  {
    id: 'bio-tortoise-human-lifespan',
    prompt: 'Which can live longer?',
    optionA: 'A giant tortoise',
    optionB: 'A human',
    correctOption: 'A',
  },
  {
    id: 'bio-cheetah-greyhound-speed',
    prompt: 'Which is faster at top speed?',
    optionA: 'A cheetah',
    optionB: 'A greyhound',
    correctOption: 'A',
  },
  {
    id: 'bio-bluewhale-whaleshark-size',
    prompt: 'Which is bigger overall?',
    optionA: 'A blue whale',
    optionB: 'A whale shark',
    correctOption: 'A',
  },
  {
    id: 'bio-elephant-human-gestation',
    prompt: 'Which has a longer pregnancy?',
    optionA: 'An elephant',
    optionB: 'A human',
    correctOption: 'A',
  },
  {
    id: 'bio-ostrich-albatross-flight',
    prompt: 'Which of these birds cannot fly?',
    optionA: 'The ostrich',
    optionB: 'The albatross',
    correctOption: 'A',
  },
  {
    id: 'bio-mamba-boa-venom',
    prompt: 'Which of these snakes is venomous?',
    optionA: 'The black mamba',
    optionB: 'The boa constrictor',
    correctOption: 'A',
  },

  // Physical science
  {
    id: 'phys-light-sound-speed',
    prompt: 'Which travels faster?',
    optionA: 'Light',
    optionB: 'Sound',
    correctOption: 'A',
  },
  {
    id: 'phys-water-ethanol-boiling',
    prompt: 'Which has a higher boiling point at sea level?',
    optionA: 'Water',
    optionB: 'Ethanol',
    correctOption: 'A',
  },
  {
    id: 'phys-lead-aluminum-density',
    prompt: 'Which metal is denser?',
    optionA: 'Lead',
    optionB: 'Aluminum',
    correctOption: 'A',
  },
  {
    id: 'phys-diamond-quartz-hardness',
    prompt: 'Which is harder?',
    optionA: 'Diamond',
    optionB: 'Quartz',
    correctOption: 'A',
  },
  {
    id: 'phys-dog-human-chromosomes',
    prompt: 'Which has more chromosomes?',
    optionA: 'A dog',
    optionB: 'A human',
    correctOption: 'A',
  },
  {
    id: 'phys-nitrogen-drygas-cold',
    prompt: 'Which is colder?',
    optionA: 'Liquid nitrogen',
    optionB: 'Dry ice',
    correctOption: 'A',
  },
];

/**
 * Draw `count` distinct items via Fisher-Yates. Throws if the bank is smaller
 * than requested — mirrors `sampleWordList` and `sampleHypothesisPrompts`.
 */
export function sampleCalibrationItems(
  rng: Rng,
  count: number = CALIBRATION_ITEMS_PER_RUN,
): CalibrationItem[] {
  if (CALIBRATION_ITEMS.length < count) {
    throw new RangeError(
      `calibration item bank has only ${CALIBRATION_ITEMS.length} entries, need ${count}`,
    );
  }
  const pool = [...CALIBRATION_ITEMS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

/** Whether the chosen option was correct — the only fact-lookup the module does. */
export function isCalibrationAnswerCorrect(
  item: CalibrationItem,
  chosen: CalibrationOption,
): boolean {
  return chosen === item.correctOption;
}

/**
 * Every item above is written with the correct answer as `optionA` — natural
 * for authoring, but it would make on-screen position a perfect tell if
 * rendered as written. `swapped` decides, per item per run, whether optionB
 * displays first; the screen renders purely from `displayFirst`/
 * `displaySecond` and never touches `optionA`/`optionB`/`correctOption`
 * directly, so there is nowhere left for the position cue to leak through.
 */
export interface CalibrationRunEntry {
  item: CalibrationItem;
  swapped: boolean;
  displayFirst: string;
  displaySecond: string;
}

export function generateCalibrationRun(
  rng: Rng,
  count: number = CALIBRATION_ITEMS_PER_RUN,
): CalibrationRunEntry[] {
  return sampleCalibrationItems(rng, count).map((item) => {
    const swapped = rng() < 0.5;
    return {
      item,
      swapped,
      displayFirst: swapped ? item.optionB : item.optionA,
      displaySecond: swapped ? item.optionA : item.optionB,
    };
  });
}

/** Maps which on-screen slot the user picked back to the item's own 'A'/'B'. */
export function resolveCalibrationChoice(
  entry: CalibrationRunEntry,
  picked: 'first' | 'second',
): CalibrationOption {
  const pickedIsA = picked === 'first' ? !entry.swapped : entry.swapped;
  return pickedIsA ? 'A' : 'B';
}
