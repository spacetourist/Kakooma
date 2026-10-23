/**
 * v0.3.8 motion constants (GD + AE spec, 23 Oct 2026). Every timing / easing for the correct-answer feedback, Blaze's
 * solve hop and the board reset lives here, so the designer's final numbers are a one-line change each.
 * All of it is transform + opacity on the compositor.
 */

/** Correct answer (both Show counting modes). The tile pops green 1 -> peak -> 1; a white tick badge pops onto its
 *  top-right corner on the same frame; one soft green ring ripples out 1x -> ringTo while it fades. */
export const SOLVE_FX = {
  popMs: 180, popPeak: 1.12, popEase: 'cubic-bezier(.3,.7,.4,1)',
  tickMs: 180, tickPeak: 1.2,         // badge: 0 -> tickPeak -> 1
  ringMs: 300, ringTo: 1.4, ringFrom: 0.7, ringEase: 'cubic-bezier(.2,.7,.3,1)', // ring opacity ringFrom -> 0
  pulsePeak: 1.06,                    // the connect beat's soft pulse as the lines join (was 1.08 -> 1.14 on a held 1.08)
  scoreMs: 160, scorePeak: 1.15,      // the score ticks up by 1 with a small pop
};

/** Blaze: every solve gets a small hop (up hopPx and down, squash on landing). Composited on top of his bob/pose motion. */
export const BLAZE_HOP = { ms: 240, px: 8, upAt: 0.42, landAt: 0.78, squash: [1.08, 0.9] as [number, number] };

/** Board reset between boards (~700 ms), after the connect beat (OFF) or the counting lesson (ON).
 *  Phase lengths are the WHOLE phase including the stagger: a tile's own move lasts phase - stagger * (n - 1). */
export const RESET = {
  collapseMs: 280, collapseStagger: 20, collapseScale: 0.2, collapseEase: 'cubic-bezier(.55,0,.85,.35)', // ease-in
  beatMs: 60,                          // the blue dot pulses once at the board centre
  dotPx: 14, dotPeak: 1.35, dotLead: 40, dotTail: 100, // the dot's pulse starts dotLead before the beat, ends dotTail after it
  emergeMs: 360, emergeStagger: 30, emergeScale: 0.2,
  emergeOvershoot: 1.15,               // ease-out-back: the tile's scale peaks at this before settling to 1
  travelOvershoot: 1.06,               // ease-out-back on the path: tiles fly 6 % past their spot and settle back
  numberAt: 0.6,                       // a tile's number fades in once it is 60 % of the way out
  numberFadeMs: 70,
  lineLag: 30,                         // the outline follows the tiles out this far behind (ms)
  samples: 16,                         // keyframes sampled per emerge curve (linear between them)
  reducedMs: 200,                      // prefers-reduced-motion: a plain crossfade (half out, half in)
};
export const resetTotal = () => RESET.collapseMs + RESET.beatMs + RESET.emergeMs;

/** ease-out-back with constant s: overshoots then settles at 1 */
export const outBack = (t: number, s: number) => { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const peakOf = (s: number) => { let m = 0; for (let i = 0; i <= 200; i++) m = Math.max(m, outBack(i / 200, s)); return m; };
/** the back constant whose curve peaks at `peak` (progress units, e.g. 1.06 = 6 % past the target) */
export function backFor(peak: number): number {
  if (peak <= 1) return 0;
  let lo = 0, hi = 10;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (peakOf(mid) < peak) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** first t in [0,1] where the curve reaches v */
export function timeAt(f: (t: number) => number, v: number): number { for (let i = 0; i <= 400; i++) if (f(i / 400) >= v) return i / 400; return 1; }
