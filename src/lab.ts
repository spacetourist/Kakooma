/** Bond Lab (v0.2): untimed. Pick a whole 5-20, split its counters with a slider, collect every bond for a star, then a missing-part quiz. */
import { confetti, haptic, squish } from './fx';
import { sfx } from './sfx';

const $ = (id: string) => document.getElementById(id)!;
const KEY = 'kk.lab.v1';
const WHOLES = Array.from({ length: 16 }, (_, i) => i + 5);
const QUIZ_LEN = 5;
interface Saved { stars: number[]; found: Record<string, number[]> }
const pairsFor = (w: number) => Math.floor(w / 2); // unordered pairs a + b = w with a, b >= 1

function load(): Saved {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { stars: Array.isArray(s.stars) ? s.stars : [], found: s.found && typeof s.found === 'object' ? s.found : {} }; }
  catch { return { stars: [], found: {} }; }
}
function save(s: Saved) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* blocked */ } }

export function initLab(press: (el: Element, fn: (e: Event) => void) => void, onMenu: () => void) {
  const lab = { w: 10, v: 5, data: load(), quiz: null as null | { qs: number[]; i: number; firstTry: number; missed: boolean } };
  (window as any).__lab = lab;
  const slider = $('labSlider') as HTMLInputElement, dots = $('labDots'), eq = $('labEq'), found = $('labFound');
  const nodes = { w: $('labW'), a: $('labA'), b: $('labB') };
  let idle = 0;

  function foundSet() { return new Set(lab.data.found[lab.w] ?? []); }
  function renderWholes() {
    $('labWholes').innerHTML = WHOLES.map(w => `<button type="button" class="${w === lab.w ? 'on' : ''}${lab.data.stars.includes(w) ? ' star' : ''}" data-w="${w}" aria-label="Whole ${w}">${w}</button>`).join('');
    $('labStars').textContent = `★ ${lab.data.stars.length} / ${WHOLES.length}`;
  }
  function renderSplit() {
    const w = lab.w, v = lab.v, b = w - v;
    nodes.w.textContent = String(w); nodes.a.textContent = String(v); nodes.b.textContent = String(b);
    eq.innerHTML = `<b>${w}</b> = <span class="p0">${v}</span> + <span class="p1">${b}</span>`;
    // counters in ten-frames, like the game: the first part fills from the start (light), the rest is the second part
    let html = '';
    for (let f = 0; f * 10 < w; f++) {
      let cells = '';
      for (let i = f * 10; i < f * 10 + 10; i++) cells += i < w ? `<i><span class="ctr ${i < v ? 'p0' : 'p1'}"></span></i>` : '<i></i>';
      html += `<div class="tf">${cells}</div>`;
    }
    dots.innerHTML = html;
    slider.style.setProperty('--pct', `calc(19px + (100% - 38px) * ${((v - 1) / Math.max(1, w - 2)).toFixed(4)})`);
  }
  function renderFound() {
    const f = [...foundSet()].sort((x, y) => x - y);
    found.innerHTML = f.map(a => `<span class="chip" data-a="${a}">${a} + ${lab.w - a}</span>`).join('') || '<span class="none">Slide to find a bond</span>';
    $('labCount').textContent = `${f.length} / ${pairsFor(lab.w)}`;
    const starred = lab.data.stars.includes(lab.w), q = $('labQuizBtn') as HTMLButtonElement;
    const more = pairsFor(lab.w) - f.length;
    q.disabled = !starred; q.textContent = starred ? 'Quiz: missing part' : `Quiz: find ${more} more`;
    $('labStar').classList.toggle('on', starred);
  }
  function setWhole(w: number) {
    lab.w = w; lab.v = Math.floor(w / 2); slider.max = String(w - 1); slider.min = '1'; slider.value = String(lab.v);
    closeQuiz(); renderWholes(); renderSplit(); renderFound();
  }
  function register() {
    const a = Math.min(lab.v, lab.w - lab.v), f = foundSet();
    if (f.has(a)) return;
    f.add(a); lab.data.found[lab.w] = [...f]; sfx.labPair(a);
    if (f.size === pairsFor(lab.w) && !lab.data.stars.includes(lab.w)) {
      lab.data.stars.push(lab.w); sfx.star(); haptic(30);
      const st = $('labStar'); st.classList.add('on');
      st.animate([{ transform: 'scale(.2) rotate(-40deg)' }, { transform: 'scale(1.4) rotate(10deg)', offset: 0.6 }, { transform: 'scale(1) rotate(0)' }], { duration: 650, easing: 'ease-out' });
      const r = $('labBond').getBoundingClientRect(), L = $('labFx').getBoundingClientRect();
      confetti($('labFx'), r.x - L.x + r.width / 2, r.y - L.y + 40, 30);
    }
    save(lab.data); renderFound(); renderWholes();
    const chip = found.querySelector(`[data-a="${a}"]`) as HTMLElement | null;
    chip?.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }
  slider.addEventListener('input', () => {
    const v = +slider.value; if (v === lab.v) return; // once per step change
    lab.v = v; renderSplit(); sfx.slide(v);
    clearTimeout(idle); idle = window.setTimeout(register, 350); // a bond counts once the slider rests on it
  });
  slider.addEventListener('change', () => { clearTimeout(idle); register(); });
  press($('labWholes'), e => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; squish(b); setWhole(+b.dataset.w!); });

  // ---------- missing part quiz ----------
  const quizEl = $('labQuiz');
  function closeQuiz() { lab.quiz = null; quizEl.classList.add('hidden'); $('labMain').classList.remove('hidden'); }
  function openQuiz() {
    const w = lab.w, pool = Array.from({ length: w - 1 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    lab.quiz = { qs: pool.slice(0, QUIZ_LEN), i: 0, firstTry: 0, missed: false };
    quizEl.classList.remove('hidden'); $('labMain').classList.add('hidden'); askQuiz();
    sfx.quizStart();
  }
  function askQuiz() {
    const q = lab.quiz!, w = lab.w;
    if (q.i >= q.qs.length) {
      $('labQ').innerHTML = `<span class="done">${q.firstTry} / ${q.qs.length}</span>`;
      $('labQSub').textContent = q.firstTry === q.qs.length ? 'Perfect! Every missing part first time.' : 'Nice work! Try again to get them all first time.';
      $('labOpts').innerHTML = `<button type="button" class="btn primary sm" data-act="again">Again</button><button type="button" class="btn ghost sm" data-act="close">Done</button>`;
      return;
    }
    const p = q.qs[q.i], ans = w - p;
    const opts = new Set([ans]);
    for (const d of [1, -1, 2, -2, 3, -3, 10, -10]) { if (opts.size >= 4) break; const o = ans + d; if (o >= 0 && o <= w && o !== ans) opts.add(o); }
    $('labQ').innerHTML = `<b>${w}</b> = <span class="p0">${p}</span> + <span class="q">?</span>`;
    $('labQSub').textContent = `Question ${q.i + 1} of ${q.qs.length} · what goes with ${p} to make ${w}?`;
    $('labOpts').innerHTML = [...opts].sort(() => Math.random() - 0.5).map(o => `<button type="button" class="opt" data-o="${o}">${o}</button>`).join('');
    q.missed = false;
  }
  press($('labOpts'), e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null; const q = lab.quiz; if (!b || !q) return;
    if (b.dataset.act === 'again') { openQuiz(); return; }
    if (b.dataset.act === 'close') { closeQuiz(); return; }
    if (b.classList.contains('ok') || b.classList.contains('bad')) return;
    const p = q.qs[q.i], ans = lab.w - p;
    haptic(10); squish(b);
    if (+b.dataset.o! === ans) {
      b.classList.add('ok'); sfx.correct(); if (!q.missed) q.firstTry++;
      $('labQ').innerHTML = `<b>${lab.w}</b> = <span class="p0">${p}</span> + <span class="p1">${ans}</span>`;
      const i = q.i; setTimeout(() => { if (lab.quiz === q && q.i === i) { q.i++; askQuiz(); } }, 650);
    } else {
      b.classList.add('bad'); q.missed = true; sfx.wrong();
      b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 });
    }
  });
  press($('labQuizBtn'), () => { if (!($('labQuizBtn') as HTMLButtonElement).disabled) openQuiz(); });
  press($('labMenu'), () => { closeQuiz(); onMenu(); });

  return { open() { lab.data = load(); setWhole(lab.w); } };
}
