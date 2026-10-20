/**
 * Sound hooks (v0.2.3). No audio yet: every hook is a no-op. The names and signatures match the Audio Engineer's
 * pack (/workspace/kakooma-audio/dist/kkaudio.ts), so wiring it in later is `export { sfx } from './kkaudio'`.
 * Hooks are always called AFTER the state change they describe, never on the input path. A hook that belongs to a
 * delayed animation is called in the same tick that animation is created, with `{ delay }` (seconds) on the audio
 * clock, never from a separate timer; stopAll() cancels anything scheduled (tap-to-skip, quit, round end).
 * Tests can set window.__sfxLog = [] to record [name, args, firesAtMs] (performance.now() + delay).
 */
export interface PlayOpts { when?: number; delay?: number; gainDb?: number }
const log = (name: string, args: number[], o?: PlayOpts) => {
  const L = (window as any).__sfxLog; if (L) L.push([name, args, performance.now() + (o?.delay ?? 0) * 1000]);
};
export const sfx = {
  // game input + feedback
  tap(o?: PlayOpts): void { log('tap', [], o); },
  correct(o?: PlayOpts): void { log('correct', [], o); },   // also Bond Lab quiz right
  wrong(o?: PlayOpts): void { log('wrong', [], o); },       // also Bond Lab quiz wrong
  penalty(o?: PlayOpts): void { log('penalty', [], o); },   // the -3 s
  // round + timer
  roundStart(o?: PlayOpts): void { log('roundStart', [], o); },
  lowTime(o?: PlayOpts): void { log('lowTime', [], o); },
  tick(s: number, o?: PlayOpts): void { log('tick', [s], o); },
  timeUp(o?: PlayOpts): void { log('timeUp', [], o); },
  streak(level: number, o?: PlayOpts): void { log('streak', [level], o); },
  newBest(o?: PlayOpts): void { log('newBest', [], o); },
  // UI
  uiTap(o?: PlayOpts): void { log('uiTap', [], o); },
  replay(o?: PlayOpts): void { log('replay', [], o); },
  // teaching solve
  count(i: number, o?: PlayOpts): void { log('count', [i], o); },
  hop(o?: PlayOpts): void { log('hop', [], o); },
  makeTen(o?: PlayOpts): void { log('makeTen', [], o); },                   // v0.3.3: no longer called by the teaching solve (the ten accent is count(9))
  total,                                                                // v0.3.3: see total() below
  bond(o?: PlayOpts): void { log('bond', [], o); },
  partPop(i: number, o?: PlayOpts): void { log('partPop', [i], o); },   // 0 = smaller part, 1 = larger
  cheer(o?: PlayOpts): void { log('cheer', [], o); },
  caption(o?: PlayOpts): void { log('caption', [], o); },
  pulse(i: number, o?: PlayOpts): void { log('pulse', [i], o); },       // 0 smaller part, 1 larger part, 2 whole
  clear(o?: PlayOpts): void { log('clear', [], o); },                   // in the pack's API; optional, not called (pack default playClear: false)
  // Bond Lab
  slide(n: number, o?: PlayOpts): void { log('slide', [n], o); },
  labPair(a: number, o?: PlayOpts): void { log('labPair', [a], o); },
  star(o?: PlayOpts): void { log('star', [], o); },
  quizStart(o?: PlayOpts): void { log('quizStart', [], o); },
};
/** Cancel every scheduled/playing sound (the pack fades over 60 ms). Called whenever a lesson is cut short. */
export function stopAll(): void { log('stopAll', []); }
/** v0.3.3: the counter tile turns green on the final count (150 ms after partPop(1), +300 ms after the last dot). Silent stub. */
export function total(o?: PlayOpts): void { log('total', [], o); }
