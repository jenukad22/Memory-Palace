import type { Card } from 'ts-fsrs';
import type { CardState } from '@/engine';

/**
 * Compile-time guards binding our persisted CardState to the installed ts-fsrs
 * `Card`. Verified against ts-fsrs 5.4.1: Card = { due, stability, difficulty,
 * elapsed_days (@deprecated, removed in 6.0), scheduled_days, learning_steps,
 * reps, lapses, state, last_review? }. Our CardState omits elapsed_days and
 * renames state -> phase; all other fields map 1:1.
 */

// (1) Renames/removals/type changes: if ts-fsrs drops or retypes any of these
// seven fields, this mapping stops compiling — a build break instead of silent
// schedule corruption. Deliberately excludes `elapsed_days` (deprecated, not
// persisted) and `state` (renamed to `phase`, covered by a runtime test).
const _cardStateToLibraryShape = (
  s: CardState,
): Pick<
  Card,
  'due' | 'stability' | 'difficulty' | 'reps' | 'lapses' | 'scheduled_days' | 'learning_steps'
> => ({
  due: s.due,
  stability: s.stability,
  difficulty: s.difficulty,
  reps: s.reps,
  lapses: s.lapses,
  scheduled_days: s.scheduledDays,
  learning_steps: s.learningSteps,
});
void _cardStateToLibraryShape;

// (2) Additions: the Pick above cannot catch a NEW required field the scheduler
// reads — round-trip would go lossy silently. This makes every Card key an
// explicit, consciously-triaged decision. If ts-fsrs adds a field, this fails to
// compile until it's added to KnownCardKeys (and, if the scheduler reads it,
// persisted in fsrs_state).
type KnownCardKeys =
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'reps'
  | 'lapses'
  | 'scheduled_days'
  | 'learning_steps'
  | 'state'
  | 'last_review'
  | 'elapsed_days';

type _UnhandledCardKeys = Exclude<keyof Card, KnownCardKeys>;
const _noUnhandledKeys: _UnhandledCardKeys extends never ? true : never = true;
void _noUnhandledKeys;
