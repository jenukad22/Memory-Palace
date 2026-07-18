import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface CardState {
  due: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  phase: CardPhase;
  scheduledDays: number;
  learningSteps: number;
  lastReview: Date | null;
}

export interface SchedulerConfig {
  /** Target probability of recall at the moment a card comes due. Must be in (0, 1). */
  desiredRetention?: number;
}

export const DEFAULT_DESIRED_RETENTION = 0.9;

const GRADE_BY_RATING: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const PHASE_BY_STATE: Record<State, CardPhase> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STATE_BY_PHASE: Record<CardPhase, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

function makeScheduler(config?: SchedulerConfig) {
  const desiredRetention = config?.desiredRetention ?? DEFAULT_DESIRED_RETENTION;
  if (!(desiredRetention > 0 && desiredRetention < 1)) {
    throw new RangeError(`desiredRetention must be in (0, 1), got ${desiredRetention}`);
  }
  return fsrs(generatorParameters({ request_retention: desiredRetention, enable_fuzz: false }));
}

function toCard(state: CardState): Card {
  return {
    due: new Date(state.due.getTime()),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: 0,
    scheduled_days: state.scheduledDays,
    reps: state.reps,
    lapses: state.lapses,
    learning_steps: state.learningSteps,
    state: STATE_BY_PHASE[state.phase],
    ...(state.lastReview ? { last_review: new Date(state.lastReview.getTime()) } : {}),
  };
}

function fromCard(card: Card): CardState {
  return {
    due: new Date(card.due.getTime()),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    phase: PHASE_BY_STATE[card.state],
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    lastReview: card.last_review ? new Date(card.last_review.getTime()) : null,
  };
}

export function createEmptyCardState(now: Date): CardState {
  return fromCard(createEmptyCard(new Date(now.getTime())));
}

export function schedule(
  card: CardState,
  rating: ReviewRating,
  now: Date,
  config?: SchedulerConfig,
): CardState {
  const scheduler = makeScheduler(config);
  const result = scheduler.next(toCard(card), new Date(now.getTime()), GRADE_BY_RATING[rating]);
  return fromCard(result.card);
}

export function getRetrievability(card: CardState, now: Date, config?: SchedulerConfig): number {
  const scheduler = makeScheduler(config);
  return scheduler.get_retrievability(toCard(card), new Date(now.getTime()), false);
}
