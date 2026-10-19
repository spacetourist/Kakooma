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

/** Order-free key for a sum: a+b=c and b+a=c are the same sum. */
export const sumKey = (a: number, b: number) => `${Math.min(a, b)}+${Math.max(a, b)}`;
/** How many distinct sums a board of n numbers can ask (pairs of distinct addends 1..addendMax). */
export const sumCount = (n: number) => { const A = addendMax(n); return (A * (A - 1)) / 2; };

/** Random pair of distinct addends; avoids keys in `seen` (rejection first, then picks from the unused list; repeats only if every sum is used). */
function pickPair(A: number, rng: Rng, seen?: Set<string>): [number, number] {
  const rand = (): [number, number] => { const a = int(rng, 1, A); let b = int(rng, 1, A - 1); if (b >= a) b++; return [a, b]; };
  if (!seen || !seen.size) return rand();
  for (let i = 0; i < 60; i++) { const p = rand(); if (!seen.has(sumKey(p[0], p[1]))) return p; }
  const free: [number, number][] = [];
  for (let a = 1; a <= A; a++) for (let b = a + 1; b <= A; b++) if (!seen.has(sumKey(a, b))) free.push([a, b]);
  return free.length ? free[Math.floor(rng() * free.length)] : rand(); // all used: fall back to a repeat rather than hang
}

/**
 * New puzzle with n numbers. Pass the round's `seen` set to avoid repeating a sum already shown in that round;
 * the new puzzle's sum is added to it. Always terminates.
 */
export function generate(n: number, rng: Rng = Math.random, seen?: Set<string>): Puzzle {
  if (n < 3 || n > 9) throw new Error('n out of range');
  const A = addendMax(n), V = valueMax(n);
  for (let attempt = 0; ; attempt++) {
    const [a, b] = pickPair(A, rng, attempt < 50 ? seen : undefined);
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
    seen?.add(sumKey(a, b));
    return { nums, answer: a + b, a: Math.min(a, b), b: Math.max(a, b) };
  }
}
