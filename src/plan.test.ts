import { describe, it, expect } from 'vitest';
import { planTeach, countTiming, TEN_HOLD } from './plan';

describe('planTeach (v0.3.3 continuous fill, make-ten during the count)', () => {
  it('7 + 12: the dark dots finish the first frame at 10 ("7 + 3 = 10"), then 9 more in the second frame', () => {
    const p = planTeach(12, 7);
    expect(p.boxes).toEqual([{ row: 0 }, { row: 0 }]); expect(p.bond).toBe('7 and 12 make 19');
    expect(p.counters.filter(c => c.slot.box === 0).map(c => c.part)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 1]);
    expect(p.tens).toEqual([{ n: 10, box: 0, caption: '7 + 3 = 10' }]); expect(p.bridge).toBe(10);
  });
  it('24 + 26 ends as exactly five full frames, rows of 3 + 2; the caption is on the ten where the colours meet', () => {
    const p = planTeach(24, 26);
    expect(p.boxes.length).toBe(5); expect(p.boxes.map(b => b.row)).toEqual([0, 0, 0, 1, 1]);
    for (let b = 0; b < 5; b++) expect(p.counters.filter(c => c.slot.box === b)).toHaveLength(10);
    expect(p.tens.map(t => t.n)).toEqual([10, 20, 30, 40, 50]);
    expect(p.tens.filter(t => t.caption)).toEqual([{ n: 30, box: 2, caption: '24 + 6 = 30' }]);
  });
  it('sums up to 10 use one frame; exactly ten is the make-ten', () => {
    expect(planTeach(3, 4).boxes).toHaveLength(1); expect(planTeach(3, 4).tens).toEqual([]); expect(planTeach(3, 4).bridge).toBe(0);
    expect(planTeach(3, 7).boxes).toHaveLength(1); expect(planTeach(3, 7).tens).toEqual([{ n: 10, box: 0, caption: '3 + 7 = 10' }]);
  });
  it('a whole-ten smaller part has no make-ten caption, only rings: 10 + 13', () => {
    const p = planTeach(10, 13); expect(p.bridge).toBe(0); expect(p.tens).toEqual([{ n: 10, box: 0 }, { n: 20, box: 1 }]);
  });
  it('every pair up to 50: continuous cells, exact part counts, at most 3 frames per row, 2 rows', () => {
    for (let a = 1; a < 50; a++) for (let b = a; a + b <= 50; b++) {
      const p = planTeach(a, b), c = a + b;
      expect(p.counters).toHaveLength(c); expect(p.boxes).toHaveLength(Math.ceil(c / 10));
      p.counters.forEach((x, i) => { expect(x.slot).toEqual({ box: Math.floor(i / 10), cell: i % 10 }); expect(x.part).toBe(i < a ? 0 : 1); });
      const rows = Math.max(...p.boxes.map(x => x.row)) + 1; expect(rows).toBeLessThanOrEqual(2);
      for (let r = 0; r < rows; r++) expect(p.boxes.filter(x => x.row === r).length).toBeLessThanOrEqual(3);
      expect(p.tens.filter(t => t.caption).length).toBeLessThanOrEqual(1);
      for (const t of p.tens) if (t.caption) { const [x, y, z] = t.caption.split(/ [+=] /).map(Number); expect(x).toBe(a); expect(x + y).toBe(z); expect(z).toBe(t.n); }
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
  it('v0.3.3: the count holds TEN_HOLD on the make-ten when more dots follow (none when the ten is the last dot)', () => {
    const t = countTiming('medium', 7, 12, 10), t0 = countTiming('medium', 7, 12);
    expect(t.land[9]).toBe(t0.land[9]); expect(t.land[10] - t0.land[10]).toBe(TEN_HOLD);
    expect(countTiming('easy', 3, 7, 10).hold).toBe(0);
  });
});
