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

  // ---------- geometry ----------
  const big = plan.c > 20, cs = big ? 18 : 22, gap = 3, pad = 5, mcs = 9, mgap = 2, mpad = 4;
  const dims = (kind: 'frame' | 'mini') => kind === 'frame'
    ? { w: 5 * cs + 4 * gap + 2 * pad, h: 2 * cs + gap + 2 * pad, cs, gap, pad }
    : { w: 5 * mcs + 4 * mgap + 2 * mpad, h: 2 * mcs + mgap + 2 * mpad, cs: mcs, gap: mgap, pad: mpad };
  const rows = [0, 1].filter(r => plan.boxes.some(bx => bx.row === r));
  const fh = dims('frame').h, rowY = rows.length === 1 ? [h * 0.24] : [h * 0.17, h * 0.17 + fh + 18];
  const pos: { x: number; y: number; d: ReturnType<typeof dims> }[] = [];
  for (const r of rows) {
    const ids = plan.boxes.map((bx, i) => (bx.row === r ? i : -1)).filter(i => i >= 0);
    const total = ids.reduce((s, i) => s + dims(plan.boxes[i].kind).w, 0) + 12 * (ids.length - 1);
    let x = (w - total) / 2;
    for (const i of ids) { const d = dims(plan.boxes[i].kind); pos[i] = { x, y: rowY[rows.indexOf(r)] - d.h / 2, d }; x += d.w + 12; }
  }
  const cell = (s: { box: number; cell: number }) => {
    const p = pos[s.box], col = s.cell % 5, row = Math.floor(s.cell / 5);
    return { x: p.x + p.d.pad + col * (p.d.cs + p.d.gap) + p.d.cs / 2, y: p.y + p.d.pad + row * (p.d.cs + p.d.gap) + p.d.cs / 2, s: p.d.cs / cs };
  };
  const capY = (rows.length === 1 ? rowY[0] + fh / 2 : rowY[1] + fh / 2) + 22;
  const A = { x: w / 2, y: h - 46 }; // the answer node under the frames; it later rises to be the bond's whole

  // ---------- elements ----------
  const plate = add(document.createElement('div')); plate.className = 'plate'; plate.style.width = w + 'px'; plate.style.height = h + 'px'; plate.style.opacity = '0';
  const frames = plan.boxes.map((bx, i) => {
    const f = add(document.createElement('div')); f.className = `tf ${bx.kind}`;
    f.style.left = pos[i].x + 'px'; f.style.top = pos[i].y + 'px'; f.style.setProperty('--cs', pos[i].d.cs + 'px'); f.style.setProperty('--g', pos[i].d.gap + 'px'); f.style.setProperty('--p', pos[i].d.pad + 'px');
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

  (async () => {
    const from = [ctx.centre(ctx.iS), ctx.centre(ctx.iL)];
    dim(ctx.tiles.map((_, i) => i).filter(i => i < ctx.n && i !== ctx.iS && i !== ctx.iL && i !== ctx.iC));
    // a clean plate fades over the board once the parts have burst, so frames + captions read clearly
    anim(plate, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: reduced ? 0 : 160, fill: 'both' });
    setTimeout(() => { if (!over) dim('all'); }, reduced ? 0 : 300);
    frames.forEach((f, i) => fadeIn(f, 200, 160 + i * 40, 0));
    anim(ans, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: '.5' }, { opacity: 1, scale: '1' }], { duration: 260, delay: reduced ? 0 : 240, fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' });
    // 1. burst + fly into the ten-frames
    ctx.onStage?.('fly'); sfx.count(0);
    const stag = Math.min(12, 200 / plan.c);
    let flyEnd = 0;
    plan.counters.forEach((c, j) => {
      const t = cell(c.slot), s = from[c.part];
      if (reduced) { anim(dots[j], [{ transform: T(t.x, t.y, t.s), opacity: 0 }, { transform: T(t.x, t.y, t.s), opacity: 1 }], { duration: 200, fill: 'both' }); return; }
      const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 18, bx = s.x + Math.cos(ang) * r, by = s.y + Math.sin(ang) * r;
      const mx = (bx + t.x) / 2 + (c.part ? 30 : -30), my = (by + t.y) / 2 - 40;
      const delay = j * stag;
      anim(dots[j], [
        { transform: T(s.x, s.y, 0.3), opacity: 0 },
        { transform: T(bx, by, 1.1), opacity: 1, offset: 0.22 },
        { transform: T(mx, my, 1), opacity: 1, offset: 0.6 },
        { transform: T(t.x, t.y, t.s), opacity: 1 },
      ], { duration: 560, delay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'both' });
      flyEnd = Math.max(flyEnd, delay + 560);
    });
    if (!reduced) [ctx.iS, ctx.iL].forEach(i => anim(ctx.tiles[i], [{ transform: 'scale(1)' }, { transform: 'scale(1.15)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 300 }));
    if (await wait(reduced ? 250 : flyEnd + 60)) return;
    // 2. make ten: k counters hop across, then the captions
    if (plan.k) {
      const hoppers = plan.counters.map((c, j) => ({ c, j })).filter(x => x.c.hop);
      let end = 0;
      hoppers.forEach(({ c, j }, m) => {
        const f = cell(c.slot), t = cell(c.hop!);
        const kf = reduced ? [{ transform: T(f.x, f.y, f.s) }, { transform: T(t.x, t.y, t.s) }]
          : [{ transform: T(f.x, f.y, f.s) }, { transform: T((f.x + t.x) / 2, Math.min(f.y, t.y) - 34, 1.15), offset: 0.5 }, { transform: T(t.x, t.y, t.s) }];
        anim(dots[j], kf, { duration: reduced ? 1 : 340, delay: reduced ? 0 : m * 40, easing: 'ease-in-out', fill: 'both' });
        end = Math.max(end, (reduced ? 0 : m * 40) + 340);
      });
      ctx.onStage?.('hop'); sfx.hop();
      if (await wait(reduced ? 150 : end)) return;
      const tgt = frames[plan.counters.find(c => c.hop)!.hop!.box];
      tgt.classList.add('ten'); sfx.makeTen(); ctx.onStage?.('ten');
      if (!reduced) anim(tgt, [{ scale: '1' }, { scale: '1.08', offset: 0.4 }, { scale: '1' }], { duration: 300 });
      fadeIn(caps[0]);
      if (await wait(reduced ? 400 : 400)) return;
      fadeIn(caps[1]); ctx.onStage?.('ten2');
      if (await wait(reduced ? 700 : 560)) return;
    } else {
      fadeIn(caps[0]); ctx.onStage?.('sum');
      if (await wait(reduced ? 700 : 700)) return;
    }
    // 3. everything flows into the answer
    ctx.onStage?.('absorb');
    plan.counters.forEach((c, j) => {
      const f = cell(c.hop ?? c.slot);
      anim(dots[j], [{ transform: T(f.x, f.y, f.s), opacity: 1 }, { transform: T(A.x, A.y, 0.3), opacity: 0 }],
        { duration: reduced ? 200 : 320, delay: reduced ? 0 : j * Math.min(5, 140 / plan.c), easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'both' });
    });
    [...frames, ...caps].forEach(e => anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'both' }));
    if (await wait(reduced ? 220 : 380)) return;
    if (!reduced) anim(ans, [{ scale: '1' }, { scale: '1.2', offset: 0.35 }, { scale: '1' }], { duration: 300, easing: 'ease-out' });
    if (await wait(reduced ? 0 : 200)) return;
    // 4. part-whole bond draws itself + cheer
    dim('all'); sfx.bond(); ctx.onStage?.('bond');
    const W = { x: w / 2, y: h * 0.27 }, P = [{ x: w / 2 - 88, y: h * 0.63 }, { x: w / 2 + 88, y: h * 0.63 }];
    const svg = add(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); svg.setAttribute('class', 'bondlines');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    P.forEach((p, i) => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', String(W.x)); l.setAttribute('y1', String(W.y)); l.setAttribute('x2', String(p.x)); l.setAttribute('y2', String(p.y));
      const len = Math.hypot(p.x - W.x, p.y - W.y); l.style.strokeDasharray = String(len); svg.appendChild(l);
      anim(l, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: reduced ? 1 : 300, delay: reduced ? 0 : 160 + i * 60, fill: 'both', easing: 'ease-out' });
    });
    const circ = (x: number, y: number, v: number, cls: string, delay: number, r: number) => {
      const e = add(document.createElement('div')); e.className = `bnode ${cls}`; e.textContent = String(v);
      e.style.width = e.style.height = 2 * r + 'px'; e.style.left = x - r + 'px'; e.style.top = y - r + 'px';
      anim(e, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1' }], { duration: reduced ? 200 : 320, delay: reduced ? 0 : delay, fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' });
      return e;
    };
    // the answer node rises to become the whole; the parts pop in below it
    anim(ans, [{ translate: '0 0', scale: '1' }, { translate: `${W.x - A.x}px ${W.y - A.y}px`, scale: String(88 / 72) }], { duration: reduced ? 1 : 360, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'forwards', composite: 'replace' });
    circ(P[0].x, P[0].y, plan.S, 'p0', 260, 36); circ(P[1].x, P[1].y, plan.L, 'p1', 320, 36);
    const bc = add(document.createElement('div')); bc.className = 'tcap bondcap'; bc.textContent = plan.bond; bc.style.top = P[0].y + 58 + 'px';
    fadeIn(bc, 260, reduced ? 0 : 420);
    if (await wait(reduced ? 200 : 360)) return;
    sfx.cheer(); ctx.onStage?.('cheer');
    confetti(layer, W.x, W.y, 26, (a, el) => { anims.push(a); els.push(el); });
    if (!reduced) ctx.onHop();
    if (await wait(reduced ? 1100 : 1050)) return;
    finish();
  })();
  return { done, skip: finish, plan };
}
