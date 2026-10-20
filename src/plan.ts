/**
 * Pure "make ten" teaching plan for a + b = c (no DOM). Used by the solve animation and unit-tested.
 * Parts: S = smaller (light blue), L = larger (blue). Every counter keeps its part's colour all the way through.
 * Every ten-frame is full size (v0.2.1); up to 3 per row.
 */
export type Part = 0 | 1; // 0 = smaller part (light), 1 = larger part (dark)
export interface Box { row: number }
export interface Slot { box: number; cell: number }
export interface Counter { part: Part; slot: Slot }
/** v0.3.3: a frame completes when the count reaches `n` (10, 20, ...). The make-ten (bridging) frame carries the caption. */
export interface Ten { n: number; box: number; caption?: string }
export interface Plan { S: number; L: number; c: number; boxes: Box[]; counters: Counter[]; tens: Ten[]; bridge: number; bond: string }

export const PER_ROW = 3;

/**
 * v0.3.3 (GD): the frames fill continuously. The smaller part's dots go into cells 0..S-1, the larger part's dots carry
 * on into the first part's empty cells, then the next frame: 7 + 12 fills the first frame at 10, 24 + 26 ends as exactly
 * five full frames. Make-ten happens during the count: the frame where the two parts meet completes at the next ten
 * after S ("7 + 3 = 10", "24 + 6 = 30"); that one ten gets the caption, every other ten just rings.
 * Sums up to 10 use one frame. Frames: up to 3 per row, more wrap in order (rows of 3).
 */
export function planTeach(a: number, b: number): Plan {
  const S = Math.min(a, b), L = Math.max(a, b), c = S + L;
  const nBox = Math.ceil(c / 10);
  const boxes: Box[] = Array.from({ length: nBox }, (_, i) => ({ row: nBox <= PER_ROW ? 0 : Math.floor(i / PER_ROW) }));
  const counters: Counter[] = Array.from({ length: c }, (_, i) => ({ part: (i < S ? 0 : 1) as Part, slot: { box: Math.floor(i / 10), cell: i % 10 } }));
  const T = Math.ceil(S / 10) * 10, bridge = S % 10 && T <= c ? T : 0; // the ten where both colours meet (0 = none)
  const tens: Ten[] = [];
  for (let n = 10; n <= c; n += 10) tens.push({ n, box: n / 10 - 1, ...(n === bridge ? { caption: `${S} + ${T - S} = ${T}` } : {}) });
  return { S, L, c, boxes, counters, tens, bridge, bond: `${S} and ${L} make ${c}` };
}

/** v0.3.2 counting pace: ms between dots landing, each dot's flight, the beat between the two parts. */
export type Pace = 'easy' | 'medium' | 'hard';
export const TEN_HOLD = 600; // v0.3.3: the count pauses this long on the make-ten flash + caption (when more dots follow)
export function countTiming(pace: Pace, S: number, L: number, bridge = 0) {
  const c = S + L, hold = bridge && bridge < c ? TEN_HOLD : 0;
  const fly = pace === 'easy' ? 300 : pace === 'medium' ? 300 : 240;
  const gap = pace === 'easy' ? 200 : pace === 'medium' ? 150 : 80;
  // Easy: a dot lands every 300 ms and the next leaves as it lands (no overlap); Medium 150 ms; Hard 60-72 ms with the
  // whole count capped at ~3 s (dots overlap in flight but each still lands, and counts, on its own frame)
  const every = pace === 'easy' ? 300 : pace === 'medium' ? 150 : Math.max(60, Math.min(72, (3000 - fly - gap) / c));
  const land: number[] = [];
  for (let k = 0; k < c; k++) land.push(fly + k * every + (k >= S ? gap : 0) + (hold && k >= bridge ? hold : 0));
  return { every, fly, gap, hold, land, end: land[c - 1] };
}
