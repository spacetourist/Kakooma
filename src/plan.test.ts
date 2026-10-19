import { describe, it, expect } from 'vitest';
import { planTeach } from './plan';

const evalCap = (s: string) => { const m = s.match(/^(\d+) \+ (\d+) = (\d+)$/); expect(m).not.toBeNull(); return [+m![1], +m![2], +m![3]]; };
describe('planTeach (make ten)', () => {
  it('storyboard: 7 + 12 -> "7 + 3 = 10", "10 + 9 = 19"', () => {
    const p = planTeach(12, 7);
    expect(p.captions).toEqual(['7 + 3 = 10', '10 + 9 = 19']); expect(p.k).toBe(3); expect(p.bond).toBe('7 and 12 make 19');
    expect(p.counters.filter(c => c.hop)).toHaveLength(3);
  });
  it('under ten: one frame, one caption', () => {
    const p = planTeach(3, 4);
    expect(p.boxes).toEqual([{ row: 0, kind: 'frame' }]); expect(p.captions).toEqual(['3 + 4 = 7']); expect(p.k).toBe(0);
  });
  it('big sums: 17 + 25 bridges 17 -> 20', () => { expect(planTeach(17, 25).captions).toEqual(['17 + 3 = 20', '20 + 22 = 42']); });
  it('both whole tens: no bridge', () => { expect(planTeach(10, 20).captions).toEqual(['10 + 20 = 30']); });
  it('10 + 13 bridges the 13', () => { expect(planTeach(10, 13).captions).toEqual(['13 + 7 = 20', '20 + 3 = 23']); });
  it('every pair 1..29: counts, captions, slots and frame limits are consistent', () => {
    for (let a = 1; a <= 29; a++) for (let b = a + 1; b <= 29; b++) {
      const p = planTeach(a, b), c = a + b;
      expect(p.counters).toHaveLength(c);
      expect(p.counters.filter(x => x.part === 0)).toHaveLength(Math.min(a, b));
      expect(p.boxes.filter(x => x.kind === 'frame').length).toBeLessThanOrEqual(3);
      expect(p.boxes.length).toBeLessThanOrEqual(6);
      for (const cap of p.captions) { const [x, y, z] = evalCap(cap); expect(x + y).toBe(z); }
      expect(evalCap(p.captions[p.captions.length - 1])[2]).toBe(c);
      // final positions (after hops) never collide and stay inside a ten
      const final = p.counters.map(x => x.hop ?? x.slot);
      expect(new Set(final.map(s => `${s.box}:${s.cell}`)).size).toBe(c);
      for (const s of final) { expect(s.cell).toBeGreaterThanOrEqual(0); expect(s.cell).toBeLessThan(10); }
      if (p.k) { // after the hop the bridged frame holds exactly ten
        const tgt = p.counters.find(x => x.hop)!.hop!.box;
        expect(final.filter(s => s.box === tgt)).toHaveLength(10);
      }
      // per row, at most 3 boxes (fits the board width)
      for (const r of [0, 1]) expect(p.boxes.filter(x => x.row === r).length).toBeLessThanOrEqual(3);
    }
  });
});
