/**
 * Scenario prose for the base-rate items (SPEC.md §2.1, §6). The engine
 * (`engine/reasoning/baseRate.ts`) generates numbers against an opaque
 * `scenarioKey`; this file is the only place that turns a key into a sentence,
 * so it's the only place the copy-honesty scanner needs to watch for this task.
 */

import type { BaseRateItem, BaseRateScenarioKey } from '@/engine';

interface ScenarioCopy {
  /** e.g. "people in this group", "parts from this batch". */
  subject: string;
  /** e.g. "have the condition", "are defective". */
  haveCondition: string;
  /** e.g. "test positive", "get flagged as defective". */
  flagged: string;
}

const SCENARIO_COPY: Record<BaseRateScenarioKey, ScenarioCopy> = {
  medicalTest: {
    subject: 'people in this group',
    haveCondition: 'have the condition',
    flagged: 'test positive',
  },
  qualityControl: {
    subject: 'parts from this batch',
    haveCondition: 'are actually defective',
    flagged: 'get flagged as defective',
  },
  airportScanner: {
    subject: 'bags scanned today',
    haveCondition: 'actually contain a prohibited item',
    flagged: 'get flagged by the scanner',
  },
  spamFilter: {
    subject: 'emails received today',
    haveCondition: 'are actually spam',
    flagged: 'get marked as spam',
  },
  weatherAlert: {
    subject: 'days this season',
    haveCondition: 'have an actual severe-weather event',
    flagged: 'trigger a severe-weather alert',
  },
  plagiarismCheck: {
    subject: 'submissions checked this term',
    haveCondition: 'actually contain plagiarism',
    flagged: 'get flagged by the checker',
  },
};

export interface RenderedBaseRateItem {
  /** The scenario description, ending with the question. */
  promptText: string;
  /** Placeholder/label for the numeric input. */
  answerLabel: string;
  /** Upper bound the input should accept (100 for probability, totalPositives for frequency). */
  answerMax: number;
}

/** Turns a generated item into the sentence and question the screen shows. */
export function renderBaseRateItem(item: BaseRateItem): RenderedBaseRateItem {
  const c = SCENARIO_COPY[item.scenarioKey];

  if (item.format === 'probability') {
    return {
      promptText:
        `${item.prevalencePct}% of ${c.subject} ${c.haveCondition}. ` +
        `Of the ones that do, ${item.sensitivityPct}% ${c.flagged}. ` +
        `Of the ones that don't, ${item.falsePositiveRatePct}% also ${c.flagged}. ` +
        `If one of the ${c.subject} ${c.flagged}, what's the probability it actually ${c.haveCondition}?`,
      answerLabel: 'Your estimate (0–100%)',
      answerMax: 100,
    };
  }

  return {
    promptText:
      `Out of ${item.n} ${c.subject}, ${item.conditionCount} ${c.haveCondition}. ` +
      `Of those ${item.conditionCount}, about ${item.truePositives} ${c.flagged}. ` +
      `Of the other ${item.n - item.conditionCount}, about ${item.falsePositives} also ${c.flagged}. ` +
      `So ${item.totalPositives} ${c.subject} ${c.flagged} in total. ` +
      `Of those ${item.totalPositives}, how many actually ${c.haveCondition}?`,
    answerLabel: `Your estimate (0–${item.totalPositives})`,
    answerMax: item.totalPositives,
  };
}
