/**
 * Sound hooks for the audio pack (v0.2.3). No audio yet: every hook is a no-op. They are always called AFTER the
 * state change they describe, never on the input path. Tests can set window.__sfxLog = [] to record
 * [name, args, performance.now()] for each call; normal play never sets it.
 */
const log = (name: string, ...args: number[]) => { const L = (window as any).__sfxLog; if (L) L.push([name, args, performance.now()]); };
export const sfx = {
  // game input + feedback
  tap(): void { log('tap'); }, correct(): void { log('correct'); }, wrong(): void { log('wrong'); }, penalty(): void { log('penalty'); },
  // round + timer
  roundStart(): void { log('roundStart'); }, lowTime(): void { log('lowTime'); }, tick(s: number): void { log('tick', s); }, timeUp(): void { log('timeUp'); },
  streak(level: number): void { log('streak', level); }, newBest(): void { log('newBest'); },
  // UI
  uiTap(): void { log('uiTap'); }, replay(): void { log('replay'); },
  // teaching solve
  count(i: number): void { log('count', i); }, hop(): void { log('hop'); }, makeTen(): void { log('makeTen'); }, bond(): void { log('bond'); },
  bondPart(i: number): void { log('bondPart', i); }, caption(): void { log('caption'); }, cheer(): void { log('cheer'); }, pulse(i: number): void { log('pulse', i); },
  // Bond Lab
  slide(n: number): void { log('slide', n); }, labPair(a: number): void { log('labPair', a); }, star(): void { log('star'); }, quizStart(): void { log('quizStart'); },
};
