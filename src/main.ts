import './style.css';
import { generate, sumKey, type Puzzle, type Level, LEVELS, CAP, LEVEL_NAME, isLevel, supports } from './puzzle';
import { teach, type TeachRun } from './teach';
import { haptic, ripple, reducedMotion, shower, preloadConfetti } from './fx';
import { sfx, initAudio, isMuted, setMuted, whenRunning } from './sfx';
import { initLab } from './lab';
import { avgSolve, secLabel } from './stats';

const $ = (id: string) => document.getElementById(id)!;
const NS = [4, 5, 6, 7] as const;
const SHAPE: Record<number, string> = { 4: 'Square', 5: 'Pentagon', 6: 'Hexagon', 7: 'Heptagon' };
const Q = new URLSearchParams(location.search);
/** Round length; ?round=<seconds> shortens it for testing. */
const ROUND_MS = Math.max(5, Math.min(600, Number(Q.get('round')) || 60)) * 1000;
const PENALTY_MS = 3000;          // wrong tap
/** v0.3.5 connect beat (GD): the correct-answer reveal, same on every level; the round timer is PAUSED for it */
const CONNECT = { pop: 150, lineAt: 100, line: 400, pulseAt: 500, pulse: 200, fadeAt: 850, fade: 150, end: 1000 };
const SLIDE_MS = 250;             // picker change: tiles slide to the new corners
/** v0.3: boards are per level + number count (kk.board.v2); v1 (no level) is migrated once to Hard and left in place as a backup. */
const LS = { board: 'kk.board.v2', boardV1: 'kk.board.v1', n: 'kk.n', lv: 'kk.lv' };
const lvName = (lv: Level) => `${LEVEL_NAME[lv]} ${CAP[lv]}`;
/** ?teach=quick|full forces the solve animation (testing). Default: full on the first 3 solves, milestones, new best, after a mistake, chip taps. */
const TEACH = Q.get('teach');
const MAX = 7;

type Phase = 'menu' | 'play' | 'feedback' | 'replay' | 'done';
/** One solved puzzle; kept per round so a tray chip can replay its explanation in v0.2. */
interface Solved { a: number; b: number; c: number; nums: number[]; n: number; ms: number }
interface Entry { name: string; lv: Level; n: number; score: number; streak: number; avg: number | null; miss: number; at: number }

const st = {
  phase: 'menu' as Phase, n: 5, lv: 'easy' as Level, lastKey: '', puzzle: null as Puzzle | null,
  left: ROUND_MS, since: 0, running: false,
  score: 0, miss: 0, streak: 0, best: 0, solve: [] as number[], solved: [] as Solved[], shownAt: 0, pausedAt: 0,
  prevBest: 0, teach: null as { skip: () => void } | null, teachCount: 0, teachStage: '', seen: new Set<string>(), badTiles: new Set<number>(), timers: new Set<number>(), run: 0,
};
(window as any).__kk = st;

// ---------- input: pointerdown (no click delay); keyboard/synthetic click as fallback ----------
function press(el: Element, fn: (e: Event) => void) {
  el.addEventListener('pointerdown', e => { if ((e as PointerEvent).button > 0) return; e.preventDefault(); fn(e); });
  el.addEventListener('click', e => { if ((e as MouseEvent).detail === 0) fn(e); });
}
function later(fn: () => void, ms: number) {
  const run = st.run;
  const h = window.setTimeout(() => { st.timers.delete(h); if (st.run === run) fn(); }, ms);
  st.timers.add(h);
}
function cancelTimers() { for (const h of st.timers) clearTimeout(h); st.timers.clear(); st.teach?.skip(); }
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// ---------- version ----------
{ const v = __VERSION__.split('.'); if (v.length === 3 && v[2] === '0') v.pop(); $('verLabel').textContent = 'v' + v.join('.'); } // 0.2.0 -> v0.2, 0.2.3.1 -> v0.2.3.1

// ---------- polygon geometry ----------
const ang = (n: number, i: number) => -Math.PI / 2 + (n === 4 ? Math.PI / 4 : 0) + (2 * Math.PI * i) / n;
function unitPoly(n: number) { return Array.from({ length: n }, (_, i) => [Math.cos(ang(n, i)), Math.sin(ang(n, i))] as [number, number]); }
function iconSvg(n: number) {
  const p = unitPoly(n).map(([x, y]) => [20 + 15 * x, 20 + 15 * y]);
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><polygon points="${p.map(q => q.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>${p.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="currentColor"/>`).join('')}</svg>`;
}

