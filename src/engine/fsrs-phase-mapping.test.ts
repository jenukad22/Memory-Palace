import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { createEmptyCardState, schedule, type CardPhase, type CardState } from './fsrs';

// The wrapper renames ts-fsrs's numeric `Card.state` enum (New=0 … Relearning=3)
// to our string `phase`. That enum<->string mapping is a silent corruption point
// exactly like the rating<->Grade mapping: an off-by-one feeds FSRS the wrong
// state and corrupts scheduling. These tests pin it against raw ts-fsrs.

const PHASE_FOR_STATE: Record<State, CardPhase> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};
const STATE_FOR_PHASE: Record<CardPhase, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const ALL_PHASES: CardPhase[] = ['new', 'learning', 'review', 'relearning'];

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));
const now = new Date('2026-07-18T00:00:00.000Z');
const lastReview = new Date('2026-07-17T00:00:00.000Z');

describe('phase <-> ts-fsrs State mapping', () => {
  it('is bidirectional for all four values (checked against raw ts-fsrs)', () => {
    for (const phase of ALL_PHASES) {
      const state: CardState = {
        due: now,
        stability: 10,
        difficulty: 5,
        reps: 3,
        lapses: 1,
        phase,
        scheduledDays: 5,
        learningSteps: 0,
        lastReview: phase === 'new' ? null : lastReview,
      };
      const libCard: Card = {
        due: now,
        stability: 10,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 5,
        learning_steps: 0,
        reps: 3,
        lapses: 1,
        state: STATE_FOR_PHASE[phase],
        ...(phase === 'new' ? {} : { last_review: lastReview }),
      };

      const ours = schedule(state, 'good', now);
      const lib = scheduler.next(libCard, now, Rating.Good).card;

      // Output direction (State -> phase): our label matches the library's state.
      expect(ours.phase).toBe(PHASE_FOR_STATE[lib.state]);
      // Input direction (phase -> State): we fed FSRS the right state, so the
      // scheduling outputs agree. A mis-mapped input would diverge here.
      expect(ours.due.getTime()).toBe(lib.due.getTime());
      expect(ours.stability).toBeCloseTo(lib.stability, 10);
      expect(ours.difficulty).toBeCloseTo(lib.difficulty, 10);
    }
  });

  it('maps an empty card to phase "new" (State.New)', () => {
    expect(createEmptyCardState(now).phase).toBe('new');
    expect(PHASE_FOR_STATE[createEmptyCard(now).state]).toBe('new');
  });
});
