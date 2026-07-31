import { describe, expect, it } from 'vitest';
import { makeRng } from '../assessment/sequences';
import {
  classifyPvtPress,
  classifyPvtTrial,
  isPvtRunOver,
  nextIsiMs,
  rtForStats,
  scorePvt,
  type PvtTrial,
} from './pvt';
import {
  PVTB_DURATION_MS,
  PVTB_ISI_MAX_MS,
  PVTB_ISI_MIN_MS,
  PVTB_LAPSE_MS,
  PVTB_MAX_STIMULUS_MS,
} from './timing';

const responded = (rtMs: number): PvtTrial => ({ rtMs, preStimulus: false });
const noResponse: PvtTrial = { rtMs: null, preStimulus: false };
const preStimulus: PvtTrial = { rtMs: null, preStimulus: true };

describe('nextIsiMs', () => {
  it('stays inside the PVT-B interval', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 500; i += 1) {
      const isi = nextIsiMs(rng);
      expect(isi).toBeGreaterThanOrEqual(PVTB_ISI_MIN_MS);
      expect(isi).toBeLessThanOrEqual(PVTB_ISI_MAX_MS);
    }
  });

  it('is deterministic for a seed', () => {
    const run = (seed: number) => {
      const rng = makeRng(seed);
      return Array.from({ length: 20 }, () => nextIsiMs(rng));
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it('spreads across the interval rather than clustering', () => {
    const rng = makeRng(7);
    const isis = Array.from({ length: 400 }, () => nextIsiMs(rng));
    const mid = (PVTB_ISI_MIN_MS + PVTB_ISI_MAX_MS) / 2;
    const below = isis.filter((i) => i < mid).length;
    expect(below).toBeGreaterThan(120);
    expect(below).toBeLessThan(280);
    expect(new Set(isis).size).toBeGreaterThan(100);
  });
});

describe('isPvtRunOver', () => {
  it('ends at the task duration', () => {
    expect(isPvtRunOver(PVTB_DURATION_MS - 1)).toBe(false);
    expect(isPvtRunOver(PVTB_DURATION_MS)).toBe(true);
  });
});

describe('classifyPvtTrial', () => {
  it('calls a press during the interval a false start', () => {
    expect(classifyPvtTrial(preStimulus)).toBe('falseStart');
  });

  it('calls an anticipation under 100 ms a false start', () => {
    expect(classifyPvtTrial(responded(99))).toBe('falseStart');
    expect(classifyPvtTrial(responded(100))).not.toBe('falseStart');
  });

  it('calls 355 ms and above a lapse', () => {
    expect(classifyPvtTrial(responded(PVTB_LAPSE_MS - 1))).toBe('valid');
    expect(classifyPvtTrial(responded(PVTB_LAPSE_MS))).toBe('lapse');
    expect(classifyPvtTrial(responded(2000))).toBe('lapse');
  });

  it('calls a timed-out stimulus a non-response', () => {
    expect(classifyPvtTrial(noResponse)).toBe('noResponse');
  });
});

describe('classifyPvtPress', () => {
  it('ignores a press outside a trial', () => {
    expect(classifyPvtPress('inactive', 5000, 4000)).toEqual({ kind: 'ignored' });
  });

  it('records a press during the interval as a false start', () => {
    expect(classifyPvtPress('interval', 5000, null)).toEqual({
      kind: 'trial',
      trial: { rtMs: null, preStimulus: true },
    });
  });

  it('times a response from the painted frame, not from the request', () => {
    // Requested at 4000, painted at 4030 (30 ms of render latency), pressed at
    // 4280. The reaction time is 250 ms, not 280 — the latency is not the user's.
    expect(classifyPvtPress('stimulus', 4280, 4030)).toEqual({
      kind: 'trial',
      trial: { rtMs: 250, preStimulus: false },
    });
  });

  it('treats a press before the stimulus frame painted as a false start, not a fast reaction', () => {
    // This is the case that must never invent an RT out of render latency.
    expect(classifyPvtPress('stimulus', 4010, null)).toEqual({
      kind: 'trial',
      trial: { rtMs: null, preStimulus: true },
    });
  });

  it('feeds straight into the scorer as an excluded trial', () => {
    const press = classifyPvtPress('stimulus', 4010, null);
    const trial = press.kind === 'trial' ? press.trial : null;
    expect(trial).not.toBeNull();
    expect(scorePvt([trial!]).falseStarts).toBe(1);
    expect(scorePvt([trial!]).responseSpeed).toBeNull();
  });
});

describe('rtForStats', () => {
  it('excludes false starts', () => {
    expect(rtForStats(preStimulus)).toBeNull();
    expect(rtForStats(responded(50))).toBeNull();
  });

  it('imputes a non-response at the stimulus timeout instead of dropping it', () => {
    expect(rtForStats(noResponse)).toBe(PVTB_MAX_STIMULUS_MS);
  });

  it('keeps lapses in the statistics', () => {
    expect(rtForStats(responded(900))).toBe(900);
  });
});

describe('scorePvt', () => {
  it('returns nulls, not NaNs, for a run with nothing scorable', () => {
    const m = scorePvt([preStimulus, preStimulus]);
    expect(m.trials).toBe(2);
    expect(m.scoredTrials).toBe(0);
    expect(m.falseStarts).toBe(2);
    expect(m.falseStartRate).toBe(1);
    expect(m.responseSpeed).toBeNull();
    expect(m.meanRtMs).toBeNull();
    expect(m.medianRtMs).toBeNull();
    expect(m.lapseRate).toBeNull();
  });

  it('returns nulls for an empty run', () => {
    const m = scorePvt([]);
    expect(m.trials).toBe(0);
    expect(m.falseStartRate).toBeNull();
    expect(m.responseSpeed).toBeNull();
  });

  it('reports response speed as the mean of 1/RT in responses per second', () => {
    const m = scorePvt([responded(250), responded(500)]);
    // mean(1000/250, 1000/500) = mean(4, 2) = 3
    expect(m.responseSpeed).toBeCloseTo(3, 10);
  });

  it('counts and rates lapses over scored trials', () => {
    const m = scorePvt([responded(200), responded(300), responded(400), responded(600)]);
    expect(m.lapses).toBe(2);
    expect(m.validTrials).toBe(2);
    expect(m.lapseRate).toBeCloseTo(0.5, 10);
  });

  it('keeps false starts out of the RT statistics but in the counts', () => {
    const withFalseStarts = scorePvt([responded(250), responded(30), preStimulus]);
    const withoutFalseStarts = scorePvt([responded(250)]);
    expect(withFalseStarts.responseSpeed).toBeCloseTo(withoutFalseStarts.responseSpeed!, 10);
    expect(withFalseStarts.meanRtMs).toBe(250);
    expect(withFalseStarts.falseStarts).toBe(2);
    expect(withFalseStarts.falseStartRate).toBeCloseTo(2 / 3, 10);
    expect(withFalseStarts.scoredTrials).toBe(1);
  });

  it('penalizes a run that stopped responding rather than ignoring it', () => {
    const attended = scorePvt([responded(250), responded(260), responded(255)]);
    const abandoned = scorePvt([responded(250), noResponse, noResponse]);
    expect(abandoned.responseSpeed!).toBeLessThan(attended.responseSpeed!);
    expect(abandoned.noResponses).toBe(2);
    expect(abandoned.scoredTrials).toBe(3);
  });

  it('reports mean and median RT', () => {
    const m = scorePvt([responded(200), responded(300), responded(1000)]);
    expect(m.medianRtMs).toBe(300);
    expect(m.meanRtMs).toBeCloseTo(500, 10);
  });

  it('reports the fastest and slowest tenths', () => {
    const rts = [200, 210, 220, 230, 240, 250, 260, 270, 280, 900];
    const m = scorePvt(rts.map(responded));
    expect(m.fastest10PctMeanRtMs).toBe(200);
    expect(m.slowest10PctMeanRtMs).toBe(900);
    expect(m.slowest10PctMeanRtMs!).toBeGreaterThan(m.medianRtMs!);
  });

  it('uses at least one trial per tail on short runs', () => {
    const m = scorePvt([responded(200), responded(400)]);
    expect(m.fastest10PctMeanRtMs).toBe(200);
    expect(m.slowest10PctMeanRtMs).toBe(400);
  });

  it('is order-independent', () => {
    const trials = [responded(600), preStimulus, responded(200), noResponse, responded(300)];
    const shuffled = [responded(300), responded(200), noResponse, responded(600), preStimulus];
    expect(scorePvt(trials)).toEqual(scorePvt(shuffled));
  });

  it('makes a slower run score lower on the primary metric', () => {
    const fast = scorePvt([responded(230), responded(240), responded(250)]);
    const slow = scorePvt([responded(430), responded(440), responded(450)]);
    expect(fast.responseSpeed!).toBeGreaterThan(slow.responseSpeed!);
    expect(slow.lapses).toBe(3);
  });
});
