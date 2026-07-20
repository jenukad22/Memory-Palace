import { describe, expect, it } from 'vitest';
import {
  composeScene,
  entriesForNumber,
  indexByNumber,
  pad2,
  splitSixDigits,
  validatePaoList,
  type PaoEntry,
} from './pao';

const entry = (n: number): PaoEntry => ({
  n,
  person: `P${n}`,
  action: `A${n}`,
  object: `O${n}`,
});

describe('pad2', () => {
  it('zero-pads a 0-99 number to two digits', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(7)).toBe('07');
    expect(pad2(42)).toBe('42');
    expect(pad2(99)).toBe('99');
  });

  it('rejects out-of-range and non-integer numbers', () => {
    expect(() => pad2(-1)).toThrow(RangeError);
    expect(() => pad2(100)).toThrow(RangeError);
    expect(() => pad2(3.5)).toThrow(RangeError);
  });
});

describe('splitSixDigits', () => {
  it('splits into three 2-digit pairs, preserving leading zeros', () => {
    expect(splitSixDigits('072315')).toEqual([7, 23, 15]);
    expect(splitSixDigits('000000')).toEqual([0, 0, 0]);
    expect(splitSixDigits('999999')).toEqual([99, 99, 99]);
  });

  it('rejects anything that is not exactly six digits', () => {
    expect(() => splitSixDigits('12345')).toThrow(RangeError);
    expect(() => splitSixDigits('1234567')).toThrow(RangeError);
    expect(() => splitSixDigits('12a456')).toThrow(RangeError);
  });
});

describe('composeScene', () => {
  it('takes Person of pair 1, Action of pair 2, Object of pair 3', () => {
    const scene = composeScene([entry(7), entry(23), entry(15)]);
    expect(scene).toEqual({ person: 'P7', action: 'A23', object: 'O15' });
  });
});

describe('entriesForNumber', () => {
  it('resolves a 6-digit number to its three entries in pair order', () => {
    const map = indexByNumber([entry(7), entry(23), entry(15)]);
    const resolved = entriesForNumber('072315', map).map((e) => e.n);
    expect(resolved).toEqual([7, 23, 15]);
  });

  it('throws when a pair has no authored entry', () => {
    const map = indexByNumber([entry(7), entry(23)]);
    expect(() => entriesForNumber('072315', map)).toThrow(/no PAO entry for 15/);
  });
});

describe('validatePaoList', () => {
  it('reports a full 00-99 list as complete', () => {
    const full = Array.from({ length: 100 }, (_, n) => entry(n));
    const status = validatePaoList(full);
    expect(status).toEqual({ complete: true, missing: [], duplicates: [], count: 100 });
  });

  it('lists missing numbers ascending and is incomplete', () => {
    const partial = [entry(0), entry(1), entry(99)];
    const status = validatePaoList(partial);
    expect(status.complete).toBe(false);
    expect(status.count).toBe(3);
    expect(status.missing[0]).toBe(2);
    expect(status.missing).toContain(98);
    expect(status.missing).not.toContain(99);
    expect(status.missing).toHaveLength(97);
  });

  it('flags duplicates and ignores out-of-range numbers', () => {
    const status = validatePaoList([entry(5), entry(5), { ...entry(200) }]);
    expect(status.duplicates).toEqual([5]);
    expect(status.count).toBe(1); // only the in-range 5 counts
    expect(status.complete).toBe(false);
  });
});
