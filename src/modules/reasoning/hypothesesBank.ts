/**
 * Original prompts for the generate-multiple-hypotheses drill (SPEC.md §2.2).
 * Deliberately ambiguous, everyday observations broad enough that most people
 * can find several distinct explanations without specialist knowledge.
 */

import type { Rng } from '@/engine';
import { HYPOTHESES_PROMPTS_PER_RUN } from '@/engine';

export const HYPOTHESIS_PROMPTS: readonly string[] = [
  'Website signups dropped 30% this week.',
  'A coworker who is usually early has been arriving late all week.',
  'The office plant that was thriving is suddenly wilting.',
  'A friend liked your last three posts but has not replied to your message.',
  'Neighborhood cats keep avoiding one particular yard.',
  'Sales of the store’s best-selling item fell sharply last month.',
  'A usually reliable bus route has been running late every morning this week.',
  'Your phone’s battery is draining much faster than it used to.',
  'A recipe that always turns out well came out wrong this time.',
  'Attendance at the weekly team meeting has been shrinking for a month.',
  'A houseplant on the windowsill has started leaning sharply to one side.',
  'One employee’s error rate has crept up over the last few weeks.',
  'A popular restaurant near the office suddenly closed on a Tuesday.',
  'Your internet connection has been noticeably slower every evening.',
  'A student who usually does well failed the last two quizzes.',
  'A neighbor’s dog, normally quiet, has been barking every night this week.',
  'Customer complaints about a product doubled after a routine update.',
  'A friend who is usually punctual has been late to the last three plans.',
  'The number of typos in a coworker’s emails has increased lately.',
  'A well-reviewed app suddenly has a wave of one-star reviews.',
  'A car that always started fine is now slow to start on cold mornings.',
  'Foot traffic in one aisle of a store has dropped since last month.',
];

/**
 * Draw `count` distinct prompts via Fisher-Yates. Throws if the bank is
 * smaller than requested — silently returning fewer would understate what the
 * user was actually asked (mirrors `sampleWordList`).
 */
export function sampleHypothesisPrompts(
  rng: Rng,
  count: number = HYPOTHESES_PROMPTS_PER_RUN,
): string[] {
  if (HYPOTHESIS_PROMPTS.length < count) {
    throw new RangeError(
      `hypothesis prompt bank has only ${HYPOTHESIS_PROMPTS.length} entries, need ${count}`,
    );
  }
  const pool = [...HYPOTHESIS_PROMPTS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}
