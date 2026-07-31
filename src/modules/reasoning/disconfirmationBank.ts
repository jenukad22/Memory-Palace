/**
 * Original claims for "what would disconfirm this?" (SPEC.md §2.3). Each
 * claim is shaped like a self-sealing explanation — plausible on the surface,
 * vulnerable to an obvious confound once you look for one. `examples` are
 * shown only after the user answers, for self-comparison (SPEC.md §0) — never
 * before, and never as an automatic grade.
 */

import type { Rng } from '@/engine';
import { DISCONFIRMATION_PROMPTS_PER_RUN } from '@/engine';

export interface DisconfirmationClaim {
  claim: string;
  examples: readonly string[];
}

export const DISCONFIRMATION_CLAIMS: readonly DisconfirmationClaim[] = [
  {
    claim: 'I started taking the supplement and my headaches went away, so the supplement works.',
    examples: [
      'Headaches also went away on a placebo, in a controlled comparison.',
      'The headaches were already trending down before starting it.',
      'Something else changed at the same time — sleep, stress, diet, weather.',
    ],
  },
  {
    claim: 'Our team hit its targets after the new manager took over, so the new manager is why.',
    examples: [
      'Targets were already on track to be hit before the change.',
      'A market-wide shift improved every team’s numbers that quarter.',
      'The team lost its hardest account around the same time, making targets easier.',
    ],
  },
  {
    claim: 'I wore my lucky socks and we won, so the socks helped.',
    examples: [
      'The team also wins a similar share of games without the socks.',
      'Wearing the socks on a losing day would break the pattern.',
      'The opponent that day was simply weaker.',
    ],
  },
  {
    claim: 'Sales went up right after we redesigned the website, so the redesign worked.',
    examples: [
      'Sales were already rising before the redesign launched.',
      'A seasonal spike (holidays, a sale) happened at the same time.',
      'A competitor raised its prices or went out of stock during that window.',
    ],
  },
  {
    claim: 'She meditates every morning and she is calm under pressure, so meditation causes it.',
    examples: [
      'She was already calm under pressure before she started meditating.',
      'People who are already calm are more likely to keep up a meditation habit.',
      'Something else in her routine changed at the same time.',
    ],
  },
  {
    claim:
      'The company switched to a four-day week and productivity rose, so the schedule change caused it.',
    examples: [
      'Productivity was already rising before the switch.',
      'A new tool or process was adopted around the same time.',
      'The measurement period included a naturally slow prior stretch, inflating the comparison.',
    ],
  },
  {
    claim:
      'I started reading before bed and I sleep better now, so reading caused the improvement.',
    examples: [
      'Sleep also improved on nights without reading, once a fixed bedtime was set.',
      'A stressful project ended around the same time.',
      'Screen use dropped at the same time reading started, which could be the real cause.',
    ],
  },
  {
    claim: 'The ad campaign ran and signups increased, so the campaign worked.',
    examples: [
      'Signups were already trending up before the campaign started.',
      'A competitor’s outage or price change pushed customers over at the same time.',
      'A different, unrelated feature launched in the same window.',
    ],
  },
  {
    claim: 'He takes vitamin C every day and rarely gets sick, so the vitamin C is why.',
    examples: [
      'He rarely got sick before he started taking it either.',
      'People who take daily vitamins tend to also sleep and eat differently.',
      'His exposure to sick people is simply lower than average.',
    ],
  },
  {
    claim:
      'We started the daily standup and the project shipped on time, so the standup caused it.',
    examples: [
      'The project was already on a healthy timeline before standups started.',
      'A team member who was blocking progress left around the same time.',
      'Scope was quietly cut at the same time standups began.',
    ],
  },
  {
    claim: 'I switched to a standing desk and my back pain improved, so the desk fixed it.',
    examples: [
      'Back pain naturally eases over the same timeframe for many people regardless of the desk.',
      'Physical therapy or exercise started around the same time.',
      'A different chair, mattress, or posture habit changed at the same time.',
    ],
  },
  {
    claim: 'The store played slower music and customers stayed longer, so the music caused it.',
    examples: [
      'It was a weekend or holiday with naturally longer visits, independent of the music.',
      'A sale or new product line ran during the same period.',
      'The weather kept people inside shopping longer that week.',
    ],
  },
  {
    claim: 'I stopped drinking coffee and my anxiety went down, so caffeine was the cause.',
    examples: [
      'Anxiety was already declining before cutting coffee, for unrelated reasons.',
      'A stressful situation resolved around the same time.',
      'Sleep or exercise habits changed at the same time.',
    ],
  },
  {
    claim:
      'The class switched to open-book tests and average scores rose, so open-book tests caused it.',
    examples: [
      'The test content also got easier at the same time.',
      'A stronger cohort of students happened to take the class that term.',
      'More study time was allotted before the test in the new format.',
    ],
  },
  {
    claim: 'I started using a to-do app and I get more done now, so the app is why.',
    examples: [
      'Workload happened to be lighter during the period being compared.',
      'A different, unrelated habit (earlier mornings, fewer meetings) also started then.',
      'Motivation was already rising for reasons unrelated to the app.',
    ],
  },
  {
    claim:
      'The garden did better after we started talking to the plants, so talking to them helped.',
    examples: [
      'Watering or sunlight also increased around the same time.',
      'The season simply turned more favorable for growth.',
      'A different plant food or soil change happened at the same time.',
    ],
  },
  {
    claim:
      'We moved the release date up and fewer bugs were reported, so the earlier date caused it.',
    examples: [
      'Fewer users tried the new release in that shorter window, so fewer bugs were found, not fewer existed.',
      'A testing process improved at the same time as the date change.',
      'The type of changes shipped that release happened to be lower-risk.',
    ],
  },
  {
    claim: 'I wore a red shirt to the interview and got the job, so the red shirt helped.',
    examples: [
      'Candidates in other colors get hired at a similar rate.',
      'The qualifications and interview answers were what mattered.',
      'The same candidate would likely have gotten the offer in any shirt.',
    ],
  },
];

/**
 * Draw `count` distinct claims via Fisher-Yates. Throws if the bank is
 * smaller than requested — mirrors `sampleHypothesisPrompts`.
 */
export function sampleDisconfirmationClaims(
  rng: Rng,
  count: number = DISCONFIRMATION_PROMPTS_PER_RUN,
): DisconfirmationClaim[] {
  if (DISCONFIRMATION_CLAIMS.length < count) {
    throw new RangeError(
      `disconfirmation claim bank has only ${DISCONFIRMATION_CLAIMS.length} entries, need ${count}`,
    );
  }
  const pool = [...DISCONFIRMATION_CLAIMS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}
