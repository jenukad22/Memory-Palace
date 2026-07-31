import { describe, expect, it } from 'vitest';
import { criterion, dPrime, loglinearRates, maxDPrime, probit } from './signalDetection';

describe('probit', () => {
  it('matches known normal quantiles', () => {
    expect(probit(0.5)).toBeCloseTo(0, 9);
    expect(probit(0.975)).toBeCloseTo(1.959963985, 6);
    expect(probit(0.025)).toBeCloseTo(-1.959963985, 6);
    expect(probit(0.8413447461)).toBeCloseTo(1, 5);
    expect(probit(0.1586552539)).toBeCloseTo(-1, 5);
    expect(probit(0.998650102)).toBeCloseTo(3, 5);
  });

  it('is symmetric about 0.5', () => {
    for (const p of [0.001, 0.01, 0.2, 0.35, 0.49]) {
      expect(probit(p)).toBeCloseTo(-probit(1 - p), 6);
    }
  });

  it('is monotonically increasing', () => {
    const ps = [0.001, 0.01, 0.05, 0.2, 0.5, 0.8, 0.95, 0.99, 0.999];
    const zs = ps.map(probit);
    for (let i = 1; i < zs.length; i += 1) expect(zs[i]!).toBeGreaterThan(zs[i - 1]!);
  });

  it('stays accurate across the tail-approximation boundaries', () => {
    for (const p of [0.02424, 0.02425, 0.02426, 0.97574, 0.97575, 0.97576]) {
      const z = probit(p);
      expect(Number.isFinite(z)).toBe(true);
      // continuity: neighbouring p values must not jump
      expect(Math.abs(z - probit(p + 1e-6))).toBeLessThan(1e-4);
    }
  });

  it('rejects probabilities outside the open interval', () => {
    for (const p of [0, 1, -0.1, 1.1, Number.NaN]) {
      expect(() => probit(p)).toThrow(RangeError);
    }
  });
});

describe('loglinearRates', () => {
  it('adds 0.5 to each count and 1 to each total', () => {
    const r = loglinearRates({ hits: 9, signals: 10, falseAlarms: 1, noise: 10 });
    expect(r.hitRate).toBeCloseTo(9.5 / 11, 10);
    expect(r.falseAlarmRate).toBeCloseTo(1.5 / 11, 10);
  });

  it('keeps a perfect run strictly inside (0, 1)', () => {
    const r = loglinearRates({ hits: 90, signals: 90, falseAlarms: 0, noise: 30 });
    expect(r.hitRate).toBeLessThan(1);
    expect(r.falseAlarmRate).toBeGreaterThan(0);
  });
});

describe('dPrime', () => {
  it('is finite at ceiling and at floor', () => {
    expect(Number.isFinite(dPrime({ hits: 90, signals: 90, falseAlarms: 0, noise: 30 }))).toBe(
      true,
    );
    expect(Number.isFinite(dPrime({ hits: 0, signals: 90, falseAlarms: 30, noise: 30 }))).toBe(
      true,
    );
  });

  it('is exactly zero for an indiscriminate responder at equal trial counts', () => {
    expect(dPrime({ hits: 30, signals: 30, falseAlarms: 30, noise: 30 })).toBeCloseTo(0, 10);
    expect(dPrime({ hits: 0, signals: 30, falseAlarms: 0, noise: 30 })).toBeCloseTo(0, 10);
  });

  it('is zero for a coin flip even at unequal trial counts', () => {
    expect(dPrime({ hits: 45, signals: 90, falseAlarms: 15, noise: 30 })).toBeCloseTo(0, 10);
  });

  it('leaves a small documented residual at unequal counts, signed by the bias', () => {
    // The loglinear correction is unbiased only at equal N. At the CPT's 90/30
    // split an all-press run reads +0.40 and an all-withhold run −0.40 — 8.6% of
    // the ceiling, not zero. Asserted so the residual cannot drift unnoticed.
    const ceiling = maxDPrime(90, 30);
    const allPress = dPrime({ hits: 90, signals: 90, falseAlarms: 30, noise: 30 });
    const allWithhold = dPrime({ hits: 0, signals: 90, falseAlarms: 0, noise: 30 });
    expect(allPress).toBeCloseTo(0.4018, 3);
    expect(allWithhold).toBeCloseTo(-allPress, 10);
    expect(Math.abs(allPress) / ceiling).toBeLessThan(0.1);
  });

  it('rises as commissions fall at a fixed hit rate', () => {
    const withdrawing = dPrime({ hits: 85, signals: 90, falseAlarms: 2, noise: 30 });
    const pressing = dPrime({ hits: 85, signals: 90, falseAlarms: 15, noise: 30 });
    expect(withdrawing).toBeGreaterThan(pressing);
  });

  it('rises as omissions fall at a fixed commission rate', () => {
    const attentive = dPrime({ hits: 88, signals: 90, falseAlarms: 5, noise: 30 });
    const missing = dPrime({ hits: 60, signals: 90, falseAlarms: 5, noise: 30 });
    expect(attentive).toBeGreaterThan(missing);
  });

  it('goes negative only when responding is inverted', () => {
    expect(dPrime({ hits: 10, signals: 90, falseAlarms: 28, noise: 30 })).toBeLessThan(0);
  });

  it('caps at maxDPrime for the trial structure', () => {
    const ceiling = maxDPrime(90, 30);
    expect(dPrime({ hits: 90, signals: 90, falseAlarms: 0, noise: 30 })).toBeCloseTo(ceiling, 10);
    expect(dPrime({ hits: 89, signals: 90, falseAlarms: 1, noise: 30 })).toBeLessThan(ceiling);
    expect(ceiling).toBeGreaterThan(3);
  });
});

describe('criterion', () => {
  it('is ~0 for a symmetric responder', () => {
    expect(criterion({ hits: 80, signals: 90, falseAlarms: 3, noise: 30 })).toBeGreaterThan(-1);
  });

  it('is negative when the responder presses readily and positive when it withholds', () => {
    const liberal = criterion({ hits: 90, signals: 90, falseAlarms: 25, noise: 30 });
    const conservative = criterion({ hits: 40, signals: 90, falseAlarms: 0, noise: 30 });
    expect(liberal).toBeLessThan(0);
    expect(conservative).toBeGreaterThan(0);
  });
});
