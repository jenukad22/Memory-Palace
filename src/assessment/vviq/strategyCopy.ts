import type { MemoryStrategy } from '../../engine/assessment';

/**
 * Instructional copy per encoding strategy (SPEC.md sec 8). The non-visual
 * path swaps the encoding instructions only — same cards, same schedule.
 * Copy must never label the user or imply a deficit: it reads as "we'll use
 * a strategy that fits how you think."
 */

export const STRATEGY_FIT_LINE = 'We use the strategy that fits how you think.';

export interface StrategyCopy {
  heading: string;
  body: string;
}

export function strategyCopy(strategy: MemoryStrategy): StrategyCopy {
  if (strategy === 'visual') {
    return {
      heading: 'Your training path: scene imagery',
      body:
        'You will build memory palaces by picturing places along a familiar route ' +
        'and setting a vivid scene at each stop.',
    };
  }
  return {
    heading: 'Your training path: route and meaning',
    body:
      'You will build memory palaces by walking a familiar route in your mind — ' +
      'anchoring each stop through movement, order, and meaning rather than pictures. ' +
      'Same cards, same schedule.',
  };
}