// ---------- board ----------
const board = $('board'), poly = $('outlinePoly');
const slots: HTMLDivElement[] = [], tiles: HTMLButtonElement[] = [];
for (let i = 0; i < MAX; i++) {
  const s = document.createElement('div'); s.className = 'slot';
  const t = document.createElement('button'); t.type = 'button'; t.className = 'tile'; t.dataset.i = String(i); t.tabIndex = -1;
  s.appendChild(t); board.appendChild(s); slots.push(s); tiles.push(t);
}
interface P { x: number; y: number; o: number }
const cur: P[] = Array.from({ length: MAX }, () => ({ x: 0, y: 0, o: 0 }));
let shownN = 0, anim = 0;
function targets(n: number): P[] {
  const w = board.clientWidth, h = board.clientHeight;
  const tile = parseFloat(getComputedStyle(slots[0]).width) || 80;
  const R = Math.min(w * 0.33, (h - tile) / 2 / 0.95, (w - tile) / 2);
  const u = unitPoly(n);
  const ys = u.map(p => p[1]), mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const out = u.map(([x, y]) => ({ x: w / 2 + R * x, y: h / 2 + R * (y - mid), o: 1 }));
  for (let i = n; i < MAX; i++) out.push({ ...out[i % n], o: 0 });
  return out;
}
function apply(n: number) {
  for (let i = 0; i < MAX; i++) {
    const p = cur[i], s = slots[i].style;
    s.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) scale(${(0.6 + 0.4 * p.o).toFixed(3)})`;
    s.opacity = p.o.toFixed(3); s.visibility = p.o < 0.01 ? 'hidden' : 'visible';
  }
  poly.setAttribute('points', cur.slice(0, n).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
}
/** Move tiles to the corners of an n-gon. ms > 0 slides from the current spots (new tiles fade in at their corner). */
function layout(n: number, ms: number) {
  cancelAnimationFrame(anim);
  const to = targets(n);
  if (!ms || !shownN) { for (let i = 0; i < MAX; i++) cur[i] = { ...to[i] }; shownN = n; apply(n); return; }
  const from = cur.map((p, i) => (p.o < 0.01 && to[i].o > 0 ? { ...to[i], o: 0 } : { ...p }));
  const t0 = performance.now(); shownN = n;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    for (let i = 0; i < MAX; i++) cur[i] = { x: from[i].x + (to[i].x - from[i].x) * e, y: from[i].y + (to[i].y - from[i].y) * e, o: from[i].o + (to[i].o - from[i].o) * e };
    apply(n);
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
addEventListener('resize', () => layout(shownN || st.n, 0));

function showPuzzle(p: Puzzle, pop: boolean) {
  st.puzzle = p;
  for (let i = 0; i < MAX; i++) {
    const t = tiles[i];
    t.className = 'tile'; t.textContent = i < p.nums.length ? String(p.nums[i]) : '';
    if (pop && i < p.nums.length) t.animate([{ transform: 'scale(.85)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 220, delay: i * 30, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
  }
}

// ---------- Blaze (streak) ----------
const blaze = $('blaze'), blazeBody = $('blazeBody'), pill = $('streakPill');
const tier = (s: number) => (s >= 20 ? 3 : s >= 10 ? 2 : s >= 5 ? 1 : 0);
function setStreak(s: number, prev: number) {
  pill.textContent = `x${s}`;
  const t = tier(s); blaze.dataset.tier = String(t);
  if (t > tier(prev)) blazeBody.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: 0.4 }, { transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' });
  if (t > tier(prev)) sfx.streak([0, 5, 10, 20][t]); // Blaze grows (called after the streak state changed)
}
/** Wrong tap: Blaze tilts his head; if a streak broke he also shrinks and sighs (eyes close). */
function blazeWrong(sighToo: boolean) {
  const s = sighToo ? ' scale(.85) translateY(3px)' : '';
  blazeBody.animate([{ transform: 'rotate(0)' }, { transform: `rotate(-14deg)${s}`, offset: 0.25 }, { transform: `rotate(-14deg)${s}`, offset: 0.75 }, { transform: 'rotate(0)' }], { duration: 800, easing: 'ease-in-out' });
  if (sighToo) for (const l of blaze.querySelectorAll('.lid, .mouth')) l.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: 460, delay: 80 });
}
function blazeHop() {
  blazeBody.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-18px) scale(1.08)', offset: 0.4 }, { transform: 'translateY(0) scale(1)' }], { duration: 450, easing: 'ease-out' });
}

// ---------- timer ----------
const timerEl = $('timer'), timerTxt = $('timerTxt'), segsEl = $('segs'), scoreTxt = $('scoreTxt');
segsEl.innerHTML = '<i></i>'.repeat(10);
const segs = [...segsEl.children] as HTMLElement[];
const timeLeft = (now: number) => (st.running ? st.left - (now - st.since) : st.left);
function pause(now: number) { if (st.running) { st.left = timeLeft(now); st.running = false; } }
function resume(now: number) { if (!st.running) { st.since = now; st.running = true; } }
let lastTenth = -1, lastSegs = -1, lastLow: boolean | null = null, loop = 0;
let lowFired = false, lastTickS = -1; // sound hooks: lowTime once at 10 s; tick(s) at 5..1 s
function drawTimer(left: number) {
  const tenth = Math.max(0, Math.ceil(left / 100));
  if (tenth !== lastTenth) {
    lastTenth = tenth;
    const s = Math.floor(tenth / 10);
    timerTxt.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenth % 10}`;
  }
  const on = Math.ceil(Math.max(0, left) / (ROUND_MS / 10));
  if (on !== lastSegs) { lastSegs = on; segs.forEach((e, i) => e.classList.toggle('on', i < on)); }
  const low = left <= 10000;
  if (low !== lastLow) { lastLow = low; timerEl.classList.toggle('low', low); segsEl.classList.toggle('low', low); }
}
function tick() {
  if (st.phase !== 'play' && st.phase !== 'feedback' && st.phase !== 'replay') { loop = 0; return; }
  const left = timeLeft(performance.now());
  drawTimer(left);
  if (left <= 0 && st.phase === 'play') { endRound(); loop = 0; return; }
  if (st.phase !== 'replay') {
    if (!lowFired && left <= 10000) { lowFired = true; sfx.lowTime(); }
    const s = Math.ceil(left / 1000);
    if (s !== lastTickS) { lastTickS = s; if (s >= 1 && s <= 5) sfx.tick(s); }
  }
  loop = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => {
  if (st.phase !== 'play') return;
  const now = performance.now();
  if (document.hidden) { pause(now); st.pausedAt = now; }
  else { st.shownAt += now - st.pausedAt; resume(now); }
});

