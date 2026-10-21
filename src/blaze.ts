/**
 * v0.3.5 Blaze reactions. GD's poses swap in inside #blazeBody (same box and bottom anchor as blaze.png) for ~0.9 s,
 * with a squash-and-stretch on the existing WAAPI transform; hop and tilt stay as the in-between motion. Reduced motion:
 * the picture swaps, nothing moves. Every call here comes from a rAF / timer after the state change: never the input path.
 * Pose images (WebP, 2x the 86 px display size) are preloaded lazily after first paint; a pose that is not decoded yet
 * is simply skipped (Blaze keeps his normal motion), so a slow network can never stall or flash a broken image.
 */
import { sfx } from './sfx';
import { reducedMotion } from './fx';

export type Pose = 'cheer' | 'thumbs' | 'oops' | 'clap' | 'think' | 'whoa';
export const POSES: Pose[] = ['cheer', 'thumbs', 'oops', 'clap', 'think', 'whoa'];
/** GD's v2 poses: 634×581 masters with exactly blaze.png's framing (no top strip), shipped as GD's 316×290 WebP
 *  (v0.3.6.2: sharp at DPR 3 for the 86 px in-game Blaze and the ~105 px results Blaze). They sit in the same box as blaze.png with no scaling or offset. */
const FILES: Record<Pose, string | null> = { cheer: 'cheer.webp', thumbs: 'thumbs.webp', oops: 'oops.webp', clap: 'clap.webp', think: 'think.webp', whoa: 'whoa.webp' };
/** whoa (v2): speedy solve, the board answered in under 2 s, at most once a round, within the 1-in-3 budget */
export const WHOA_ON = true;
const DIR = import.meta.env.BASE_URL + 'assets/img/blaze/';
export const REVERT_MS = 900;

const ready = new Map<Pose, string>();
let preloading: Promise<void> | null = null;
/** decode every pose off the critical path: after first paint + load, in idle time */
export function preloadPoses(): Promise<void> {
  if (preloading) return preloading;
  preloading = new Promise<void>(res => {
    const go = () => Promise.all(POSES.map(p => {
      const f = FILES[p]; if (!f) return null;
      const im = new Image(); im.decoding = 'async'; im.src = DIR + f;
      return im.decode().then(() => { ready.set(p, im.src); }, () => { /* missing pose: that reaction just won't swap */ });
    })).then(() => res());
    const idle = (window as any).requestIdleCallback as ((f: () => void, o?: object) => number) | undefined;
    const after = () => requestAnimationFrame(() => setTimeout(() => idle ? idle(go, { timeout: 1500 }) : go(), 0));
    if (document.readyState === 'complete') after(); else window.addEventListener('load', after, { once: true });
  });
  return preloading;
}
export const poseReady = (p: Pose) => ready.has(p);
/** v0.3.6.1: a pose's image URL (the results screen's new-#1 Blaze uses the cheer image; visual only, no sound) */
export const poseSrc = (p: Pose) => (FILES[p] ? DIR + FILES[p] : null);

