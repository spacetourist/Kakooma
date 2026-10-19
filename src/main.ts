import './style.css';
import { generate, type Puzzle } from './puzzle';

const $ = (id: string) => document.getElementById(id)!;
const NS = [4, 5, 6, 7] as const;
const SHAPE: Record<number, string> = { 4: 'Square', 5: 'Pentagon', 6: 'Hexagon', 7: 'Heptagon' };
const Q = new URLSearchParams(location.search);
/** Round length; ?round=<seconds> shortens it for testing. */
const ROUND_MS = Math.max(5, Math.min(600, Number(Q.get('round')) || 60)) * 1000;
const PENALTY_MS = 3000;          // wrong tap
const FEEDBACK_MS = 500;          // correct-answer feedback; the round timer is PAUSED for it
const SLIDE_MS = 250;             // picker change: tiles slide to the new corners
const LS = { board: 'kk.board.v1', n: 'kk.n' };
const MAX = 7;

type Phase = 'menu' | 'play' | 'feedback' | 'done';
interface Entry { name: string; n: number; score: number; streak: number; avg: number | null; miss: number; at: number }

const st = {
  phase: 'menu' as Phase, n: 5, puzzle: null as Puzzle | null,
  left: ROUND_MS, since: 0, running: false,
  score: 0, miss: 0, streak: 0, best: 0, solve: [] as number[], shownAt: 0, pausedAt: 0,
  badTiles: new Set<number>(), timers: new Set<number>(), run: 0,
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
function cancelTimers() { for (const h of st.timers) clearTimeout(h); st.timers.clear(); }
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// ---------- version ----------
{ const [ma, mi, pa] = __VERSION__.split('.'); $('verLabel').textContent = `v${ma}.${mi}${pa && pa !== '0' ? '.' + pa : ''}`; }

// ---------- polygon geometry ----------
const ang = (n: number, i: number) => -Math.PI / 2 + (n === 4 ? Math.PI / 4 : 0) + (2 * Math.PI * i) / n;
function unitPoly(n: number) { return Array.from({ length: n }, (_, i) => [Math.cos(ang(n, i)), Math.sin(ang(n, i))] as [number, number]); }
function iconSvg(n: number) {
  const p = unitPoly(n).map(([x, y]) => [20 + 15 * x, 20 + 15 * y]);
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><polygon points="${p.map(q => q.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>${p.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="currentColor"/>`).join('')}</svg>`;
}

// ---------- board ----------
const board = $('board'), poly = $('outlinePoly'), eq = $('eq');
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
  st.puzzle = p; eq.classList.remove('on');
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
}
function sigh() {
  blazeBody.animate([{ transform: 'scale(1)' }, { transform: 'scale(.85) translateY(3px)', offset: 0.25 }, { transform: 'scale(.85) translateY(3px)', offset: 0.75 }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-in-out' });
  for (const l of blaze.querySelectorAll('.lid, .mouth')) l.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: 460, delay: 80 });
}

// ---------- timer ----------
const timerEl = $('timer'), timerTxt = $('timerTxt'), segsEl = $('segs'), scoreTxt = $('scoreTxt');
segsEl.innerHTML = '<i></i>'.repeat(10);
const segs = [...segsEl.children] as HTMLElement[];
const timeLeft = (now: number) => (st.running ? st.left - (now - st.since) : st.left);
function pause(now: number) { if (st.running) { st.left = timeLeft(now); st.running = false; } }
function resume(now: number) { if (!st.running) { st.since = now; st.running = true; } }
let lastTenth = -1, lastSegs = -1, lastLow: boolean | null = null, loop = 0;
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
  if (st.phase !== 'play' && st.phase !== 'feedback') { loop = 0; return; }
  const left = timeLeft(performance.now());
  drawTimer(left);
  if (left <= 0 && st.phase === 'play') { endRound(); loop = 0; return; }
  loop = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => {
  if (st.phase !== 'play') return;
  const now = performance.now();
  if (document.hidden) { pause(now); st.pausedAt = now; }
  else { st.shownAt += now - st.pausedAt; resume(now); }
});

// ---------- round ----------
const play = $('play');
function setMode(m: 'menu' | 'game') { play.dataset.mode = m; }
function show(id: 'play' | 'results' | 'boards') { for (const s of ['play', 'results', 'boards']) $(s).classList.toggle('hidden', s !== id); }