// ---------- sum strip + solved tray ----------
const sumEl = $('sum'), tray = $('tray');
/** Strip under the board: the hint on a round's first puzzle, the sum (parts blue, answer green) during feedback, else a grey "? + ? = ?" placeholder. */
function showSum(s: Solved | null) {
  if (s) { sumEl.className = 'sum pop'; sumEl.innerHTML = `<span class="p">${s.a}</span><span>+</span><span class="p">${s.b}</span><span>=</span><span class="a">${s.c}</span>`; }
  else if (!st.solved.length) { sumEl.className = 'sum hint'; sumEl.textContent = 'Find the number made by two others'; }
  else { sumEl.className = 'sum ph'; sumEl.innerHTML = '<span>?</span><span>+</span><span>?</span><span>=</span><span>?</span>'; }
}
let newestChip: HTMLElement | null = null;
/** Newest chip first (green); older chips neutral. data-k indexes st.solved for the v0.2 replay. */
function addChip(s: Solved, k: number) {
  newestChip?.classList.remove('new');
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'chip new'; c.dataset.k = String(k); c.tabIndex = -1;
  c.textContent = `${s.a} + ${s.b} = ${s.c}`;
  tray.prepend(c); tray.scrollTop = 0; newestChip = c;
}
function chipSolve(el: Element): Solved | null { const k = (el as HTMLElement).dataset.k; return k == null ? null : st.solved[+k] ?? null; }
/** Tap a chip: replay the full teaching solve for that sum on its own board, timer paused, then restore the live board. */
press(tray, e => { const c = (e.target as HTMLElement).closest('.chip') as HTMLElement | null; if (!c) return; const s = chipSolve(c); if (s) replay(s, c); });
function replay(s: Solved, chip: HTMLElement) {
  if (st.phase !== 'play' || st.teach || !st.puzzle) return;
  const t0 = performance.now(); pause(t0); st.phase = 'replay';
  const live = st.puzzle, bad = [...st.badTiles];
  showPuzzle({ nums: s.nums, answer: s.c, a: s.a, b: s.b }, false);
  const iC = s.nums.indexOf(s.c);
  tiles[iC].classList.add('ok'); tiles[s.nums.indexOf(s.a)].classList.add('add'); tiles[s.nums.indexOf(s.b)].classList.add('add');
  showSum(s); chip.classList.add('playing'); haptic(10); sfx.replay();
  runTeach(s, iC, () => {
    chip.classList.remove('playing');
    showPuzzle(live, false); for (const i of bad) tiles[i].classList.add('bad');
    showSum(null);
    const now = performance.now(); st.shownAt += now - t0; st.phase = 'play'; resume(now);
  });
}

// ---------- connect beat (v0.3.5) ----------
/** GD's reveal, ~1 s, timer paused: 0-0.15 s the answer pops green to 1.08 and every other tile dims to 40 %;
 *  0.1-0.5 s the parts light up (#9cc0ff smaller, #3a7bff larger) and a thick round-ended line in each part's colour
 *  draws into the answer, both arriving together (sfx.link() at 0.1 s); 0.5-0.7 s one soft pulse on the answer as the
 *  lines join + the sum strip fills in; hold, then lines + dimming fade over 0.15 s (0.85-1.0 s) and hand over.
 *  Reduced motion: same clock, the lines simply appear, no scale. Everything is built in the next frame (never on the
 *  input path); a tap anywhere but a button skips it. */