type KF = Keyframe[];
const MOTION: Record<Pose, { kf: KF; ms: number; easing?: string }> = {
  // comeback: beaming bounce (squash, stretch up, settle)
  thumbs: { kf: [{ transform: 'translateY(0) scale(1, 1)' }, { transform: 'translateY(0) scale(1.12, .86)', offset: 0.14 }, { transform: 'translateY(-20px) scale(.93, 1.1)', offset: 0.44 }, { transform: 'translateY(0) scale(1.07, .93)', offset: 0.72 }, { transform: 'translateY(0) scale(1, 1)' }], ms: 720, easing: 'ease-out' },
  // milestone: the flame flares taller (stretch from the feet) and settles
  cheer: { kf: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.06, .9)', offset: 0.12 }, { transform: 'translateY(-8px) scale(.94, 1.24)', offset: 0.4 }, { transform: 'translateY(0) scale(1.04, .96)', offset: 0.72 }, { transform: 'scale(1, 1)' }], ms: 760, easing: 'ease-out' },
  // wrong pick: a kind little wobble, done well inside a second
  oops: { kf: [{ transform: 'rotate(0) scale(1, 1)' }, { transform: 'rotate(-8deg) scale(1.04, .95)', offset: 0.18 }, { transform: 'rotate(6deg) scale(.98, 1.02)', offset: 0.42 }, { transform: 'rotate(-3deg)', offset: 0.66 }, { transform: 'rotate(0) scale(1, 1)' }], ms: 700, easing: 'ease-in-out' },
  // make-ten: two quick claps (little squash hops)
  clap: { kf: [{ transform: 'translateY(0) scale(1, 1)' }, { transform: 'translateY(-8px) scale(.96, 1.06)', offset: 0.22 }, { transform: 'translateY(0) scale(1.06, .94)', offset: 0.42 }, { transform: 'translateY(-8px) scale(.96, 1.06)', offset: 0.66 }, { transform: 'translateY(0) scale(1, 1)' }], ms: 680, easing: 'ease-out' },
  // idle: a slow head tilt that holds (loops gently until the next tap)
  think: { kf: [{ transform: 'rotate(0)' }, { transform: 'rotate(5deg) translateX(2px)' }], ms: 1400, easing: 'ease-in-out' },
  // speedy solve (disabled): pop + flare
  whoa: { kf: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.1, .88)', offset: 0.15 }, { transform: 'translateY(-10px) scale(.92, 1.2)', offset: 0.45 }, { transform: 'scale(1, 1)' }], ms: 700, easing: 'ease-out' },
};

export interface BlazeCtl {
  react(p: Pose, o?: { sparks?: number; hold?: boolean }): boolean;
  clear(): void;
  current(): Pose | null;
}
/** body: #blazeBody (holds the base <img>); root: #blaze (sparks layer) */
export function blazeCtl(body: HTMLElement, root: HTMLElement): BlazeCtl {
  const base = body.querySelector('img') as HTMLImageElement;
  const pose = document.createElement('img');
  pose.className = 'pose'; pose.alt = ''; pose.draggable = false; pose.width = 86; pose.hidden = true;
  base.after(pose);
  let cur: Pose | null = null, timer = 0, motion: Animation | null = null;
  const L: unknown[] = (window as any).__kkBlaze = [];
  const clear = () => {
    clearTimeout(timer); motion?.cancel(); motion = null;
    if (!cur) return;
    cur = null; pose.hidden = true; base.style.visibility = ''; delete body.dataset.pose;
  };
  function sparks(n: number) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * (2.2 / Math.max(1, n - 1)), r = 46 + (i % 2) * 12;
      root.appendChild(s);
      const an = s.animate([{ transform: 'translate(0, 0) scale(.4)', opacity: 1 }, { transform: `translate(${(Math.cos(a) * r).toFixed(1)}px, ${(Math.sin(a) * r).toFixed(1)}px) scale(1.1)`, opacity: 1, offset: 0.55 }, { transform: `translate(${(Math.cos(a) * r * 1.08).toFixed(1)}px, ${(Math.sin(a) * r * 1.08 + 2).toFixed(1)}px) scale(.9)`, opacity: 1, offset: 0.78 }, { transform: `translate(${(Math.cos(a) * r * 1.15).toFixed(1)}px, ${(Math.sin(a) * r * 1.15 + 6).toFixed(1)}px) scale(.6)`, opacity: 0 }], { duration: 620 + (i % 3) * 60, delay: 60, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
      an.onfinish = an.oncancel = () => s.remove();
    }
  }
  function react(p: Pose, o: { sparks?: number; hold?: boolean } = {}): boolean {
    const url = ready.get(p); if (!url) return false;
    clear();
    pose.src = url; pose.hidden = false; base.style.visibility = 'hidden'; body.dataset.pose = p; cur = p;
    sfx.blaze(p); // same frame the pose swaps in (the pack adds its 100 ms offset itself)
    L.push([p, Math.round(performance.now())]);
    if (!reducedMotion()) {
      const m = MOTION[p];
      motion = p === 'think'
        ? body.animate(m.kf, { duration: m.ms, easing: m.easing, direction: 'alternate', iterations: Infinity })
        : body.animate(m.kf, { duration: m.ms, easing: m.easing });
      if (o.sparks) sparks(o.sparks);
    }
    if (!o.hold) timer = window.setTimeout(clear, REVERT_MS);
    return true;
  }
  return { react, clear, current: () => cur };
}