function startRound() {
  cancelTimers(); st.run++;
  Object.assign(st, { phase: 'play', left: ROUND_MS, running: false, score: 0, miss: 0, streak: 0, best: 0, solve: [] });
  scoreTxt.textContent = '0'; setStreak(0, 0); lastTenth = lastSegs = -1; lastLow = null; drawTimer(ROUND_MS);
  setMode('game'); show('play');
  layout(st.n, 0);
  nextPuzzle();
  if (!loop) loop = requestAnimationFrame(tick);
}
function nextPuzzle() {
  st.badTiles.clear();
  showPuzzle(generate(st.n), true);
  const now = performance.now();
  st.shownAt = now; st.phase = 'play'; resume(now);
}
board.addEventListener('pointerdown', e => {
  const t = (e.target as HTMLElement).closest('.tile') as HTMLElement | null;
  if (!t) return; e.preventDefault();
  onTap(+t.dataset.i!, e.timeStamp);
});
function onTap(i: number, now: number) {
  if (st.phase !== 'play' || !st.puzzle || i >= st.puzzle.nums.length) return;
  if (timeLeft(now) <= 0) { endRound(); return; }
  const p = st.puzzle, v = p.nums[i];
  if (v === p.answer) {
    pause(now); st.phase = 'feedback';
    tiles[i].classList.add('ok');
    tiles[p.nums.indexOf(p.a)].classList.add('add'); tiles[p.nums.indexOf(p.b)].classList.add('add');
    eq.textContent = `${p.a} + ${p.b} = ${p.answer}`; eq.classList.add('on');
    st.solve.push(now - st.shownAt);
    const prev = st.streak; st.score++; st.streak++; st.best = Math.max(st.best, st.streak);
    scoreTxt.textContent = String(st.score); setStreak(st.streak, prev);
    later(nextPuzzle, FEEDBACK_MS);
  } else {
    if (st.badTiles.has(i)) return; // no double penalty for re-tapping the same wrong tile
    st.badTiles.add(i); st.miss++;
    st.left -= PENALTY_MS;
    const t = tiles[i]; t.classList.add('bad');
    t.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 220 });
    $('penalty').animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 700, easing: 'ease-out' });
    if (st.streak > 0) sigh();
    const prev = st.streak; st.streak = 0; setStreak(0, prev);
    if (timeLeft(now) <= 0) endRound();
  }
}
function quit() { cancelTimers(); st.run++; st.phase = 'menu'; st.running = false; toMenu(); }

