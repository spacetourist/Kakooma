/** Small, allocation-light effects built on CSS transforms + the Web Animations API only. */
const mq = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => mq.matches || new URLSearchParams(location.search).has('reduced');

export function haptic(ms = 10) { try { if ('vibrate' in navigator) navigator.vibrate(ms); } catch { /* unsupported / blocked */ } }

export function squish(el: HTMLElement) {
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.92)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 120, easing: 'ease-out' });
}
/** Two expanding rings centred on (x, y) in `layer` coordinates. */
export function ripple(layer: HTMLElement, x: number, y: number, size = 80) {
  if (reducedMotion()) return;
  for (let i = 0; i < 2; i++) {
    const r = document.createElement('i');
    r.className = 'ring'; r.style.width = r.style.height = size + 'px';
    r.style.transform = `translate(${x - size / 2}px,${y - size / 2}px)`;
    layer.appendChild(r);
    r.animate([{ transform: `translate(${x - size / 2}px,${y - size / 2}px) scale(1)`, opacity: 0.55 }, { transform: `translate(${x - size / 2}px,${y - size / 2}px) scale(1.9)`, opacity: 0 }],
      { duration: 420, delay: i * 90, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }).onfinish = () => r.remove();
  }
}
/* ---------- confetti (v0.3.5.1, GD spec): canvas-confetti, lazily loaded after first paint, drawn in a web worker ----
 * ONE shared full-screen instance (useWorker, disableForReducedMotion) on a fixed canvas with pointer-events: none, so
 * taps during a shower never stutter. Colours: blue, light blue, green, gold, orange (no coral). Shapes ~50 % circles,
 * 30 % squares, 20 % stars (the star is built once, at load, with shapeFromPath). At most ~150 pieces alive at once;
 * a normal burst within 300 ms of the last one is skipped. Reduced motion: none (library flag + our own check). */
type Confetti = typeof import('canvas-confetti');
type Inst = ReturnType<Confetti['create']>;
type Shape = import('canvas-confetti').Shape;
export const CONFETTI_COLOURS = ['#3a7bff', '#9cc0ff', '#22c55e', '#ffc928', '#ff8a1f'];
const CAP = 150, FPS = 60, GAP_MS = 300;
let ready: Promise<{ fire: Inst; star: Shape } | null> | null = null;
function load() {
  return ready ??= import('canvas-confetti').then(m => {
    const lib = (m.default ?? m) as Confetti;
    const c = document.createElement('canvas'); c.className = 'confetti-canvas'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const fire = lib.create(c, { resize: true, useWorker: true, disableForReducedMotion: true });
    // 5-point star, built once
    const pts: string[] = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 4.2 : 10, a = -Math.PI / 2 + k * Math.PI / 5; pts.push(`${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`); }
    const star = lib.shapeFromPath({ path: `M${pts.join(' L')}Z` });
    return { fire, star };
  }, () => null);
}
/** fetch + set up the confetti module once the page has loaded and gone idle (keeps first load lean) */
export function preloadConfetti() {
  const go = () => { const idle = (window as any).requestIdleCallback; idle ? idle(() => load(), { timeout: 2000 }) : setTimeout(load, 200); };
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}
// pieces alive: [count, gone-at ms]; trims every new burst so the screen never holds more than ~CAP
let alive: [number, number][] = [], lastBurst = -Infinity;
const room = (now: number) => { alive = alive.filter(a => a[1] > now); return CAP - alive.reduce((n, a) => n + a[0], 0); };
const L: unknown[] = ((window as any).__kkConfetti = []); // test log: [kind, t, pieces]
function fireCapped(c: { fire: Inst }, kind: string, o: import('canvas-confetti').Options & { particleCount: number; ticks: number }) {
  const now = performance.now(), n = Math.min(o.particleCount, room(now));
  if (n < 5) { L.push([kind + ':capped', Math.round(now), 0]); return; }
  alive.push([n, now + (o.ticks / FPS) * 1000 + 200]); L.push([kind, Math.round(now), n]);
  c.fire({ ...o, particleCount: n });
}
const mix = (star: Shape, c: number, sq: number, st: number) => [...Array(c).fill('circle'), ...Array(sq).fill('square'), ...Array(st).fill(star)];
/** Normal solve, as the bond completes: two bursts at once, 40 pieces each, from 30 px either side of (x, y) (bond
 *  centre, `layer` coordinates), angled inwards (left at 60°, right at 120°). Skipped if the last burst was < 300 ms ago. */
export function confetti(layer: HTMLElement, x: number, y: number): void {
  if (reducedMotion()) return;
  const now = performance.now(); if (now - lastBurst < GAP_MS) { L.push(['burst:skipped', Math.round(now), 0]); return; }
  lastBurst = now;
  const R = layer.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  load().then(c => {
    if (!c) return;
    const base = { colors: CONFETTI_COLOURS, shapes: mix(c.star, 5, 3, 2), particleCount: 40, spread: 55, startVelocity: 32, gravity: 0.9, decay: 0.92, drift: 0, ticks: 140, scalar: 0.9 };
    for (const side of [-1, 1]) fireCapped(c, 'burst', { ...base, angle: side < 0 ? 60 : 120, origin: { x: (R.x + x + side * 30) / W, y: (R.y + y) / H } });
  });
}
export const SHOWER = { bursts: 6, every: 200, ms: 1200 };
/** Big moments (streak 3/5/10, a new #1): a 1.2 s shower of 6 bursts 200 ms apart along the top edge, x spread evenly
 *  over 0.1-0.9 with a little jitter, 25 pieces each, stars weighted to 50 %. */
export function shower(onFirst?: () => void): void {
  if (reducedMotion()) { onFirst?.(); return; }
  load().then(c => {
    if (!c) { onFirst?.(); return; }
    const shapes = mix(c.star, 3, 2, 5), n = SHOWER.bursts;
    const xs = Array.from({ length: n }, (_, k) => 0.1 + 0.8 * (k + 0.5) / n + (Math.random() - 0.5) * 0.05).sort(() => Math.random() - 0.5);
    // v0.3.5.2: onFirst (the deferred streak(n)) runs in the same tick as the first burst fires
    const burst = (x: number, k: number) => { if (!k) onFirst?.(); fireCapped(c, 'shower', { colors: CONFETTI_COLOURS, shapes, particleCount: 25, angle: 270, spread: 70, startVelocity: 18, gravity: 0.6, ticks: 220, scalar: 1.1,
      origin: { x: Math.min(0.9, Math.max(0.1, x)), y: -0.02 } }); };
    xs.forEach((x, k) => { if (!k) burst(x, 0); else setTimeout(() => burst(x, k), k * SHOWER.every); });
  });
}
