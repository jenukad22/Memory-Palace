import { describe, expect, it } from 'vitest';
import {
  CORSI_GAP_MS,
  CORSI_ON_MS,
  DIGIT_GAP_MS,
  DIGIT_ON_MS,
  FREE_RECALL_GAP_MS,
  FREE_RECALL_WORD_ON_MS,
} from './timing';

describe('stimulus timing (SPEC.md sec 4-5)', () => {
  it('digit: 800 ms on + 200 ms gap (~1 digit/sec)', () => {
    expect(DIGIT_ON_MS).toBe(800);
    expect(DIGIT_GAP_MS).toBe(200);
    expect(DIGIT_ON_MS + DIGIT_GAP_MS).toBe(1000);
  });

  it('corsi: 1000 ms on + 250 ms gap', () => {
    expect(CORSI_ON_MS).toBe(1000);
    expect(CORSI_GAP_MS).toBe(250);
  });

  it('free recall: 3000 ms on + 200 ms gap (modules/memory/SPEC.md sec 7.3)', () => {
    expect(FREE_RECALL_WORD_ON_MS).toBe(3000);
    expect(FREE_RECALL_GAP_MS).toBe(200);
  });
});
