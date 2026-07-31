import { describe, expect, it } from 'vitest';
import {
  CPT_BLANK_MS,
  CPT_DISTRACTOR_RATE,
  CPT_RESPONSE_WINDOW_MS,
  CPT_STIMULUS_MS,
  CPT_TRIALS,
  FLICKER_BLANK_MS,
  FLICKER_CYCLE_MS,
  FLICKER_SCENE_MS,
  FLICKER_TIMEOUT_MS,
  PVTB_DURATION_MS,
  PVTB_FALSE_START_MS,
  PVTB_ISI_MAX_MS,
  PVTB_ISI_MIN_MS,
  PVTB_LAPSE_MS,
  PVTB_MAX_STIMULUS_MS,
  flickerCycles,
} from './timing';

describe('PVT-B constants (SPEC §4.1)', () => {
  it('runs for three minutes', () => {
    expect(PVTB_DURATION_MS).toBe(3 * 60 * 1000);
  });

  it('uses the PVT-B 1-4 s interval, not the 10-minute PVT interval (SPEC §1)', () => {
    expect(PVTB_ISI_MIN_MS).toBe(1000);
    expect(PVTB_ISI_MAX_MS).toBe(4000);
  });

  it('collects enough trials in one run for the metrics to rest on', () => {
    const meanIsi = (PVTB_ISI_MIN_MS + PVTB_ISI_MAX_MS) / 2;
    const meanTrialMs = meanIsi + 300; // a typical response plus its readout
    expect(PVTB_DURATION_MS / meanTrialMs).toBeGreaterThan(50);
  });

  it('keeps the lapse threshold at 355 ms, above the false-start floor', () => {
    expect(PVTB_LAPSE_MS).toBe(355);
    expect(PVTB_FALSE_START_MS).toBeLessThan(PVTB_LAPSE_MS);
  });

  it('times a stimulus out well past the lapse threshold', () => {
    expect(PVTB_MAX_STIMULUS_MS).toBeGreaterThan(PVTB_LAPSE_MS);
  });
});

describe('CPT constants (SPEC §4.2)', () => {
  it('accepts responses through the stimulus and the blank after it', () => {
    expect(CPT_RESPONSE_WINDOW_MS).toBe(CPT_STIMULUS_MS + CPT_BLANK_MS);
  });

  it('leaves enough no-go trials to estimate a commission rate', () => {
    expect(Math.round(CPT_TRIALS * CPT_DISTRACTOR_RATE)).toBeGreaterThanOrEqual(25);
  });

  it('keeps the go response prepotent — most trials are targets', () => {
    expect(CPT_DISTRACTOR_RATE).toBeLessThan(0.5);
  });
});

describe('flicker constants (SPEC §4.3)', () => {
  it('cycles A -> blank -> A-prime -> blank', () => {
    expect(FLICKER_CYCLE_MS).toBe((FLICKER_SCENE_MS + FLICKER_BLANK_MS) * 2);
  });

  it('blanks briefly enough to mask the change but long enough to interrupt it', () => {
    expect(FLICKER_BLANK_MS).toBeGreaterThan(0);
    expect(FLICKER_BLANK_MS).toBeLessThan(FLICKER_SCENE_MS);
  });

  it('allows many alternations before the timeout', () => {
    expect(flickerCycles(FLICKER_TIMEOUT_MS)).toBeGreaterThan(20);
  });

  it('counts whole alternations only, and never a negative one', () => {
    expect(flickerCycles(0)).toBe(0);
    expect(flickerCycles(FLICKER_CYCLE_MS - 1)).toBe(0);
    expect(flickerCycles(FLICKER_CYCLE_MS)).toBe(1);
    expect(flickerCycles(FLICKER_CYCLE_MS * 2.9)).toBe(2);
    expect(flickerCycles(-500)).toBe(0);
  });
});
