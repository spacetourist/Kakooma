import { describe, it, expect } from 'vitest';
import { generate, isValid, sums, valueMax, addendMax, sumKey, sumCount } from './puzzle';

const PER_N = 5000;
describe('generate', () => {
  for (const n of [4, 5, 6, 7]) {
    it(`n=${n}: ${PER_N} puzzles all have exactly one answer, no duplicates, sensible range`, () => {
      let answerIsMax = 0;
      for (let t = 0; t < PER_N; t++) {
        const p = generate(n);
        expect(p.nums).toHaveLength(n);
        expect(new Set(p.nums).size).toBe(n);
        for (const v of p.nums) { expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(valueMax(n)); }
        // brute force: which numbers are the sum of two other distinct numbers?
        const answers = p.nums.filter((x, i) => p.nums.some((y, j) => j !== i && p.nums.some((z, k) => k !== i && k !== j && y + z === x)));
        expect(answers).toEqual([p.answer]);
        expect(sums(p.nums)).toEqual([{ target: p.answer, a: expect.any(Number), b: expect.any(Number) }]);
        expect(p.a + p.b).toBe(p.answer);
        expect(p.a).not.toBe(p.b);
        expect(p.a).toBeLessThanOrEqual(addendMax(n)); expect(p.b).toBeLessThanOrEqual(addendMax(n));
        expect(p.nums).toContain(p.a); expect(p.nums).toContain(p.b);
        expect(isValid(p.nums)).toBe(true);
        if (p.answer === Math.max(...p.nums)) answerIsMax++;
      }
      // the answer must not simply be "the biggest number" every time
      expect(answerIsMax / PER_N).toBeLessThan(0.9);
      console.log(`n=${n}: answer is the largest number in ${(100 * answerIsMax / PER_N).toFixed(1)}% of puzzles`);
    });
  }
  it('isValid rejects duplicates and multiple answers', () => {
    expect(isValid([1, 2, 3, 10])).toBe(true);
    expect(isValid([1, 2, 3, 3])).toBe(false);
    expect(isValid([1, 2, 3, 5])).toBe(false); // 3 = 1+2 and 5 = 2+3
    expect(isValid([1, 4, 5, 3])).toBe(false); // 5 = 1+4 and 4 = 1+3
  });
});

describe('no repeated sums within a round', () => {
  const ROUNDS = 25;
  for (const n of [4, 5, 6, 7]) {
    // 200 puzzles per round; the 4-number board only has 190 distinct sums, so it is tested at its maximum
    const LEN = Math.min(200, sumCount(n));
    it(`n=${n}: ${ROUNDS} rounds x ${LEN} puzzles, no answer triple repeats (${sumCount(n)} possible)`, () => {
      for (let r = 0; r < ROUNDS; r++) {
        const seen = new Set<string>(), triples = new Set<string>();
        for (let t = 0; t < LEN; t++) {
          const p = generate(n, Math.random, seen);
          expect(isValid(p.nums)).toBe(true);
          const tri = `${p.a}+${p.b}=${p.answer}`;
          expect(triples.has(tri)).toBe(false);
          triples.add(tri);
        }
        expect(seen.size).toBe(LEN);
      }
    });
  }
  it('order-free key: a+b and b+a are the same sum', () => { expect(sumKey(11, 21)).toBe(sumKey(21, 11)); });
  it('a fresh set per round allows sums again (reset per round)', () => {
    const r1 = new Set<string>(); for (let i = 0; i < 50; i++) generate(5, Math.random, r1);
    const r2 = new Set<string>(); for (let i = 0; i < 50; i++) generate(5, Math.random, r2);
    expect(r2.size).toBe(50);
  });
  it('falls back gracefully once every sum is used (no hang, still valid)', () => {
    const seen = new Set<string>(), t0 = Date.now();
    for (let i = 0; i < sumCount(4) + 60; i++) expect(isValid(generate(4, Math.random, seen).nums)).toBe(true);
    expect(seen.size).toBe(sumCount(4));
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
