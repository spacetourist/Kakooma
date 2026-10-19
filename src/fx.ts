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
const CONFETTI = ['#3a7bff', '#22c55e', '#ff8a1f', '#ffc928'];
export function confetti(layer: HTMLElement, x: number, y: number, n = 26, track?: (a: Animation, el: HTMLElement) => void) {
  if (reducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetti'; p.style.background = CONFETTI[i % CONFETTI.length];
    layer.appendChild(p);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3, d = 70 + Math.random() * 110;
    const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d, rot = (Math.random() - 0.5) * 720;
    const a = p.animate([
      { transform: `translate(${x}px,${y}px) rotate(0deg) scale(.6)`, opacity: 1 },
      { transform: `translate(${x + dx}px,${y + dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x + dx * 1.15}px,${y + dy + 70}px) rotate(${rot}deg) scale(1)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
    a.onfinish = () => p.remove();
    track?.(a, p);
  }
}
