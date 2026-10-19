/**
 * Full teaching solve (v0.2, GD storyboard v2): parts burst into counters that fly into ten-frames at the board
 * centre, counters hop across to make a ten (captions), everything flows into the answer, then a part-whole bond
 * draws itself with confetti. Transforms + WAAPI only. teach() returns { done, skip }: skip() ends it at once.
 */
import { planTeach, type Plan } from './plan';
import { confetti, reducedMotion } from './fx';
import { sfx } from './sfx';

export interface TeachCtx {
  layer: HTMLElement;            // overlay inside the board (board coordinates)
  tiles: HTMLElement[];          // tile buttons
  centre: (i: number) => { x: number; y: number };
  n: number; iS: number; iL: number; iC: number; // tile indices: smaller part, larger part, answer
  onHop: () => void;             // Blaze hop
  onStage?: (s: string) => void; // progress hook (tests / analytics)
}
export interface TeachRun { done: Promise<void>; skip: () => void; plan: Plan }

const T = (x: number, y: number, s = 1) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s})`;

export function teach(ctx: TeachCtx, a: number, b: number): TeachRun {
  const plan = planTeach(a, b), reduced = reducedMotion();
  const layer = ctx.layer, w = layer.clientWidth, h = layer.clientHeight;
  const anims: Animation[] = [], els: HTMLElement[] = [];
  let over = false, resolve!: () => void;
  const done = new Promise<void>(r => (resolve = r));
  const add = <E extends HTMLElement | SVGElement>(el: E) => { layer.appendChild(el); els.push(el as any); return el; };
  const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => { const x = el.animate(kf, o); anims.push(x); return x; };
  const wait = (ms: number) => new Promise<boolean>(r => setTimeout(() => r(over), ms));
  const dim = (idx: number[] | 'all' | 'none') => ctx.tiles.forEach((t, i) => t.classList.toggle('dim', idx === 'all' || (Array.isArray(idx) && idx.includes(i))));
  const finish = () => { if (over) return; over = true; for (const x of anims) x.cancel(); for (const e of els) e.remove(); dim('none'); resolve(); };

  // ---------- geometry: every frame full size; up to 3 per row, rows stack ----------
  const nRows = Math.max(...plan.boxes.map(bx => bx.row)) + 1;
  const perRow = Math.max(...Array.from({ length: nRows }, (_, r) => plan.boxes.filter(bx => bx.row === r).length));
  const gap = 3, pad = 5, between = 10;
  const cs = Math.max(14, Math.min(22, Math.floor(((w - 12 - between * (perRow - 1)) / perRow - 2 * pad - 4 * gap) / 5)));
  const d = { w: 5 * cs + 4 * gap + 2 * pad, h: 2 * cs + gap + 2 * pad, cs, gap, pad };
  const fh = d.h, rowGap = 14, top0 = nRows === 1 ? h * 0.24 : h * (nRows === 2 ? 0.17 : 0.11);
  const rowY = Array.from({ length: nRows }, (_, r) => top0 + r * (fh + rowGap));
  const pos: { x: number; y: number }[] = [];
  for (let r = 0; r < nRows; r++) {
    const ids = plan.boxes.map((bx, i) => (bx.row === r ? i : -1)).filter(i => i >= 0);
    let x = (w - (ids.length * d.w + between * (ids.length - 1))) / 2;
    for (const i of ids) { pos[i] = { x, y: rowY[r] - fh / 2 }; x += d.w + between; }
  }
  const cell = (s: { box: number; cell: number }) => {
    const p = pos[s.box], col = s.cell % 5, row = Math.floor(s.cell / 5);
    return { x: p.x + pad + col * (cs + gap) + cs / 2, y: p.y + pad + row * (cs + gap) + cs / 2, s: 1 };
  };
  const capY = rowY[nRows - 1] + fh / 2 + 18;
  const A = { x: w / 2, y: h - 46 }; // the answer node under the frames; it later rises to be the bond's whole

  // ---------- elements ----------
  const plate = add(document.createElement('div')); plate.className = 'plate'; plate.style.width = w + 'px'; plate.style.height = h + 'px'; plate.style.opacity = '0';
  const frames = plan.boxes.map((bx, i) => {
    const f = add(document.createElement('div')); f.className = 'tf'; f.dataset.row = String(bx.row);
    f.style.left = pos[i].x + 'px'; f.style.top = pos[i].y + 'px'; f.style.setProperty('--cs', cs + 'px'); f.style.setProperty('--g', gap + 'px'); f.style.setProperty('--p', pad + 'px');
    f.innerHTML = '<i></i>'.repeat(10); f.style.opacity = '0';
    return f;
  });
  const D = cs - 5;
  const dots = plan.counters.map(c => {
    const e = add(document.createElement('i')); e.className = `ctr p${c.part}`;
    e.style.width = e.style.height = D + 'px'; e.style.margin = `${-D / 2}px 0 0 ${-D / 2}px`; e.style.opacity = '0';
    return e;
  });
  const caps = plan.captions.map((t, i) => {
    const e = add(document.createElement('div')); e.className = 'tcap'; e.textContent = t;
    e.style.top = capY + i * 34 + 'px'; e.style.opacity = '0';
    return e;
  });
  const ans = add(document.createElement('div')); ans.className = 'bnode whole'; ans.textContent = String(plan.c);
  ans.style.width = ans.style.height = '72px'; ans.style.left = A.x - 36 + 'px'; ans.style.top = A.y - 36 + 'px'; ans.style.opacity = '0'; ans.style.zIndex = '2';
  const skipHint = add(document.createElement('div')); skipHint.className = 'skiphint'; skipHint.textContent = 'Tap to skip';
  anim(skipHint, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 400, fill: 'both' });

  const fadeIn = (e: Element, ms = 220, delay = 0, dy = 6) => anim(e, [{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }], { duration: ms, delay, fill: 'both', easing: 'ease-out' });

  /*
   * v0.2.1 timeline (~3.0 s for 7 + 12): fly 0-0.7 s, hop + "make ten" 0.7-1.1 s, second caption 1.4 s,
   * then at ~1.85 s the make-ten fades WHILE the counters stream into the whole and the bond draws; confetti and
   * Blaze's hop play over the bond (no dead time with only the answer showing), hold, done ~3.0 s.
   */
  (async () => {
    const from = [ctx.centre(ctx.iS), ctx.centre(ctx.iL)];
    dim(ctx.tiles.map((_, i) => i).filter(i => i < ctx.n && i !== ctx.iS && i !== ctx.iL && i !== ctx.iC));
    // a clean plate fades over the board once the parts have burst, so frames + captions read clearly
    anim(plate, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: reduced ? 0 : 140, fill: 'both' });
    setTimeout(() => { if (!over) dim('all'); }, reduced ? 0 : 260);
    frames.forEach((f, i) => fadeIn(f, 180, reduced ? 0 : 120 + i * 30, 0));
    anim(ans, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: '.5' }, { opacity: 1, scale: '1' }], { duration: 240, delay: reduced ? 0 : 220, fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' });
    // 1. burst + fly into the ten-frames
    ctx.onStage?.('fly'); sfx.count(0);
    const FLY = 480, stag = Math.min(10, 160 / plan.c);
    let flyEnd = 0;
    plan.counters.forEach((c, j) => {
      const t = cell(c.slot), s = from[c.part];
      if (reduced) { anim(dots[j], [{ transform: T(t.x, t.y), opacity: 0 }, { transform: T(t.x, t.y), opacity: 1 }], { duration: 200, fill: 'both' }); return; }
      const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 18, bx = s.x + Math.cos(ang) * r, by = s.y + Math.sin(ang) * r;
      const mx = (bx + t.x) / 2 + (c.part ? 30 : -30), my = (by + t.y) / 2 - 40;
      const delay = j * stag;
      anim(dots[j], [
        { transform: T(s.x, s.y, 0.3), opacity: 0 },
        { transform: T(bx, by, 1.1), opacity: 1, offset: 0.22 },
        { transform: T(mx, my, 1), opacity: 1, offset: 0.6 },
        { transform: T(t.x, t.y), opacity: 1 },
      ], { duration: FLY, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
      flyEnd = Math.max(flyEnd, delay + FLY);
    });
    if (!reduced) [ctx.iS, ctx.iL].forEach(i => anim(ctx.tiles[i], [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 300 }));
    if (await wait(reduced ? 250 : flyEnd + 40)) return;
    // 2. make ten: k counters hop OUT of their frame into the open cells (they keep their own colour), then captions
    if (plan.k) {
      const hoppers = plan.counters.map((c, j) => ({ c, j })).filter(x => x.c.hop);
      let end = 0;
      hoppers.forEach(({ c, j }, m) => {
        const f = cell(c.slot), t = cell(c.hop!);
        const kf = reduced ? [{ transform: T(f.x, f.y) }, { transform: T(t.x, t.y) }]
          : [{ transform: T(f.x, f.y) }, { transform: T((f.x + t.x) / 2, Math.min(f.y, t.y) - 30, 1.15), offset: 0.5 }, { transform: T(t.x, t.y) }];
        anim(dots[j], kf, { duration: reduced ? 1 : 300, delay: reduced ? 0 : m * 30, easing: 'ease-in-out', fill: 'both' });
        end = Math.max(end, (reduced ? 0 : m * 30) + 300);
      });
      ctx.onStage?.('hop'); sfx.hop();
      if (await wait(reduced ? 150 : end)) return;
      const tgt = frames[plan.counters.find(c => c.hop)!.hop!.box];
      tgt.classList.add('ten'); sfx.makeTen(); ctx.onStage?.('ten');
      if (!reduced) anim(tgt, [{ scale: '1' }, { scale: '1.08', offset: 0.4 }, { scale: '1' }], { duration: 280 });
      fadeIn(caps[0]);
      if (await wait(reduced ? 400 : 320)) return;
      fadeIn(caps[1]); ctx.onStage?.('ten2');
      if (await wait(reduced ? 600 : 420)) return;
    } else {
      fadeIn(caps[0]); ctx.onStage?.('sum');
      if (await wait(reduced ? 700 : 560)) return;
    }
    // 3 + 4. handover (v0.2.2): the make-ten (frames, captions AND counters) fades out in place to opacity 0 first;
    // counters never move during the fade, so nothing slides out of its square. Only then does the answer rise into
    // the whole while the bond draws itself, and the cheer plays over the bond.
    ctx.onStage?.('absorb'); sfx.bond();
    const W = { x: w / 2, y: h * 0.27 }, P = [{ x: w / 2 - 88, y: h * 0.63 }, { x: w / 2 + 88, y: h * 0.63 }];
    const FADE = 200, RISE = reduced ? 1 : 300, B = FADE + 20; // B: when the bond starts (just after the fade has finished)
    [...frames, ...caps, ...dots].forEach(e => anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE, fill: 'both', easing: 'ease-in' }));
    anim(ans, [{ translate: '0 0', scale: '1' }, { translate: `${W.x - A.x}px ${W.y - A.y}px`, scale: String(88 / 72) }], { duration: RISE, delay: B, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'both', composite: 'replace' });
    if (!reduced) anim(ans, [{ scale: '1' }, { scale: '1.12', offset: 0.4 }, { scale: '1' }], { duration: 240, delay: B + RISE + 20, easing: 'ease-out', composite: 'accumulate' });
    const svg = add(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); svg.setAttribute('class', 'bondlines');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    P.forEach((p, i) => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', String(W.x)); l.setAttribute('y1', String(W.y)); l.setAttribute('x2', String(p.x)); l.setAttribute('y2', String(p.y));
      const len = Math.hypot(p.x - W.x, p.y - W.y); l.style.strokeDasharray = String(len); svg.appendChild(l);
      anim(l, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: reduced ? 1 : 280, delay: reduced ? B : B + 150 + i * 50, fill: 'both', easing: 'ease-out' });
    });
    const circ = (x: number, y: number, v: number, cls: string, delay: number, r: number) => {
      const e = add(document.createElement('div')); e.className = `bnode ${cls}`; e.textContent = String(v);
      e.style.width = e.style.height = 2 * r + 'px'; e.style.left = x - r + 'px'; e.style.top = y - r + 'px';
      anim(e, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1' }], { duration: reduced ? 200 : 280, delay: B + (reduced ? 0 : delay), fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' });
      return e;
    };
    circ(P[0].x, P[0].y, plan.S, 'p0', 170, 36); circ(P[1].x, P[1].y, plan.L, 'p1', 220, 36);
    const bc = add(document.createElement('div')); bc.className = 'tcap bondcap'; bc.textContent = plan.bond; bc.style.top = P[0].y + 58 + 'px';
    fadeIn(bc, 220, B + (reduced ? 0 : 280));
    if (await wait(B)) return;
    ctx.onStage?.('bond');
    if (await wait(reduced ? 200 : 200)) return;
    // cheer over the bond while it finishes drawing
    sfx.cheer(); ctx.onStage?.('cheer');
    confetti(layer, W.x, W.y, 26, (a, el) => { anims.push(a); els.push(el); });
    if (!reduced) ctx.onHop();
    if (await wait(reduced ? 780 : 800)) return;
    finish();
  })();
  return { done, skip: finish, plan };
}
