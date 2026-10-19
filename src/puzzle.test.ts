import { describe, it, expect } from 'vitest';
import { generate, isValid, sums, valueMax, addendMax } from './puzzle';

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
