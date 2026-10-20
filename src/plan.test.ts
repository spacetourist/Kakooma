import { describe, it, expect } from 'vitest';
import { planTeach, countTiming } from './plan';

const evalCap = (s: string) => { const m = s.match(/^(\d+) \+ (\d+) = (\d+)$/); expect(m).not.toBeNull(); return [+m![1], +m![2], +m![3]]; };
describe('planTeach (make ten)', () => {
  it('storyboard: 7 + 12 -> "7 + 3 = 10", "10 + 9 = 19"', () => {
    const p = planTeach(12, 7);
    expect(p.captions).toEqual(['7 + 3 = 10', '10 + 9 = 19']); expect(p.k).toBe(3); expect(p.bond).toBe('7 and 12 make 19');
    expect(p.counters.filter(c => c.hop)).toHaveLength(3);
  });
  it('under ten: one frame, one caption', () => {
    const p = planTeach(3, 4);
    expect(p.boxes).toEqual([{ row: 0 }]); expect(p.captions).toEqual(['3 + 4 = 7']); expect(p.k).toBe(0);
  });
  it('v0.3: exactly ten fills one frame with one caption (no "10 + 0 = 10")', () => {
    for (const [x, y] of [[3, 7], [1, 9], [4, 6]]) {
      const p = planTeach(x, y);
      expect(p.boxes).toEqual([{ row: 0 }]); expect(p.captions).toEqual([`${x} + ${y} = 10`]); expect(p.k).toBe(0);
      expect(p.counters.map(c => c.part)).toEqual([...Array(x).fill(0), ...Array(y).fill(1)]);
    }
  });
  it('v0.3: Hard tops out at 50: frames stay full size, in rows of at most 3', () => {
    for (let x = 1; x < 50; x++) for (let y = x + 1; x + y <= 50; y++) {
      const p = planTeach(x, y), rows = new Map<number, number>();
      for (const b of p.boxes) rows.set(b.row, (rows.get(b.row) ?? 0) + 1);
      expect(Math.max(...rows.values())).toBeLessThanOrEqual(3); expect(rows.size).toBeLessThanOrEqual(2);
      expect(p.counters.filter(c => c.part === 0)).toHaveLength(x); expect(p.counters.filter(c => c.part === 1)).toHaveLength(y);
    }
  });
  it('big sums: 17 + 25 bridges 17 -> 20', () => { expect(planTeach(17, 25).captions).toEqual(['17 + 3 = 20', '20 + 22 = 42']); });
  it('both whole tens: no bridge', () => { expect(planTeach(10, 20).captions).toEqual(['10 + 20 = 30']); });
  it('10 + 13 bridges the 13', () => { expect(planTeach(10, 13).captions).toEqual(['13 + 7 = 20', '20 + 3 = 23']); });
  it('one row when 3 frames or fewer: 7 + 12 is [7][10 -> 7][2]', () => {
    const p = planTeach(7, 12);
    expect(p.boxes).toEqual([{ row: 0 }, { row: 0 }, { row: 0 }]);
    expect(p.counters.filter(c => c.slot.box === 1)).toHaveLength(10);
    expect(p.counters.filter(c => c.hop).every(c => c.slot.box === 1 && c.hop!.box === 0 && c.part === 1)).toBe(true);
  });
  it('more than 3 tens stack into rows of full-size frames: 28 + 29', () => {
    const p = planTeach(28, 29);
    expect(p.boxes.length).toBe(6); expect(p.boxes.filter(b => b.row === 0)).toHaveLength(3); expect(p.boxes.filter(b => b.row === 1)).toHaveLength(3);
  });
  it('big wholes beyond the game range still wrap in rows of 3', () => {
    const p = planTeach(40, 45);
    for (const b of p.boxes) expect(b.row).toBeGreaterThanOrEqual(0);
    const rows = Math.max(...p.boxes.map(b => b.row)) + 1;
    for (let r = 0; r < rows; r++) expect(p.boxes.filter(b => b.row === r).length).toBeLessThanOrEqual(3);
  });
  it('every pair 1..29: counts, captions, slots and frame limits are consistent', () => {
    for (let a = 1; a <= 29; a++) for (let b = a + 1; b <= 30; b++) {
      const p = planTeach(a, b), c = a + b;
      expect(p.counters).toHaveLength(c);
      expect(p.counters.filter(x => x.part === 0)).toHaveLength(Math.min(a, b));
      // every frame is full size (no minis): the frame count is exactly what the counters need
      expect(p.boxes.length).toBeLessThanOrEqual(Math.ceil(a / 10) + Math.ceil(b / 10) + 1);
      expect(p.boxes.every(x => x.row >= 0)).toBe(true);
      // one colour per part all the way through: a counter's part never changes and the counts per part are exact
      expect(p.counters.filter(x => x.part === 1)).toHaveLength(Math.max(a, b));
      for (const cap of p.captions) { const [x, y, z] = evalCap(cap); expect(x + y).toBe(z); }
      expect(evalCap(p.captions[p.captions.length - 1])[2]).toBe(c);
      // final positions (after hops) never collide and stay inside a ten
      const final = p.counters.map(x => x.hop ?? x.slot);
      expect(new Set(final.map(s => `${s.box}:${s.cell}`)).size).toBe(c);
      for (const s of final) { expect(s.cell).toBeGreaterThanOrEqual(0); expect(s.cell).toBeLessThan(10); }
      if (p.k) { // after the hop the bridged frame holds exactly ten
        const tgt = p.counters.find(x => x.hop)!.hop!.box;
        expect(final.filter(s => s.box === tgt)).toHaveLength(10);
        // hoppers leave their source frame: they are exactly k, all from one frame, and nothing stays behind in their cells
        const hops = p.counters.filter(x => x.hop);
        expect(hops).toHaveLength(p.k);
        expect(new Set(hops.map(x => x.slot.box)).size).toBe(1);
        const src = hops[0].slot.box;
        expect(final.filter(s => s.box === src)).toHaveLength(p.counters.filter(x => x.slot.box === src).length - p.k);
        expect(hops.every(x => x.part !== p.counters.find(y => y.slot.box === tgt)!.part)).toBe(true); // hoppers keep their own colour in the new ten
      }
      // per row, at most 3 frames (fits the board width); 3 or fewer frames share one row
      const rows = Math.max(...p.boxes.map(x => x.row)) + 1;
      for (let r = 0; r < rows; r++) { const n = p.boxes.filter(x => x.row === r).length; expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(3); }
      if (p.boxes.length <= 3) expect(rows).toBe(1);
    }
  });
});