function connectBeat(s: Solved, iC: number, big: boolean, then: () => void, onSkip: () => void) {
  const run = st.run, C = CONNECT;
  let done = false; const anims: Animation[] = []; let svg: SVGSVGElement | null = null; let raf = 0;
  const others = () => tiles.filter((_, k) => k < s.nums.length && k !== iC && k !== iS && k !== iL);
  const iS = s.nums.indexOf(Math.min(s.a, s.b)), iL = s.nums.indexOf(Math.max(s.a, s.b)) === iS ? s.nums.lastIndexOf(Math.max(s.a, s.b)) : s.nums.indexOf(Math.max(s.a, s.b));
  const cleanup = () => { cancelAnimationFrame(raf); for (const a of anims) a.cancel(); svg?.remove(); for (const t of tiles) t.classList.remove('cdim'); };
  const finish = (next: () => void) => {
    if (done) return; done = true; if (st.teach === handle) st.teach = null; st.teachStage = ''; document.removeEventListener('pointerdown', catcher, true);
    cleanup(); tiles[iS].classList.add('add', 'cs'); tiles[iL].classList.add('add', 'cl'); showSum(s);
    if (st.run === run) next();
  };
  const handle = { skip: () => { Promise.resolve().then(() => finish(onSkip)); } };
  // tap anywhere skips the beat; buttons (Quit, mute) still work, so no full-screen catcher here
  const catcher = (e: PointerEvent) => { if ((e.target as HTMLElement).closest?.('button, input, a')) return; e.preventDefault(); e.stopPropagation(); handle.skip(); };
  document.addEventListener('pointerdown', catcher, true);
  st.teach = handle; st.teachStage = 'connect';
  raf = requestAnimationFrame(() => {
    if (done) return;
    const reduced = reducedMotion(), ans = tiles[iC];
    for (const t of others()) t.classList.add('cdim');
    // (easing per segment: an effect-wide easing would warp the whole 1 s clock)
    if (!reduced) anims.push(ans.animate([{ transform: 'scale(1)', easing: 'cubic-bezier(.34,1.56,.64,1)' }, { transform: 'scale(1.08)', offset: C.pop / C.end }, { transform: 'scale(1.08)', offset: C.pulseAt / C.end, easing: 'ease-out' },
      { transform: 'scale(1.14)', offset: (C.pulseAt + C.pulse * 0.45) / C.end, easing: 'ease-in-out' }, { transform: 'scale(1.08)', offset: (C.pulseAt + C.pulse) / C.end }, { transform: 'scale(1.08)', offset: C.fadeAt / C.end, easing: 'ease-in-out' }, { transform: 'scale(1)' }],
      { duration: C.end }));
    // the lines: from each part tile's edge into the answer's edge, in the part's colour
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'connect');
    svg.setAttribute('viewBox', `0 0 ${fxEl.clientWidth} ${fxEl.clientHeight}`); fxEl.appendChild(svg);
    const A = cur[iC], rA = ans.offsetWidth / 2;
    [iS, iL].forEach((k, part) => {
      const P = cur[k], rP = tiles[k].offsetWidth / 2, d = Math.hypot(A.x - P.x, A.y - P.y) || 1, ux = (A.x - P.x) / d, uy = (A.y - P.y) / d;
      const x1 = P.x + ux * (rP - 4), y1 = P.y + uy * (rP - 4), x2 = A.x - ux * (rA * 1.08 - 4), y2 = A.y - uy * (rA * 1.08 - 4), len = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
      l.setAttribute('class', part ? 'cl' : 'cs'); l.style.strokeDasharray = String(len); svg!.appendChild(l);
      // hidden until its draw starts (a fully offset round-capped line still paints its caps), then draw, hold, fade
      anims.push(l.animate(reduced
        ? [{ opacity: 0, strokeDashoffset: 0 }, { opacity: 0, offset: C.lineAt / C.end }, { opacity: 1, offset: C.lineAt / C.end }, { opacity: 1, offset: C.fadeAt / C.end }, { opacity: 0 }]
        : [{ opacity: 0, strokeDashoffset: len }, { opacity: 0, strokeDashoffset: len, offset: C.lineAt / C.end }, { opacity: 1, strokeDashoffset: len * 0.97, offset: (C.lineAt + 20) / C.end, easing: 'cubic-bezier(.4,0,.3,1)' },
          { opacity: 1, strokeDashoffset: 0, offset: (C.lineAt + C.line) / C.end }, { opacity: 1, strokeDashoffset: 0, offset: C.fadeAt / C.end }, { opacity: 0, strokeDashoffset: 0 }],
        { duration: C.end, fill: 'both' }));
      // the part tile lights up in its colour as its line starts
      later(() => { if (!done) tiles[k].classList.add('add', part ? 'cl' : 'cs'); }, C.lineAt);
    });
    sfx.link({ delay: C.lineAt / 1000 }); // once, as the lines start (no partPop in the reveal)
    later(() => { if (done) return; showSum(s); if (big) shower(); }, C.pulseAt);
    later(() => { if (!done) for (const t of tiles) t.classList.remove('cdim'); }, C.fadeAt);
    later(() => finish(then), C.end);
  });
}

