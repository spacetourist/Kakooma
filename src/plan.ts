/**
 * Pure "make ten" teaching plan for a + b = c (no DOM). Used by the solve animation and unit-tested.
 * Parts: S = smaller (light blue), L = larger (blue). Every counter keeps its part's colour all the way through.
 * Bridging strategy: complete X to its next ten using k counters that hop out of Y's first frame (they leave it).
 * v0.2.1: every ten-frame is full size. Up to 3 frames share one row; more stack into rows of at most 3
 * (one row per part when each part fits in a row), so nothing is ever shrunk to a mini frame.
 */
export type Part = 0 | 1; // 0 = smaller part (light), 1 = larger part (dark)
export interface Box { row: number }
export interface Slot { box: number; cell: number }
export interface Counter { part: Part; slot: Slot; hop?: Slot }
export interface Plan { S: number; L: number; c: number; boxes: Box[]; counters: Counter[]; k: number; X: number; captions: string[]; bond: string }

export const PER_ROW = 3;

/** Assign rows: one row if everything fits, else one row per group when each group fits, else rows of PER_ROW in order. */
function layout(groups: number[][]): number[] {
  const all = groups.flat(), row: number[] = [];
  if (all.length <= PER_ROW) all.forEach(b => (row[b] = 0));
  else if (groups.every(g => g.length <= PER_ROW)) { let r = 0; for (const g of groups) if (g.length) { g.forEach(b => (row[b] = r)); r++; } }
  else all.forEach((b, i) => (row[b] = Math.floor(i / PER_ROW)));
  return row;
}

export function planTeach(a: number, b: number): Plan {
  const S = Math.min(a, b), L = Math.max(a, b), c = S + L;
  const counters: Counter[] = [];
  const bond = `${S} and ${L} make ${c}`;
  let nBox = 0;
  const finish = (groups: number[][], rest: Omit<Plan, 'boxes' | 'counters' | 'S' | 'L' | 'c' | 'bond'>): Plan => {
    const row = layout(groups);
    return { S, L, c, boxes: Array.from({ length: nBox }, (_, i) => ({ row: row[i] })), counters, bond, ...rest };
  };
  /** n counters of `part` into fresh full-size frames: tens first, then the ones. Returns the frame ids. */
  const fill = (part: Part, n: number) => {
    const ids: number[] = [];
    for (let left = n; left > 0; left -= 10) { const bx = nBox++; ids.push(bx); for (let i = 0; i < Math.min(10, left); i++) counters.push({ part, slot: { box: bx, cell: i } }); }
    return ids;
  };
  if (c <= 10) { // under ten: one frame, smaller part first then larger. v0.3: exactly ten too (Easy tops out at 10):
    // both parts fill one frame, so there is nothing to bridge (no "10 + 0 = 10" second step)
    const bx = nBox++;
    for (let i = 0; i < c; i++) counters.push({ part: i < S ? 0 : 1, slot: { box: bx, cell: i } });
    return finish([[bx]], { k: 0, X: 0, captions: [`${S} + ${L} = ${c}`] });
  }
  let X = 0, Y = 0, xp: Part = 0;
  if (S % 10 && L >= 10 - (S % 10)) { X = S; Y = L; xp = 0; }
  else if (L % 10 && S >= 10 - (L % 10)) { X = L; Y = S; xp = 1; }
  if (!X) { // both parts are whole tens: nothing to bridge
    const g0 = fill(0, S), g1 = fill(1, L);
    return finish([g0, g1], { k: 0, X: 0, captions: [`${S} + ${L} = ${c}`] });
  }
  const yp: Part = xp === 0 ? 1 : 0, rX = X % 10, k = 10 - rX;
  // X: its tens, then the frame holding its ones (the one that becomes a ten) last, next to Y
  const gx: number[] = [];
  for (let t = 0; t < Math.floor(X / 10); t++) { const bx = nBox++; gx.push(bx); for (let i = 0; i < 10; i++) counters.push({ part: xp, slot: { box: bx, cell: i } }); }
  const target = nBox++; gx.push(target);
  for (let i = 0; i < rX; i++) counters.push({ part: xp, slot: { box: target, cell: i } });
  // Y: its first frame comes first (the last k of it hop out into the target), then the rest of Y
  const f = Math.min(10, Y), first = nBox++;
  for (let i = 0; i < f; i++) counters.push({ part: yp, slot: { box: first, cell: i }, hop: i >= f - k ? { box: target, cell: rX + (i - (f - k)) } : undefined });
  const gy = [first, ...fill(yp, Y - f)];
  return finish([gx, gy], { k, X, captions: [`${X} + ${k} = ${X + k}`, `${X + k} + ${Y - k} = ${c}`] });
}