describe('v0.3.2 counting pace', () => {
  const per = (l: number[], S: number) => l.slice(1).map((t, i) => t - l[i]).filter((_, i) => i !== S - 1); // gaps, minus the beat between parts
  it('Easy: 300 ms per dot, one dot in flight at a time; 3 + 7 counts in ~3 s', () => {
    const t = countTiming('easy', 3, 7);
    expect(new Set(per(t.land, 3))).toEqual(new Set([300])); expect(t.fly).toBeLessThanOrEqual(t.every);
    expect(t.end - (t.land[0] - t.fly)).toBeGreaterThanOrEqual(2900); expect(t.end - (t.land[0] - t.fly)).toBeLessThanOrEqual(3300);
  });
  it('Medium: 150 ms per dot', () => { expect(new Set(per(countTiming('medium', 7, 12).land, 7))).toEqual(new Set([150])); });
  it('Hard: 60-72 ms per dot, the count capped at ~3 s even at 50', () => {
    for (const [a, b] of [[3, 7], [7, 12], [24, 26], [1, 49]]) {
      const t = countTiming('hard', a, b);
      expect(t.every).toBeGreaterThanOrEqual(60); expect(t.every).toBeLessThanOrEqual(72);
      expect(t.end).toBeLessThanOrEqual(3300);
    }
  });
  it('one landing per dot, strictly increasing (so the counter can go up by exactly 1 each time)', () => {
    for (const pace of ['easy', 'medium', 'hard'] as const) for (const [a, b] of [[3, 7], [7, 12], [24, 26]]) {
      const l = countTiming(pace, a, b).land;
      expect(l).toHaveLength(a + b); for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1] + 40);
    }
  });
});
