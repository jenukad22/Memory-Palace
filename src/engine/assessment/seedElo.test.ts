import { describe, expect, it } from 'vitest';
import { DEFAULT_K_FACTOR } from '../elo';
import {
  ELO_MAX,
  ELO_MIDPOINT,
  ELO_MIN,
  ELO_PER_SD,
  K_PROVISIONAL,
  PROVISIONAL_ITEMS,
  eloFromNormalized,
  moduleMean,
  provisionalK,
  seedModuleElo,
} from './seedElo';

describe('elo constants', () => {
  it('match the spec', () => {
    expect(ELO_MIDPOINT).toBe(1200);
    expect(ELO_PER_SD).toBe(200);
    expect(ELO_MIN).toBe(400);
    expect(ELO_MAX).toBe(2400);
  });
});

describe('eloFromNormalized', () => {
  it('maps z to midpoint + z*spread', () => {
    expect(eloFromNormalized(0)).toBe(1200);
    expect(eloFromNormalized(1)).toBe(1400);
    expect(eloFromNormalized(-1)).toBe(1000);
  });

  it('clamps to [ELO_MIN, ELO_MAX]', () => {
    expect(eloFromNormalized(10)).toBe(2400);
    expect(eloFromNormalized(-10)).toBe(400);
  });
});

describe('moduleMean', () => {
  it('averages the instrument scores', () => {
    expect(moduleMean([1, 2, 3, 4])).toBe(2.5);
    expect(moduleMean([0, 0, 0, 0])).toBe(0);
  });

  it('throws on an empty score set', () => {
    expect(() => moduleMean([])).toThrow();
  });
});

describe('seedModuleElo', () => {
  it('seeds from the mean of the instrument normalized scores', () => {
    expect(seedModuleElo([0, 0, 0, 0])).toBe(1200);
    expect(seedModuleElo([1, 1, 1, 1])).toBe(1400);
    expect(seedModuleElo([2, 0, 0, 0])).toBe(eloFromNormalized(0.5));
  });
});

describe('provisionalK', () => {
  it('uses the provisional K for the first M rated items, then the stable K', () => {
    expect(K_PROVISIONAL).toBe(48);
    expect(PROVISIONAL_ITEMS).toBe(30);
    expect(provisionalK(0)).toBe(48);
    expect(provisionalK(29)).toBe(48);
    expect(provisionalK(30)).toBe(DEFAULT_K_FACTOR); // 32
    expect(provisionalK(100)).toBe(32);
  });
});
