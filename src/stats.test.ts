import { describe, it, expect } from 'vitest';
import { avgSolve, secLabel } from './stats';

describe('avg solve (v0.3.1)', () => {
  it('averages per solve, not per round time', () => {
    expect(avgSolve([1200, 1500, 2100])).toBe(1600);
    expect(secLabel(avgSolve([1200, 1500, 2100]))).toBe('1.6s');
  });
  it('3 solves in an 8 s round are not 0.0s', () => { expect(secLabel(avgSolve([2100, 1800, 2400]))).toBe('2.1s'); });
  it('no solves: dash', () => { expect(avgSolve([])).toBeNull(); expect(secLabel(null)).toBe('—'); });
  it('ignores junk entries', () => { expect(avgSolve([1000, NaN, -5, 3000])).toBe(2000); });
});
