import { describe, it, expect } from 'vitest';
import { RESET, resetTotal, outBack, backFor, timeAt } from './motion';
describe('v0.3.8 motion constants', () => {
  it('reset is about 700 ms', () => { expect(resetTotal()).toBe(700); expect(RESET.collapseMs).toBe(280); expect(RESET.beatMs).toBe(60); expect(RESET.emergeMs).toBe(360); });
  it('backFor hits the requested overshoot', () => {
    for (const p of [1.06, 1.15]) { const s = backFor(p); let m = 0; for (let i = 0; i <= 1000; i++) m = Math.max(m, outBack(i / 1000, s)); expect(Math.abs(m - p)).toBeLessThan(0.002); }
    expect(outBack(1, backFor(1.15))).toBeCloseTo(1, 6); expect(outBack(0, 2)).toBeCloseTo(0, 6);
  });
  it('numbers fade in at 60 % of the way', () => { const s = backFor(RESET.travelOvershoot), t = timeAt(x => outBack(x, s), 0.6); expect(t).toBeGreaterThan(0.1); expect(t).toBeLessThan(0.5); });
});
