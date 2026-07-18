import { createCard, getCard } from './queries/cards';
import type { Db } from './types';

const DEMO_CARDS = [
  {
    id: 'demo-mem-001',
    module: 'memory',
    front: 'Method of loci',
    back: 'A mnemonic that maps items to locations along a familiar route.',
  },
  {
    id: 'demo-mem-002',
    module: 'memory',
    front: 'Chunking',
    back: 'Grouping items into meaningful units to ease recall.',
  },
  {
    id: 'demo-mem-003',
    module: 'memory',
    front: 'Spaced repetition',
    back: 'Reviewing at increasing intervals to strengthen retention.',
  },
  {
    id: 'demo-mem-004',
    module: 'memory',
    front: 'Peg system',
    back: 'Associating items with a pre-memorized ordered list of pegs.',
  },
  {
    id: 'demo-mem-005',
    module: 'memory',
    front: 'Encoding specificity',
    back: 'Recall improves when retrieval cues match encoding cues.',
  },
] as const;

/** Inserts demo cards that don't already exist. Returns the count inserted. */
export function seedDemoCards(db: Db, now: Date = new Date()): number {
  let inserted = 0;
  for (const card of DEMO_CARDS) {
    if (getCard(db, card.id)) continue;
    createCard(db, {
      id: card.id,
      module: card.module,
      front: card.front,
      back: card.back,
      now,
    });
    inserted += 1;
  }
  return inserted;
}
