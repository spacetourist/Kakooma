/** KAKOOMA addition puzzle: exactly one number in the set is the sum of two OTHER numbers. */
export interface Puzzle { nums: number[]; answer: number; a: number; b: number }
export type Rng = () => number;

/**
 * v0.3 difficulty levels. The cap is the largest number on the board, the target sum included (parts are at least 1).
 * Before v0.3 there was no level: addends went up to 20 + 3 per extra number and distractors up to twice that
 * (largest tile 40 / 46 / 52 / 58 for 4..7 numbers), which is closest to Hard.
 */
export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];
export const CAP: Record<Level, number> = { easy: 10, medium: 20, hard: 50 };
export const LEVEL_NAME: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const isLevel = (x: unknown): x is Level => typeof x === 'string' && (LEVELS as readonly string[]).includes(x);

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
const pick = <T>(rng: Rng, a: readonly T[]) => a[Math.floor(rng() * a.length)];

/** Order-free key for a sum: a+b=c and b+a=c are the same sum. */
export const sumKey = (a: number, b: number) => `${Math.min(a, b)}+${Math.max(a, b)}`;

// ---------- small caps: every valid board, enumerated once and grouped by its sum ----------
/** Exhaustive when C(cap, n) is small (Easy and Medium); Hard is built at random instead. */
const EXHAUSTIVE_MAX = 200_000;
const choose = (m: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (m - i)) / (i + 1); return Math.round(r); };
const exhaustive = (n: number, cap: number) => choose(cap, n) <= EXHAUSTIVE_MAX;
const cache = new Map<string, Map<string, number[][]>>();
/** key -> boards (sorted number sets) for every valid n-board with all numbers in 1..cap. */
function boardsBySum(n: number, cap: number): Map<string, number[][]> {
  const id = `${n}/${cap}`;
  let m = cache.get(id);
  if (m) return m;
  m = new Map();
  const cur: number[] = [];
  const rec = (from: number) => {
    if (cur.length === n) {
      const s = sums(cur);
      if (s.length === 1) { const k = sumKey(s[0].a, s[0].b); let l = m!.get(k); if (!l) m!.set(k, (l = [])); l.push(cur.slice()); }
      return;
    }
    for (let v = from; v <= cap - (n - cur.length - 1); v++) { cur.push(v); rec(v + 1); cur.pop(); }
  };
  rec(1);
  cache.set(id, m);
  return m;
}

/** Every sum key a board of n numbers at this cap can ask (pairs of distinct parts, a + b <= cap, that some valid board uses). */
export function sumPool(n: number, level: Level): string[] {
  const cap = CAP[level];
  if (exhaustive(n, cap)) return [...boardsBySum(n, cap).keys()];
  const out: string[] = [];
  for (let a = 1; a <= cap; a++) for (let b = a + 1; a + b <= cap; b++) out.push(sumKey(a, b));
  return out;
}
/** How many distinct sums a board of n numbers can ask at this level. */
export const sumCount = (n: number, level: Level) => sumPool(n, level).length;
/** Can this level make boards of n numbers at all? (Easy, capped at 10, cannot: 6 numbers give only 5 boards, 7 give none.) */
export const MIN_POOL = 10;
export const supports = (n: number, level: Level) => sumCount(n, level) >= MIN_POOL;
export const shapesFor = (level: Level, ns: readonly number[] = [4, 5, 6, 7]) => ns.filter(n => supports(n, level));

/**
 * Choose a sum key that is not in `seen`. Small pools run out within a round: then the round starts a fresh cycle
 * through the pool (seen is cleared), skipping the sum just played so a board never repeats back to back.
 */
function chooseKey(pool: string[], rng: Rng, seen?: Set<string>, last?: string): string {
  if (!seen) return pick(rng, pool);
  let free = pool.filter(k => !seen.has(k));
  if (!free.length) { seen.clear(); free = pool.filter(k => k !== last); if (!free.length) free = pool; }
  return pick(rng, free);
}
const parseKey = (k: string) => k.split('+').map(Number) as [number, number];

/**
 * New puzzle with n numbers, every number in 1..CAP[level] (the target sum too). Pass the round's `seen` set to avoid
 * repeating a sum already shown in that round; the new puzzle's sum is added to it. Always terminates.
 */
export function generate(n: number, rng: Rng = Math.random, seen?: Set<string>, level: Level = 'hard', last?: string): Puzzle {
  if (n < 3 || n > 9) throw new Error('n out of range');
  const cap = CAP[level];
  if (!supports(n, level)) throw new Error(`${LEVEL_NAME[level]} (numbers up to ${cap}) cannot make ${n}-number boards`);
  let nums: number[], a: number, b: number;
  if (exhaustive(n, cap)) {
    const m = boardsBySum(n, cap), key = chooseKey([...m.keys()], rng, seen, last);
    [a, b] = parseKey(key); nums = pick(rng, m.get(key)!).slice();
  } else {
    const pool = sumPool(n, level);
    for (let attempt = 0; ; attempt++) {
      [a, b] = parseKey(attempt < 200 ? chooseKey(pool, rng, seen, last) : pick(rng, pool));
      nums = [a, b, a + b];
      let tries = 0;
      while (nums.length < n && tries++ < 400) {
        const d = int(rng, 1, cap);
        if (nums.includes(d)) continue;
        nums.push(d);
        if (sums(nums).length !== 1) nums.pop();
      }
      if (nums.length === n && isValid(nums)) break;
    }
  }
  for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
  seen?.add(sumKey(a, b));
  return { nums, answer: a + b, a: Math.min(a, b), b: Math.max(a, b) };
}