// ---------- teaching solve ----------
const fxEl = $('fx'), skipper = $('skipper');
function runTeach(s: Solved, iC: number, then: () => void) {
  const run = st.run; let real: TeachRun | null = null, ended = false;
  const end = () => {
    if (ended) return; ended = true;
    if (st.teach === handle) st.teach = null;
    st.teachStage = ''; skipper.classList.add('hidden');
    if (st.run === run) then();
  };
  const handle = { skip: () => { if (real) real.skip(); else Promise.resolve().then(end); } };
  st.teach = handle; st.teachCount++; skipper.classList.remove('hidden');
  // build the animation in the next frame so the tap handler only flips state + classes (input stays instant)
  requestAnimationFrame(() => {
    if (ended) return;
    real = teach({ layer: fxEl, tiles, centre: i => ({ x: cur[i].x, y: cur[i].y }), n: s.nums.length,
      iS: s.nums.indexOf(s.a), iL: s.nums.indexOf(s.b), iC, pace: st.lv, onHop: blazeHop, onStage: g => { st.teachStage = g; if (g === 'clear') showSum(null); } }, s.a, s.b);
    real.done.then(end);
  });
}
// tap anywhere to skip (pointerdown: instant); the catcher eats the tap so it never lands on the next board
skipper.addEventListener('pointerdown', e => { e.preventDefault(); st.teach?.skip(); });
skipper.addEventListener('click', e => { if (e.detail === 0) st.teach?.skip(); });
function wantsFull(extra: boolean) { if (TEACH === 'quick') return false; if (TEACH === 'full') return true; return st.score <= 3 || extra; }
let capTimer = 0;
/** Wrong tap (v0.2.1): the reason replaces the hint/placeholder inside the sum strip for 2 s, then the strip restores. */
function wrongCaption(v: number) {
  clearTimeout(capTimer);
  sumEl.className = 'sum wrong'; sumEl.textContent = `${v} can't be made from two of these`;
  if (!reducedMotion()) sumEl.animate([{ opacity: 0.2, translate: '0 3px' }, { opacity: 1, translate: '0 0' }], { duration: 180, easing: 'ease-out' });
  capTimer = window.setTimeout(clearWrongCaption, 2000);
}
function clearWrongCaption() { clearTimeout(capTimer); if (sumEl.classList.contains('wrong')) showSum(null); }

// ---------- round ----------
const play = $('play');
function setMode(m: 'menu' | 'game') { play.dataset.mode = m; }
function show(id: 'play' | 'results' | 'boards' | 'lab') { for (const s of ['play', 'results', 'boards', 'lab']) $(s).classList.toggle('hidden', s !== id); }

