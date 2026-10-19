/** KAKOOMA addition puzzle: exactly one number in the set is the sum of two OTHER numbers. */
export interface Puzzle { nums: number[]; answer: number; a: number; b: number }
export type Rng = () => number;

/** Largest addend for a board of n numbers: 20 for 4, scaled modestly (+3 per extra number). */
export const addendMax = (n: number) => 20 + (n - 4) * 3;
/** Largest value shown at all (distractors can be as large as the biggest possible sum). */
export const valueMax = (n: number) => 2 * addendMax(n);

/** Every (target, a, b) with target = a + b, all three at distinct positions. */
export function sums(nums: number[]): { target: number; a: number; b: number }[] {
  const out: { target: number; a: number; b: number }[] = [];
  for (let i = 0; i < nums.length; i++)
    for (let j = 0; j < nums.length; j++) if (j !== i)
      for (let k = j + 1; k < nums.length; k++) if (k !== i && nums[j] + nums[k] === nums[i])
        out.push({ target: nums[i], a: nums[j], b: nums[k] });
  return out;
}
/** Valid iff no duplicates and exactly one (target, pair) exists: one answer, one way to make it. */
export function isValid(nums: number[]): boolean {
  return new Set(nums).size === nums.length && sums(nums).length === 1;
}

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export function generate(n: number, rng: Rng = Math.random): Puzzle {
  if (n < 3 || n > 9) throw new Error('n out of range');
  const A = addendMax(n), V = valueMax(n);
  for (;;) {
    const a = int(rng, 1, A); let b = int(rng, 1, A - 1); if (b >= a) b++;
    const nums = [a, b, a + b];
    let tries = 0;
    while (nums.length < n && tries++ < 400) {
      const d = int(rng, 1, V);
      if (nums.includes(d)) continue;
      nums.push(d);
      if (sums(nums).length !== 1) nums.pop();
    }
    if (nums.length < n || !isValid(nums)) continue;
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    return { nums, answer: a + b, a: Math.min(a, b), b: Math.max(a, b) };
  }
}
