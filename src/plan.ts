/**
 * Pure "make ten" teaching plan for a + b = c (no DOM). Used by the solve animation and unit-tested.
 * Parts: S = smaller (light blue), L = larger (blue). Bridging strategy: complete X to its next ten using k from Y.
 * Full tens that take no part in the bridge are drawn as small "mini" ten-frames so at most 3 full-size frames show.
 */
export type Part = 0 | 1; // 0 = smaller part (light), 1 = larger part (dark)
export interface Box { row: 0 | 1; kind: 'frame' | 'mini' }
export interface Slot { box: number; cell: number }
export interface Counter { part: Part; slot: Slot; hop?: Slot }
export interface Plan { S: number; L: number; c: number; boxes: Box[]; counters: Counter[]; k: number; X: number; captions: string[]; bond: string }

export function planTeach(a: number, b: number): Plan {
  const S = Math.min(a, b), L = Math.max(a, b), c = S + L;
  const boxes: Box[] = [], counters: Counter[] = [];
  const bond = `${S} and ${L} make ${c}`;
  const box = (row: 0 | 1, kind: 'frame' | 'mini') => boxes.push({ row, kind }) - 1;
  /** n counters of `part` into fresh boxes on `row`: full tens as minis, the remainder in one frame. */
  const fill = (row: 0 | 1, part: Part, n: number, tensAsFrames = false) => {
    for (let t = 0; t < Math.floor(n / 10); t++) { const bx = box(row, tensAsFrames ? 'frame' : 'mini'); for (let i = 0; i < 10; i++) counters.push({ part, slot: { box: bx, cell: i } }); }
    const r = n % 10;
    if (r) { const bx = box(row, 'frame'); for (let i = 0; i < r; i++) counters.push({ part, slot: { box: bx, cell: i } }); }
  };
  if (c < 10) { // under ten: one frame, smaller part first then larger
    const bx = box(0, 'frame');
    for (let i = 0; i < c; i++) counters.push({ part: i < S ? 0 : 1, slot: { box: bx, cell: i } });
    return { S, L, c, boxes, counters, k: 0, X: 0, captions: [`${S} + ${L} = ${c}`], bond };
  }
  let X = 0, Y = 0, xp: Part = 0;
  if (S % 10 && L >= 10 - (S % 10)) { X = S; Y = L; xp = 0; }
  else if (L % 10 && S >= 10 - (L % 10)) { X = L; Y = S; xp = 1; }
  if (!X) { // both parts are whole tens: nothing to bridge
    const few = c <= 30;
    fill(0, 0, S, few); fill(1, 1, L, few);
    return { S, L, c, boxes, counters, k: 0, X: 0, captions: [`${S} + ${L} = ${c}`], bond };
  }
  const yp: Part = xp === 0 ? 1 : 0, rX = X % 10, k = 10 - rX;
  // row 0: X = minis for its tens + a frame holding its ones, waiting for k more
  for (let t = 0; t < Math.floor(X / 10); t++) { const bx = box(0, 'mini'); for (let i = 0; i < 10; i++) counters.push({ part: xp, slot: { box: bx, cell: i } }); }
  const target = box(0, 'frame');
  for (let i = 0; i < rX; i++) counters.push({ part: xp, slot: { box: target, cell: i } });
  // row 1: Y's first frame (the last k of it hop up), then the rest of Y
  const f = Math.min(10, Y), first = box(1, 'frame');
  for (let i = 0; i < f; i++) counters.push({ part: yp, slot: { box: first, cell: i }, hop: i >= f - k ? { box: target, cell: rX + (i - (f - k)) } : undefined });
  fill(1, yp, Y - f);
  return { S, L, c, boxes, counters, k, X, captions: [`${X} + ${k} = ${X + k}`, `${X + k} + ${Y - k} = ${c}`], bond };
}