function startRound() {
  cancelTimers(); st.run++;
  if (!supports(st.n, st.lv)) st.n = 5;
  Object.assign(st, { phase: 'play', left: ROUND_MS, running: false, score: 0, miss: 0, streak: 0, best: 0, solve: [], solved: [], seen: new Set<string>(), lastKey: '' });
  tray.replaceChildren(); newestChip = null; st.prevBest = boardFor(st.lv, st.n)[0]?.score ?? 0; st.teachCount = 0;
  scoreTxt.textContent = '0'; setStreak(0, 0); lastTenth = lastSegs = -1; lastLow = null; drawTimer(ROUND_MS);
  setMode('game'); show('play');
  layout(st.n, 0);
  lowFired = false; lastTickS = -1;
  nextPuzzle();
  if (!loop) loop = requestAnimationFrame(tick);
  sfx.roundStart();
}
function nextPuzzle() {
  st.badTiles.clear();
  showSum(null);
  // window.__kkNext: optional queue of puzzles for automated tests (deterministic stage shots); normal play never sets it
  const q = (window as any).__kkNext as Puzzle[] | undefined;
  const p = q?.length ? q.shift()! : generate(st.n, Math.random, st.seen, st.lv, st.lastKey); // no sum repeats within a round (reset in startRound); small pools cycle
  st.seen.add(sumKey(p.a, p.b)); st.lastKey = sumKey(p.a, p.b);
  showPuzzle(p, true);
  const now = performance.now();
  st.shownAt = now; st.phase = 'play'; resume(now);
}
board.addEventListener('pointerdown', e => {
  const t = (e.target as HTMLElement).closest('.tile') as HTMLElement | null;
  if (!t) return; e.preventDefault();
  const i = +t.dataset.i!, was = st.phase;
  onTap(i, e.timeStamp);
  if (was === 'play' && i < shownN) { ripple(fxEl, cur[i].x, cur[i].y); haptic(10); sfx.tap(); } // after the state change: never delays input
});
function onTap(i: number, now: number) {
  if (st.phase !== 'play' || !st.puzzle || i >= st.puzzle.nums.length) return;
  if (timeLeft(now) <= 0) { endRound(); return; }
  const p = st.puzzle, v = p.nums[i];
  if (v === p.answer) {
    pause(now); st.phase = 'feedback';
    const hadMistake = st.badTiles.size > 0;
    clearTimeout(capTimer);
    // the solved board shows only the two blue parts and the green answer: clear any wrong (coral) state first
    for (const t of tiles) { t.classList.remove('bad'); for (const a of t.getAnimations()) a.cancel(); }
    tiles[i].classList.add('ok'); // pops green now; the parts light up in their colours as the lines start (connect beat)
    const solved: Solved = { a: p.a, b: p.b, c: p.answer, nums: p.nums.slice(), n: st.n, ms: Math.round(now - st.shownAt) };
    st.solved.push(solved); addChip(solved, st.solved.length - 1);
    st.solve.push(now - st.shownAt);
    const prev = st.streak; st.score++; st.streak++; st.best = Math.max(st.best, st.streak);
    scoreTxt.textContent = String(st.score); setStreak(st.streak, prev);
    sfx.correct();
    const milestone = st.streak === 5 || st.streak === 10 || st.streak === 20;
    const newBest = st.prevBest > 0 && st.score === st.prevBest + 1;
    if (newBest) cueNewBest();
    const full = wantsFull(milestone || newBest || hadMistake), big = newBest || [3, 5, 10].includes(st.streak);
    // the connect beat (~1 s), then the counting lesson or the next puzzle; a tap skips the beat (and the lesson)
    connectBeat(solved, i, big, () => full ? runTeach(solved, i, nextPuzzle) : nextPuzzle(), nextPuzzle);
  } else {
    if (st.badTiles.has(i)) return; // no double penalty for re-tapping the same wrong tile
    st.badTiles.add(i); st.miss++;
    st.left -= PENALTY_MS;
    const t = tiles[i]; t.classList.add('bad');
    // gentle wobble (starts from the tap squish)
    t.animate([{ transform: 'scale(.92)' }, { transform: 'translateX(-5px) scale(.97)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 260, easing: 'ease-out' });
    wrongCaption(v); sfx.wrong();
    sfx.penalty({ delay: 0.15 }); // the audio pack sits the time-lost tick just under wrong()
    $('penalty').animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 700, easing: 'ease-out' });
    blazeWrong(st.streak > 0);
    const prev = st.streak; st.streak = 0; setStreak(0, prev);
    if (timeLeft(now) <= 0) endRound();
  }
}
function quit() { cancelTimers(); st.run++; st.phase = 'menu'; st.running = false; toMenu(); }

// ---------- leaderboard (localStorage, per N, top 10) ----------
const parse = (k: string): any[] | null => { try { const a = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(a) ? a : null; } catch { return null; } };
/** v1 had no level and no cap (largest tile 40-58), so every v1 score is kept as Hard. Runs once: v2 then exists. */
function migrateV1(): Entry[] {
  const old = parse(LS.boardV1) ?? [];
  const out: Entry[] = old.filter(e => e && typeof e.score === 'number' && [4, 5, 6, 7].includes(e.n)).map(e => ({ ...e, lv: 'hard' as Level }));
  saveAll(out);
  return out;
}
function loadAll(): Entry[] {
  const a = parse(LS.board);
  if (!a) return localStorage.getItem(LS.boardV1) ? migrateV1() : [];
  return a.map(e => (isLevel(e.lv) ? e : { ...e, lv: 'hard' }));
}
function saveAll(a: Entry[]) { try { localStorage.setItem(LS.board, JSON.stringify(a)); } catch { /* storage full/blocked */ } }
const nz = (x: number | null) => (x == null ? Infinity : x);
const cmp = (a: Entry, b: Entry) => b.score - a.score || b.streak - a.streak || nz(a.avg) - nz(b.avg) || a.at - b.at;
const boardFor = (lv: Level, n: number) => loadAll().filter(e => e.lv === lv && e.n === n).sort(cmp).slice(0, 10);
function qualifies(e: Entry) { if (e.score <= 0) return false; const b = boardFor(e.lv, e.n); return b.length < 10 || cmp(e, b[b.length - 1]) < 0; }
const sec = secLabel;

// ---------- results ----------
/** newBest sound: in-round when the old best is beaten, and at the gold #1 reveal on the results screen.
 * Never twice within 1.5 s (the in-round cue is always at least one full lesson, ~5 s, before the round can end). */
let lastNewBest = -Infinity;
function cueNewBest() { const now = performance.now(); if (now - lastNewBest < 1500) return; lastNewBest = now; sfx.newBest(); }

let pending: Entry | null = null, lastSaved = 0, fromGame = false;
function endRound() {
  if (st.phase === 'done') return;
  cancelTimers(); st.run++; pause(performance.now()); st.left = 0; drawTimer(0);
  st.phase = 'done';
  const avg = avgSolve(st.solve);
  const e: Entry = { name: '', lv: st.lv, n: st.n, score: st.score, streak: st.best, avg, miss: st.miss, at: Date.now() };
  $('rSub').innerHTML = `<span class="lvtag lv-${st.lv}">${lvName(st.lv)}</span> ${SHAPE[st.n]} · ${st.n} numbers · ${ROUND_MS / 1000}s round`;
  $('rScore').textContent = String(e.score);
  $('rStreak').textContent = `x${e.streak}`; $('rAvg').textContent = sec(avg); $('rMiss').textContent = String(e.miss);
  const q = qualifies(e);
  const pos = [...boardFor(e.lv, e.n), e].sort(cmp).indexOf(e) + 1;
  const top = q && pos === 1; // v0.3.1: a new #1 on this level + shape is an event (gold #1 card, Blaze in shades)
  $('rRank').innerHTML = q
    ? `<span class="pos">#${pos}${top ? '<i class="star" aria-label="new top score">★</i>' : ''}</span><span>${pos === 1 ? 'New top score' : 'Leaderboard place'} on ${LEVEL_NAME[e.lv]} ${SHAPE[e.n]}</span>`
    : `<span class="pos na">—</span><span>${e.score ? `Not in the ${LEVEL_NAME[e.lv]} ${SHAPE[e.n]} top 10 this time` : 'Solve one to get on the board'}</span>`;
  pending = q ? e : null;
  $('nameCard').classList.toggle('hidden', !q);
  nameIn.value = ''; renderSlots();
  fromGame = true;
  $('rRank').classList.toggle('gold', top); // v0.3.3 (GD): only the #1 card is gold; the score card stays white
  $('rBlaze').classList.toggle('cool', top);
  show('results');
  sfx.timeUp();
  if (top) { cueNewBest(); shower(); } // same tick (so the same frame) as the gold cards appear; v0.3.5: + the star shower
}
const nameIn = $('nameIn') as HTMLInputElement, nameSave = $('nameSave') as HTMLButtonElement, nameClear = $('nameClear') as HTMLButtonElement;
const nameSlots = [...document.querySelectorAll<HTMLElement>('.slots .nslot')];
function renderSlots() {
  const v = nameIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (nameIn.value !== v) nameIn.value = v;
  nameSlots.forEach((el, i) => { el.textContent = v[i] ?? ''; el.classList.toggle('cur', i === Math.min(v.length, 2) && document.activeElement === nameIn); });
  nameSave.disabled = !v.length; nameClear.disabled = !v.length;
}
nameIn.addEventListener('input', renderSlots);
nameIn.addEventListener('focus', renderSlots); nameIn.addEventListener('blur', renderSlots);
nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
nameClear.addEventListener('pointerdown', e => { e.preventDefault(); nameIn.value = ''; renderSlots(); nameIn.focus(); });
nameClear.addEventListener('click', e => { if (e.detail === 0) { nameIn.value = ''; renderSlots(); nameIn.focus(); } });
press(nameSave, saveName);
function saveName() {
  const name = nameIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (!pending || !name) return;
  const e = pending; pending = null; e.name = name;
  const all = loadAll(), same = (x: Entry) => x.n === e.n && x.lv === e.lv, mine = [...all.filter(same), e].sort(cmp).slice(0, 10);
  saveAll([...all.filter(x => !same(x)), ...mine]);
  lastSaved = e.at; nameIn.blur(); showBoards(e.n, e.lv);
}
press($('rRetry'), () => { pending = null; startRound(); });
press($('rMenu'), () => { pending = null; toMenu(); });

// ---------- leaderboard screen ----------
let boardN = 5, boardLv: Level = 'easy';
/** Level segmented control (menu + leaderboard): big two-line segments, "Easy" over "10". */
const levelSeg = (on: Level) => LEVELS.map(l => `<button type="button" role="radio" aria-checked="${l === on}" aria-label="${LEVEL_NAME[l]}, numbers up to ${CAP[l]}" class="lv-${l}${l === on ? ' on' : ''}" data-lv="${l}"><b>${LEVEL_NAME[l]}</b><span>${CAP[l]}</span></button>`).join('');
/** A shape a level cannot make (Easy: 6 or 7 numbers) is shown greyed and explains itself when tapped. */
const shapeOk = (lv: Level, n: number) => supports(n, lv);
const fallbackN = (lv: Level, n: number) => (shapeOk(lv, n) ? n : Math.max(...NS.filter(k => shapeOk(lv, k))));
const noShape = (lv: Level, n: number) => `${SHAPE[n]} needs Medium or Hard: ${n} different numbers up to ${CAP[lv]} can't make a fair board`;
function showBoards(n: number, lv: Level = boardLv) {
  n = fallbackN(lv, n); boardN = n; boardLv = lv;
  $('bLevels').innerHTML = levelSeg(lv);
  $('bTabs').innerHTML = NS.map(k => `<button type="button" role="tab" aria-label="${SHAPE[k]} (${k} numbers)" aria-selected="${k === n}" aria-disabled="${!shapeOk(lv, k)}" class="${k === n ? 'on' : ''}${shapeOk(lv, k) ? '' : ' off'}" data-n="${k}">${iconSvg(k)}</button>`).join('');
  $('bHead').innerHTML = `<span class="lvtag lv-${lv}">${lvName(lv)}</span> ${SHAPE[n]} · ${n} numbers`;
  const b = boardFor(lv, n);
  $('bRows').innerHTML = `<div class="row head"><span>#</span><span>Name</span><span class="r">Score</span><span class="r">Streak</span><span class="r">Avg</span></div>` +
    (b.length ? b.map((e, i) => `<div class="row${e.at === lastSaved ? ' you' : ''}"><span class="rk${i < 3 ? ' g' + (i + 1) : ''}">${i + 1}</span><span class="nm">${esc(e.name)}</span><span class="r">${e.score}</span><span class="r">x${e.streak}</span><span class="r">${sec(e.avg)}</span></div>`).join('')
      : `<div class="empty">No scores yet. Be the first!</div>`);
  $('bRetry').classList.toggle('hidden', !fromGame);
  show('boards');
}
press($('bTabs'), e => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; const k = +b.dataset.n!; if (!shapeOk(boardLv, k)) { $('bHead').textContent = noShape(boardLv, k); sfx.wrong(); return; } showBoards(k); });
press($('bLevels'), e => { const b = (e.target as HTMLElement).closest('button'); if (b && isLevel(b.dataset.lv)) { showBoards(boardN, b.dataset.lv); sfx.uiTap(); } });
press($('bRetry'), () => startRound());
press($('bMenu'), () => toMenu());

