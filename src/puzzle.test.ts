import { describe, it, expect } from 'vitest';
import { generate, isValid, sums, sumKey, sumCount, sumPool, supports, shapesFor, CAP, LEVELS, type Level } from './puzzle';

const NS = [4, 5, 6, 7];
/** brute force: which numbers are the sum of two other distinct numbers, and in how many ways? */
function solutions(nums: number[]) {
  const out: string[] = [];
  nums.forEach((x, i) => nums.forEach((y, j) => nums.forEach((z, k) => { if (i !== j && i !== k && j < k && y + z === x) out.push(`${Math.min(y, z)}+${Math.max(y, z)}=${x}`); })));
  return out;
}
const PER = 3000;

describe('levels', () => {
  it('caps are 10 / 20 / 50', () => { expect(CAP).toEqual({ easy: 10, medium: 20, hard: 50 }); });
  it('Easy (cap 10) supports 4 and 5 numbers only: 6 numbers have 5 boards in total, 7 have none', () => {
    expect(shapesFor('easy')).toEqual([4, 5]);
    expect(shapesFor('medium')).toEqual(NS); expect(shapesFor('hard')).toEqual(NS);
    expect(sumCount(6, 'easy')).toBe(3); expect(sumCount(7, 'easy')).toBe(0);
    expect(() => generate(7, Math.random, undefined, 'easy')).toThrow();
  });
  it('sum pools: Easy 20 sums, Medium 90, Hard 600 (every pair of distinct parts with a + b <= cap)', () => {
    for (const n of [4, 5]) expect(sumCount(n, 'easy')).toBe(20);
    for (const n of NS) { expect(sumCount(n, 'medium')).toBe(90); expect(sumCount(n, 'hard')).toBe(600); }
  });
});

describe('generate: cap, exactly one solution', () => {
  for (const lv of LEVELS) for (const n of NS) {
    if (!supports(n, lv)) continue;
    it(`${lv} n=${n}: ${PER} puzzles, every number 1..${CAP[lv]}, distinct, exactly one solution`, () => {
      let answerIsMax = 0;
      const keys = new Set<string>();
      for (let t = 0; t < PER; t++) {
        const p = generate(n, Math.random, undefined, lv);
        expect(p.nums).toHaveLength(n);
        expect(new Set(p.nums).size).toBe(n);
        for (const v of p.nums) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(CAP[lv]); }
        expect(p.answer).toBeLessThanOrEqual(CAP[lv]);
        expect(solutions(p.nums)).toEqual([`${p.a}+${p.b}=${p.answer}`]);
        expect(sums(p.nums)).toHaveLength(1);
        expect(p.a + p.b).toBe(p.answer); expect(p.a).toBeLessThan(p.b); expect(p.a).toBeGreaterThanOrEqual(1);
        expect(isValid(p.nums)).toBe(true);
        if (p.answer === Math.max(...p.nums)) answerIsMax++;
        keys.add(sumKey(p.a, p.b));
      }
      // varied: most of the pool shows up, and the answer is not simply always the biggest number
      expect(keys.size).toBeGreaterThan(Math.min(sumCount(n, lv), PER) * 0.8);
      expect(answerIsMax / PER).toBeLessThan(0.9);
      console.log(`${lv} n=${n}: answer is the largest number in ${(100 * answerIsMax / PER).toFixed(1)}%, ${keys.size}/${sumCount(n, lv)} sums seen`);
    });
  }
  it('every Hard sum can be built for every board size (no hang)', () => {
    for (const n of NS) for (const k of sumPool(n, 'hard')) {
      const seen = new Set(sumPool(n, 'hard').filter(x => x !== k));
      const p = generate(n, Math.random, seen, 'hard');
      expect(sumKey(p.a, p.b)).toBe(k); expect(isValid(p.nums)).toBe(true); expect(Math.max(...p.nums)).toBeLessThanOrEqual(50);
    }
  });
  it('isValid rejects duplicates and multiple answers', () => {
    expect(isValid([1, 2, 3, 10])).toBe(true);
    expect(isValid([1, 2, 3, 3])).toBe(false);
    expect(isValid([1, 2, 3, 5])).toBe(false); // 3 = 1+2 and 5 = 2+3
    expect(isValid([1, 4, 5, 3])).toBe(false); // 5 = 1+4 and 4 = 1+3
  });
});

describe('no repeated sums within a round', () => {
  const ROUNDS = 20;
  for (const lv of LEVELS) for (const n of NS) {
    if (!supports(n, lv)) continue;
    const LEN = Math.min(150, sumCount(n, lv));
    it(`${lv} n=${n}: ${ROUNDS} rounds x ${LEN} puzzles, no sum repeats (${sumCount(n, lv)} possible)`, () => {
      for (let r = 0; r < ROUNDS; r++) {
        const seen = new Set<string>(), keys = new Set<string>();
        let last: string | undefined;
        for (let t = 0; t < LEN; t++) {
          const p = generate(n, Math.random, seen, lv, last);
          expect(isValid(p.nums)).toBe(true);
          const k = sumKey(p.a, p.b);
          expect(keys.has(k)).toBe(false);
          keys.add(k); last = k;
        }
        expect(seen.size).toBe(LEN);
      }
    });
  }
  it('order-free key: a+b and b+a are the same sum', () => { expect(sumKey(11, 21)).toBe(sumKey(21, 11)); });
  it('a fresh set per round allows sums again (reset per round)', () => {
    const r1 = new Set<string>(); for (let i = 0; i < 50; i++) generate(5, Math.random, r1, 'medium');
    const r2 = new Set<string>(); for (let i = 0; i < 50; i++) generate(5, Math.random, r2, 'medium');
    expect(r2.size).toBe(50);
  });
  for (const [lv, n] of [['easy', 4], ['easy', 5], ['medium', 7]] as [Level, number][]) {
    it(`small pool ${lv} n=${n}: once every sum is used it cycles through the pool again, never the same sum twice in a row, never hangs`, () => {
      const pool = sumCount(n, lv), seen = new Set<string>(), t0 = Date.now();
      const order: string[] = [];
      for (let i = 0; i < pool * 3 + 7; i++) {
        const p = generate(n, Math.random, seen, lv, order[order.length - 1]);
        expect(isValid(p.nums)).toBe(true); expect(Math.max(...p.nums)).toBeLessThanOrEqual(CAP[lv]);
        order.push(sumKey(p.a, p.b));
      }
      for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
      for (let c = 0; c < 3; c++) expect(new Set(order.slice(c * pool, (c + 1) * pool)).size).toBe(pool); // each full cycle covers the pool once
      expect(Date.now() - t0).toBeLessThan(5000);
    });
  }
});