// ---------- leaderboard (localStorage, per N, top 10) ----------
function loadAll(): Entry[] { try { const a = JSON.parse(localStorage.getItem(LS.board) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
function saveAll(a: Entry[]) { try { localStorage.setItem(LS.board, JSON.stringify(a)); } catch { /* storage full/blocked */ } }
const nz = (x: number | null) => (x == null ? Infinity : x);
const cmp = (a: Entry, b: Entry) => b.score - a.score || b.streak - a.streak || nz(a.avg) - nz(b.avg) || a.at - b.at;
const boardFor = (n: number) => loadAll().filter(e => e.n === n).sort(cmp).slice(0, 10);
function qualifies(e: Entry) { if (e.score <= 0) return false; const b = boardFor(e.n); return b.length < 10 || cmp(e, b[b.length - 1]) < 0; }
const sec = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);

// ---------- results ----------
let pending: Entry | null = null, lastSaved = 0, fromGame = false;
function endRound() {
  if (st.phase === 'done') return;
  cancelTimers(); st.run++; pause(performance.now()); st.left = 0; drawTimer(0);
  st.phase = 'done';
  const avg = st.solve.length ? Math.round(st.solve.reduce((s, x) => s + x, 0) / st.solve.length) : null;
  const e: Entry = { name: '', n: st.n, score: st.score, streak: st.best, avg, miss: st.miss, at: Date.now() };
  $('rSub').textContent = `${SHAPE[st.n]} · ${st.n} numbers · ${ROUND_MS / 1000}s round`;
  $('rScore').textContent = String(e.score);
  $('rStreak').textContent = `x${e.streak}`; $('rAvg').textContent = sec(avg); $('rMiss').textContent = String(e.miss);
  const q = qualifies(e);
  const pos = [...boardFor(e.n), e].sort(cmp).indexOf(e) + 1;
  $('rRank').innerHTML = q
    ? `<span class="pos">#${pos}</span><span>${pos === 1 ? 'New top score' : 'Leaderboard place'} on the ${SHAPE[e.n]} board</span>`
    : `<span class="pos na">—</span><span>${e.score ? `Not in the ${SHAPE[e.n]} top 10 this time` : 'Solve one to get on the board'}</span>`;
  pending = q ? e : null;
  $('nameCard').classList.toggle('hidden', !q);
  nameIn.value = ''; renderSlots();
  fromGame = true;
  show('results');
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
  const all = loadAll(), mine = [...all.filter(x => x.n === e.n), e].sort(cmp).slice(0, 10);
  saveAll([...all.filter(x => x.n !== e.n), ...mine]);
  lastSaved = e.at; nameIn.blur(); showBoards(e.n);
}
press($('rRetry'), () => { pending = null; startRound(); });
press($('rMenu'), () => { pending = null; toMenu(); });

// ---------- leaderboard screen ----------
let boardN = 5;
function showBoards(n: number) {
  boardN = n;
  $('bTabs').innerHTML = NS.map(k => `<button type="button" role="tab" aria-label="${SHAPE[k]} (${k} numbers)" aria-selected="${k === n}" class="${k === n ? 'on' : ''}" data-n="${k}">${iconSvg(k)}</button>`).join('');
  $('bHead').textContent = `${SHAPE[n]} · ${n} numbers`;
  const b = boardFor(n);
  $('bRows').innerHTML = `<div class="row head"><span>#</span><span>Name</span><span class="r">Score</span><span class="r">Streak</span><span class="r">Avg</span></div>` +
    (b.length ? b.map((e, i) => `<div class="row${e.at === lastSaved ? ' you' : ''}"><span class="rk${i < 3 ? ' g' + (i + 1) : ''}">${i + 1}</span><span class="nm">${esc(e.name)}</span><span class="r">${e.score}</span><span class="r">x${e.streak}</span><span class="r">${sec(e.avg)}</span></div>`).join('')
      : `<div class="empty">No scores yet. Be the first!</div>`);
  $('bRetry').classList.toggle('hidden', !fromGame);
  show('boards');
}
press($('bTabs'), e => { const b = (e.target as HTMLElement).closest('button'); if (b) showBoards(+b.dataset.n!); });
press($('bRetry'), () => startRound());
press($('bMenu'), () => toMenu());

// ---------- menu ----------
const picker = $('picker');
picker.innerHTML = NS.map(k => `<button type="button" role="radio" aria-label="${SHAPE[k]} (${k} numbers)" data-n="${k}">${iconSvg(k)}</button>`).join('');
function renderPicker() {
  for (const b of picker.querySelectorAll<HTMLButtonElement>('button')) { const on = +b.dataset.n! === st.n; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
  const top = boardFor(st.n)[0];
  $('bestLine').innerHTML = top ? `Best on ${SHAPE[st.n]}: <b>${top.score}</b> by <b>${esc(top.name)}</b>` : `${SHAPE[st.n]} · ${st.n} numbers`;
}
press(picker, e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const n = +b.dataset.n!; if (n === st.n) return;
  st.n = n; try { localStorage.setItem(LS.n, String(n)); } catch {}
  renderPicker(); showPuzzle(generate(n), false); layout(n, SLIDE_MS);
});
function toMenu() {
  cancelTimers(); st.run++; st.phase = 'menu'; st.running = false; fromGame = false; pending = null;
  setMode('menu'); show('play'); setStreak(0, 0);
  renderPicker(); showPuzzle(generate(st.n), false); layout(st.n, 0);
}
press($('mStart'), () => startRound());
press($('mBoards'), () => { fromGame = false; showBoards(st.n); });
press($('gQuit'), quit);

{ const n = Number(localStorage.getItem(LS.n)); if ((NS as readonly number[]).includes(n)) st.n = n; }
boardN = st.n; void boardN;
toMenu();
document.fonts?.ready.then(() => layout(shownN || st.n, 0));
