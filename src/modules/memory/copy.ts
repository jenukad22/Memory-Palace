import type { MemoryStrategy } from '@/engine';

/**
 * Encoding-instruction copy routed by the VVIQ strategy flag (SPEC.md §5,
 * mirrors assessment/vviq/strategyCopy.ts). Only the *encoding* instruction
 * changes — same loci, same cards, same schedule, same retrieval test. The
 * non-visual path never asks the user to "see" or "picture"; it anchors by
 * movement, order, and meaning. Copy never labels the user or implies a deficit.
 */
export interface EncodingCopy {
  /** Shown while placing a to-be-remembered item at a stop. */
  placePrompt: string;
  /** Shown while forming a PAO scene from a number. */
  paoScenePrompt: string;
}

export function encodingCopy(strategy: MemoryStrategy): EncodingCopy {
  if (strategy === 'visual') {
    return {
      placePrompt: 'Set a vivid scene at this stop — see the item here as clearly as you can.',
      paoScenePrompt:
        'Picture the Person doing the Action to the Object, together in one vivid scene.',
    };
  }
  return {
    placePrompt:
      'Anchor the item to this stop through movement and meaning — walk to it, name it, tie it to what is already there.',
    paoScenePrompt:
      'Chain the Person, Action, and Object in order through movement and meaning — narrate the link out loud.',
  };
}

/**
 * Retrieval-test copy is strategy-neutral: active retrieval works the same way
 * whichever encoding the user used. The answer is never shown before the attempt.
 */
export const RECALL_PROMPT = 'What did you place here? Retrieve it before revealing.';
export const PAO_RECALL_PROMPT = 'Recall this number as a scene, then reveal to check.';
