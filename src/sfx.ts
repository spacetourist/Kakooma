/**
 * Sound hooks (v0.3.4): the Audio Engineer's pack (src/kkaudio.ts, sound pack v02c), wired in. Every existing
 * `import { sfx } from './sfx'` keeps working. This thin layer adds three things on top of the pack:
 *  - the mute setting (saved in localStorage 'kk.mute'): muting goes through the same path as stopAll() (everything
 *    playing or scheduled fades out) and every later hook is ignored while muted;
 *  - the test log: window.__sfxLog = [] records [name, args, firesAtMs] (performance.now() + delay), muted or not;
 *  - init on the base URL (Vite base, /Kakooma/ on Pages) once the page has loaded, so the sprite never competes with
 *    first paint. Nothing can sound before the first user gesture: the pack's AudioContext only runs after it unlocks.
 * Hooks are always called AFTER the state change they describe, never on the input path. A hook that belongs to a
 * delayed animation is called in the same tick that animation is created, with `{ delay }` (seconds) on the audio clock.
 */
import * as kk from './kkaudio';
export type { PlayOpts } from './kkaudio';
type Opts = kk.PlayOpts | undefined;

const MUTE_KEY = 'kk.mute';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
const log = (name: string, args: unknown[]) => {
  const L = (window as any).__sfxLog; if (!L) return;
  const o = args.find(a => a && typeof a === 'object') as Opts;
  L.push([name, args.filter(a => typeof a === 'number'), performance.now() + (o?.delay ?? 0) * 1000]);
};
type Hooks = typeof kk.sfx;
/** the game hooks: logged, then played by the pack unless muted */
export const sfx = Object.fromEntries(Object.keys(kk.sfx).map(k => [k, (...args: unknown[]) => {
  log(k, args);
  if (!muted) (kk.sfx as any)[k](...args);
}])) as Hooks;

/** v0.3.3: the counter tile turns green on the final count (150 ms after partPop(1)) */
export function total(o?: kk.PlayOpts): void { sfx.total(o); }
/** Fade out everything playing or scheduled (tap to skip, quit). */
export function stopAll(): void { log('stopAll', []); kk.stopAll(); }

export function isMuted(): boolean { return muted; }
/** Mute = stopAll (playing + queued sounds fade out) + silence every later hook (and the master bus, belt and braces). */
export function setMuted(m: boolean): void {
  muted = !!m;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
  log(muted ? 'mute' : 'unmute', []);
  if (muted) kk.stopAll();
  kk.setMuted(muted);
}

/** Run fn once the audio context is running (e.g. the confirming uiTap when sound is turned back on by the very first
 *  gesture of a session: the unlock has only just asked the context to resume). Call from inside a gesture. */
export function whenRunning(fn: () => void): void {
  try {
    const c = kk.context() as AudioContext | null; if (!c) return;
    if (c.state === 'running') fn(); else c.resume().then(() => fn(), () => {});
  } catch { /* silent */ }
}
/** Fetch + decode the sprite after the page has loaded; arms the first-gesture unlock. Never throws. */
export function initAudio(): void {
  const go = () => {
    const d = kk.init({ base: import.meta.env.BASE_URL + 'audio/' });
    kk.setMuted(muted);
    (window as any).__kkAudio = { ready: d, diag: () => kk.diagnostics(), state: () => kk.context()?.state ?? null };
    document.addEventListener('visibilitychange', () => { kk.setPaused(document.hidden); });
  };
  if (document.readyState === 'complete') setTimeout(go, 0); else window.addEventListener('load', () => setTimeout(go, 0), { once: true });
}
