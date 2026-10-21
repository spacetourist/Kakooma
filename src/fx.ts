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
/* ---------- confetti (v0.3.5): canvas-confetti, lazily loaded after first paint, drawn in a web worker ----------
 * One fixed full-screen canvas (pointer-events: none) that canvas-confetti owns; with useWorker the falling pieces are
 * simulated + drawn off the main thread, so taps during a shower never stutter. Reduced motion: no confetti at all
 * (canvas-confetti's disableForReducedMotion + our own ?reduced / media check). */
type Confetti = typeof import('canvas-confetti');
type Inst = ReturnType<Confetti['create']>;
const css = (v: string, d: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d;
let ready: Promise<{ fire: Inst; shapes: { round: import('canvas-confetti').Shape } } | null> | null = null;
function load() {
  return ready ??= import('canvas-confetti').then(m => {
    const lib = (m.default ?? m) as Confetti;
    const c = document.createElement('canvas'); c.className = 'confetti-canvas'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const fire = lib.create(c, { resize: true, useWorker: true, disableForReducedMotion: true });
    const round = lib.shapeFromPath({ path: 'M3 0h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z' });
    return { fire, shapes: { round } };
  }, () => null);
}
/** fetch + set up the confetti module once the page has loaded and gone idle (keeps first load lean) */
export function preloadConfetti() {
  const go = () => { const idle = (window as any).requestIdleCallback; idle ? idle(() => load(), { timeout: 2000 }) : setTimeout(load, 200); };
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}
const colours = () => [css('--blue', '#3a7bff'), css('--lblue', '#9cc0ff'), css('--green', '#22c55e'), '#ffc928', css('--orange', '#ff8a1f')];
/** The usual burst: two angled bursts (40-50 pieces each) from either side of (x, y) in `layer` coordinates, aimed
 *  up and in, with drift + the library's 3D wobble/tilt (flutter and tumble) so nothing falls straight down. */
export function confetti(layer: HTMLElement, x: number, y: number, span = 90): void {
  if (reducedMotion()) return;
  const L = layer.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  load().then(c => {
    if (!c) return;
    const shapes = ['circle', 'circle', c.shapes.round, c.shapes.round, 'star'] as any[];
    const base = { colors: colours(), shapes, spread: 55, startVelocity: 26, gravity: 0.8, decay: 0.92, ticks: 260, scalar: 0.95 };
    // left side aims up and to the right, right side up and to the left
    for (const side of [-1, 1]) c.fire({ ...base, particleCount: 44 + Math.round(Math.random() * 4), angle: 90 + side * 28, drift: -side * 0.35 + (Math.random() - 0.5) * 0.3,
      origin: { x: (L.x + x + side * span) / W, y: (L.y + y) / H } });
  });
}
/** Big moments only (streak 3/5/10, a new #1): a shower from the top of the screen, mostly stars. */
export function shower(): void {
  if (reducedMotion()) return;
  load().then(c => {
    if (!c) return;
    const shapes = ['star', 'star', 'star', 'circle', c.shapes.round] as any[];
    for (let k = 0; k < 5; k++) setTimeout(() => c.fire({ colors: colours(), shapes, particleCount: 28, angle: 270, spread: 100, startVelocity: 12, gravity: 0.65,
      decay: 0.94, ticks: 320, scalar: 1.15, drift: (Math.random() - 0.5) * 1.2, origin: { x: 0.1 + 0.2 * k + (Math.random() - 0.5) * 0.08, y: -0.04 } }), k * 110);
  });
}
