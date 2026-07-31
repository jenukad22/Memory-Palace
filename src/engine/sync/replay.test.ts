import { describe, expect, it } from 'vitest';
import { createEmptyCardState, schedule } from '../fsrs';
import {
  cardStateDiffers,
  latestEloByModule,
  replayCardState,
  type AbilityLogEntry,
  type ReplayableReview,
} from './replay';

const CREATED = new Date('2026-07-01T00:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('replayCardState', () => {
  it('returns the empty state for a card with no reviews', () => {
    const replayed = replayCardState(CREATED, []);
    expect(replayed).toEqual(createEmptyCardState(CREATED));
  });

  it('matches applying schedule() directly, one review at a time', () => {
    const reviews: ReplayableReview[] = [
      { ts: at('2026-07-02T00:00:00.000Z'), rating: 'good' },
      { ts: at('2026-07-05T00:00:00.000Z'), rating: 'again' },
      { ts: at('2026-07-06T00:00:00.000Z'), rating: 'easy' },
    ];
    let expected = createEmptyCardState(CREATED);
    for (const r of reviews) expected = schedule(expected, r.rating, r.ts);

    expect(replayCardState(CREATED, reviews)).toEqual(expected);
  });

  it('sorts by timestamp — a merged history has no inherent order', () => {
    const inOrder: ReplayableReview[] = [
      { ts: at('2026-07-02T00:00:00.000Z'), rating: 'good' },
      { ts: at('2026-07-03T00:00:00.000Z'), rating: 'hard' },
      { ts: at('2026-07-04T00:00:00.000Z'), rating: 'good' },
    ];
    const shuffled = [inOrder[2]!, inOrder[0]!, inOrder[1]!];
    expect(replayCardState(CREATED, shuffled)).toEqual(replayCardState(CREATED, inOrder));
  });

  it('does not mutate the array it is given', () => {
    const reviews: ReplayableReview[] = [
      { ts: at('2026-07-04T00:00:00.000Z'), rating: 'good' },
      { ts: at('2026-07-02T00:00:00.000Z'), rating: 'good' },
    ];
    const snapshot = [...reviews];
    replayCardState(CREATED, reviews);
    expect(reviews).toEqual(snapshot);
  });

  it('accounts for BOTH devices’ reviews — the case last-writer-wins gets wrong', () => {
    // Device A reviewed at 10:00 offline; device B reviewed the same card at
    // 11:00 offline. Neither device's own final state saw the other's review.
    const deviceAOnly: ReplayableReview[] = [
      { ts: at('2026-07-02T10:00:00.000Z'), rating: 'good' },
    ];
    const deviceBOnly: ReplayableReview[] = [
      { ts: at('2026-07-02T11:00:00.000Z'), rating: 'again' },
    ];
    const merged = [...deviceAOnly, ...deviceBOnly];

    const replayed = replayCardState(CREATED, merged);
    const lwwWouldPick = replayCardState(CREATED, deviceBOnly); // B is later

    // The merged schedule differs from simply taking the later device's state,
    // which is exactly the correctness this strategy buys.
    expect(cardStateDiffers(replayed, lwwWouldPick)).toBe(true);
    expect(replayed.reps).toBe(2);
    expect(lwwWouldPick.reps).toBe(1);
  });

  it('is idempotent — replaying the same merged history twice agrees', () => {
    const reviews: ReplayableReview[] = [
      { ts: at('2026-07-02T00:00:00.000Z'), rating: 'good' },
      { ts: at('2026-07-09T00:00:00.000Z'), rating: 'good' },
    ];
    expect(replayCardState(CREATED, reviews)).toEqual(replayCardState(CREATED, reviews));
  });

  it('counts every review in reps, so no review is silently dropped', () => {
    const reviews: ReplayableReview[] = Array.from({ length: 6 }, (_, i) => ({
      ts: new Date(CREATED.getTime() + (i + 1) * 86_400_000),
      rating: 'good' as const,
    }));
    expect(replayCardState(CREATED, reviews).reps).toBe(6);
  });
});

describe('cardStateDiffers', () => {
  it('is false for a state compared with itself', () => {
    const s = createEmptyCardState(CREATED);
    expect(cardStateDiffers(s, s)).toBe(false);
  });

  it('is false for two independently built identical states', () => {
    expect(cardStateDiffers(createEmptyCardState(CREATED), createEmptyCardState(CREATED))).toBe(
      false,
    );
  });

  it('detects a scheduling change', () => {
    const before = createEmptyCardState(CREATED);
    const after = schedule(before, 'good', at('2026-07-02T00:00:00.000Z'));
    expect(cardStateDiffers(before, after)).toBe(true);
  });

  it('detects a lastReview change from null to a date', () => {
    const before = createEmptyCardState(CREATED);
    const after = { ...before, lastReview: CREATED };
    expect(cardStateDiffers(before, after)).toBe(true);
  });
});

describe('latestEloByModule', () => {
  const entry = (module: string, elo: number, iso: string): AbilityLogEntry => ({
    module,
    elo,
    ts: at(iso),
  });

  it('is empty for no entries', () => {
    expect(latestEloByModule([]).size).toBe(0);
  });

  it('takes the newest entry per module', () => {
    const latest = latestEloByModule([
      entry('memory', 1200, '2026-07-01T00:00:00.000Z'),
      entry('memory', 1300, '2026-07-05T00:00:00.000Z'),
      entry('attention', 1100, '2026-07-03T00:00:00.000Z'),
    ]);
    expect(latest.get('memory')!.elo).toBe(1300);
    expect(latest.get('attention')!.elo).toBe(1100);
  });

  it('does not depend on input order', () => {
    const entries = [
      entry('memory', 1300, '2026-07-05T00:00:00.000Z'),
      entry('memory', 1200, '2026-07-01T00:00:00.000Z'),
    ];
    expect(latestEloByModule(entries).get('memory')!.elo).toBe(1300);
    expect(latestEloByModule([...entries].reverse()).get('memory')!.elo).toBe(1300);
  });

  it('breaks an exact timestamp tie deterministically, so both devices agree', () => {
    const a = entry('memory', 1250, '2026-07-05T00:00:00.000Z');
    const b = entry('memory', 1400, '2026-07-05T00:00:00.000Z');
    expect(latestEloByModule([a, b]).get('memory')!.elo).toBe(1400);
    expect(latestEloByModule([b, a]).get('memory')!.elo).toBe(1400);
  });

  it('keeps modules independent', () => {
    const latest = latestEloByModule([
      entry('memory', 1500, '2026-07-09T00:00:00.000Z'),
      entry('reasoning', 900, '2026-07-01T00:00:00.000Z'),
    ]);
    expect(latest.size).toBe(2);
    expect(latest.get('reasoning')!.elo).toBe(900);
  });
});
