import { describe, expect, it } from 'vitest';
import { createEmptyCardState, getRetrievability, schedule, type CardState } from './fsrs';
import { moduleRetrievabilityCurve } from './retention';

const NOW = new Date('2026-07-18T09:00:00.000Z');

/** Drive a fresh card into the long-term review phase with three spaced 'good' reviews. */
function matureCard(): { card: CardState; now: Date } {
  let card = schedule(createEmptyCardState(NOW), 'good', NOW);
  let now = card.due;
  card = schedule(card, 'good', now);
  now = card.due;
  card = schedule(card, 'good', now);
  return { card, now };
}

describe('moduleRetrievabilityCurve', () => {
  it('returns [] for no cards', () => {
    expect(moduleRetrievabilityCurve([], NOW)).toEqual([]);
  });

  it('returns [] when every card is still "new" (no retention signal yet)', () => {
    const fresh = createEmptyCardState(NOW);
    expect(moduleRetrievabilityCurve([fresh], NOW)).toEqual([]);
  });

  it('matches getRetrievability directly for a single reviewed card', () => {
    const { card, now } = matureCard();
    const curve = moduleRetrievabilityCurve([card], now, 10, 5);
    expect(curve).toEqual([
      { daysFromNow: 0, retrievability: getRetrievability(card, now) },
      {
        daysFromNow: 5,
        retrievability: getRetrievability(card, new Date(now.getTime() + 5 * 86_400_000)),
      },
      {
        daysFromNow: 10,
        retrievability: getRetrievability(card, new Date(now.getTime() + 10 * 86_400_000)),
      },
    ]);
  });

  it('averages across multiple reviewed cards and excludes new ones', () => {
    const { card: reviewed } = matureCard();
    const fresh = createEmptyCardState(NOW);
    const curve = moduleRetrievabilityCurve([reviewed, fresh], NOW, 0, 1);
    expect(curve).toHaveLength(1);
    expect(curve[0]!.retrievability).toBeCloseTo(getRetrievability(reviewed, NOW));
  });

  it('produces horizonDays/stepDays + 1 points and a non-increasing curve for one card', () => {
    const { card, now } = matureCard();
    const curve = moduleRetrievabilityCurve([card], now, 30, 1);
    expect(curve).toHaveLength(31);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.retrievability).toBeLessThanOrEqual(curve[i - 1]!.retrievability);
    }
  });
});