// ---------- menu ----------
const picker = $('picker');
picker.innerHTML = NS.map(k => `<button type="button" role="radio" aria-label="${SHAPE[k]} (${k} numbers)" data-n="${k}">${iconSvg(k)}</button>`).join('');
const levels = $('levels');
let note = '';
function renderPicker() {
  levels.innerHTML = levelSeg(st.lv);
  for (const b of picker.querySelectorAll<HTMLButtonElement>('button')) {
    const k = +b.dataset.n!, on = k === st.n, ok = shapeOk(st.lv, k);
    b.classList.toggle('on', on); b.classList.toggle('off', !ok); b.setAttribute('aria-checked', String(on)); b.setAttribute('aria-disabled', String(!ok));
  }
  const top = boardFor(st.lv, st.n)[0];
  $('bestLine').innerHTML = note ? `<span class="note-in">${esc(note)}</span>`
    : top ? `Best on ${LEVEL_NAME[st.lv]} ${SHAPE[st.n]}: <b>${top.score}</b> by <b>${esc(top.name)}</b>` : `${SHAPE[st.n]} · ${st.n} numbers up to ${CAP[st.lv]}`;
}
/** Menu preview (v0.3): the shape only, outline + plain corner dots, no numbers (it is a shape picker, not a board). */
function showShape() { st.puzzle = null; for (const t of tiles) { t.className = 'tile'; t.textContent = ''; } }
/** Build the level's board table in idle time so the first board of a round never waits for it (Medium 7: ~30 ms on desktop). */
const warm = () => { const f = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 50)); f(() => { try { generate(st.n, Math.random, undefined, st.lv); } catch { /* unsupported combo */ } }); };
let noteTimer = 0;
function flashNote(t: string) { note = t; clearTimeout(noteTimer); noteTimer = window.setTimeout(() => { note = ''; if (st.phase === 'menu') renderPicker(); }, 2600); renderPicker(); }
function setN(n: number, ms: number) { if (n === st.n) return; st.n = n; try { localStorage.setItem(LS.n, String(n)); } catch {} layout(n, ms); }
press(picker, e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const n = +b.dataset.n!;
  if (!shapeOk(st.lv, n)) { flashNote(noShape(st.lv, n)); sfx.wrong(); return; }
  if (n === st.n) return;
  note = ''; setN(n, SLIDE_MS); renderPicker(); warm();
  sfx.uiTap();
});
press(levels, e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b || !isLevel(b.dataset.lv) || b.dataset.lv === st.lv) return;
  st.lv = b.dataset.lv; try { localStorage.setItem(LS.lv, st.lv); } catch {}
  note = '';
  if (!shapeOk(st.lv, st.n)) { setN(fallbackN(st.lv, st.n), SLIDE_MS); flashNote(`${LEVEL_NAME[st.lv]} uses up to ${st.n} numbers, so the board is now a ${SHAPE[st.n]}`); }
  else renderPicker();
  warm(); sfx.uiTap();
});
function toMenu() {
  cancelTimers(); st.run++; st.phase = 'menu'; st.running = false; fromGame = false; pending = null;
  setMode('menu'); show('play'); setStreak(0, 0);
  if (!shapeOk(st.lv, st.n)) st.n = fallbackN(st.lv, st.n);
  note = ''; renderPicker(); showShape(); layout(st.n, 0); warm();
}
// v0.3.4 (GD/AE): sound toggle on the menu, left of Blaze. Muting sets the master gain to 0, clears playing/queued sounds (stopAll) and ignores every later
// hook; the tap plays uiTap only when it turns sound back on. Saved in localStorage ('kk.mute').
const muteBtn = $('mMute');
function drawMute() { const m = isMuted(); muteBtn.classList.toggle('off', m); muteBtn.setAttribute('aria-pressed', String(m)); muteBtn.setAttribute('aria-label', m ? 'Sound off' : 'Sound on'); }
press(muteBtn, () => { const m = !isMuted(); setMuted(m); drawMute(); if (!m) whenRunning(() => sfx.uiTap()); });
drawMute(); initAudio();
press($('mStart'), () => { startRound(); sfx.uiTap(); });
press($('mBoards'), () => { fromGame = false; showBoards(st.n, st.lv); sfx.uiTap(); });
const lab = initLab(press, () => toMenu());
press($('mLab'), () => { show('lab'); lab.open(); sfx.uiTap(); });
press($('gQuit'), quit);

{ const n = Number(localStorage.getItem(LS.n)); if ((NS as readonly number[]).includes(n)) st.n = n; }
/** Level: ?level= (testing, not saved) > saved choice > Easy for new players. A returning v0.2 player (saved shape or
 * scores, no level yet) starts on Hard, where their old scores now live. */
{
  const q = Q.get('level'), saved = localStorage.getItem(LS.lv);
  st.lv = isLevel(q) ? q : isLevel(saved) ? saved : (localStorage.getItem(LS.n) || localStorage.getItem(LS.boardV1)) ? 'hard' : 'easy';
}
boardN = st.n; boardLv = st.lv;
if (reducedMotion()) document.documentElement.classList.add('reduced');
preloadConfetti();
toMenu();
document.fonts?.ready.then(() => layout(shownN || st.n, 0));
