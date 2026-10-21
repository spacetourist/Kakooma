/**
 * Full teaching solve (v0.2, GD storyboard v2): parts burst into counters that fly into ten-frames at the board
 * centre, counters hop across to make a ten (captions), everything flows into the answer, then a part-whole bond
 * draws itself with confetti. Transforms + WAAPI only. teach() returns { done, skip }: skip() ends it at once.
 */
import { planTeach, countTiming, type Plan, type Pace } from './plan';
import { confetti, reducedMotion } from './fx';
import { sfx, stopAll } from './sfx';

export interface TeachCtx {
  layer: HTMLElement;            // overlay inside the board (board coordinates)
  tiles: HTMLElement[];          // tile buttons
  centre: (i: number) => { x: number; y: number };
  n: number; iS: number; iL: number; iC: number; // tile indices: smaller part, larger part, answer
  onHop: () => void;             // Blaze hop
  onStage?: (s: string) => void; // progress hook (tests / analytics)
  pace?: Pace;                   // v0.3.2: counting speed by level (default medium)
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
  /** sound-hook options: fire `ms` after now on the audio clock (the hook is called in the same tick as its animation) */
  const inMs = (ms: number) => ({ delay: Math.max(0, ms) / 1000 });
  const wait = (ms: number) => new Promise<boolean>(r => setTimeout(() => r(over), ms));
  const dim = (idx: number[] | 'all' | 'none') => ctx.tiles.forEach((t, i) => t.classList.toggle('dim', idx === 'all' || (Array.isArray(idx) && idx.includes(i))));
  /** cut = the lesson was cut short (skip, quit, round end): stop any sounds already scheduled on the audio clock */
  const finish = (cut = true) => { if (over) return; over = true; if (cut) stopAll(); for (const x of anims) x.cancel(); for (const e of els) e.remove(); dim('none'); resolve(); };

  // ---------- geometry: every frame full size; up to 3 per row, rows stack ----------
  const nRows = Math.max(...plan.boxes.map(bx => bx.row)) + 1;
  const perRow = Math.max(...Array.from({ length: nRows }, (_, r) => plan.boxes.filter(bx => bx.row === r).length));
  const gap = 3, pad = 5, between = 10;
  const cs = Math.max(14, Math.min(22, Math.floor(((w - 12 - between * (perRow - 1)) / perRow - 2 * pad - 4 * gap) / 5)));
  const d = { w: 5 * cs + 4 * gap + 2 * pad, h: 2 * cs + gap + 2 * pad, cs, gap, pad };
  const fh = d.h, rowGap = 14, top0 = nRows === 1 ? h * 0.24 : fh / 2 + 14; // v0.3.3.1: two rows sit near the top so the source row keeps its size
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
  // v0.3.3: the make-ten caption sits between the frames and the counter. v0.3.3.1 (GD): one row under the frames:
  // [smaller source 80] 12 [counter 120] 12 [larger source 80] (304 px, fits 360 px); the dots launch from the sources
  const lastBottom = rowY[nRows - 1] + fh / 2, CAPH = 46;
  const capY = lastBottom + 10;
  const K = Math.max(1.05, Math.min(120 / 72, (h - lastBottom - CAPH - 24) / 72)); // counter ~120 px, clear of the "Tap to skip" hint
  const C = { x: w / 2, y: lastBottom + CAPH + 36 * K };
  const A = { x: w / 2, y: h - 46 }; // the answer node's home box; it is shown at C (scale K) and rises from there to the bond's whole
  const SB = Math.round(Math.min(72 * K, Math.max(72, 80 * (72 * K) / 120))), // 80 next to a 120 counter; never under 72 (or taller than the counter)
    SG = 12, sx = 36 * K + SG + SB / 2; // source badge size; centre offset from C
  const src = [{ x: C.x - sx, y: C.y }, { x: C.x + sx, y: C.y }];

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
  const bridgeTen = plan.tens.find(t => t.caption);
  const cap = add(document.createElement('div')); cap.className = 'tcap mk10'; cap.textContent = bridgeTen?.caption ?? (plan.c < 10 ? `${plan.S} + ${plan.L} = ${plan.c}` : ''); cap.style.top = capY + 'px'; cap.style.opacity = '0'; // under ten: the sum, shown on the green total
  // source badges (v0.3.3.1, GD): filled tiles (#9cc0ff / #3a7bff, white number) that drain top to bottom like a glass as
  // their dots leave; the number stays readable (a coloured copy shows through where the fill has gone). Empty at the
  // group's end (partPop): shrink to 0.92 and become a coloured outline.
  const srcs = [plan.S, plan.L].map((v, i) => {
    const e = add(document.createElement('div')); e.className = `srcb p${i}`;
    e.style.width = e.style.height = SB + 'px'; e.style.left = src[i].x - SB / 2 + 'px'; e.style.top = src[i].y - SB / 2 + 'px';
    e.style.fontSize = Math.round(SB * 0.5) + 'px'; e.innerHTML = `<div class="over"><b>${v}</b></div><div class="fill"><b>${v}</b></div>`; e.style.opacity = '0';
    return e;
  });
  const ans = add(document.createElement('div')); ans.className = 'bnode whole counting'; ans.textContent = '0';
  ans.style.width = ans.style.height = '72px'; ans.style.left = A.x - 36 + 'px'; ans.style.top = A.y - 36 + 'px'; ans.style.opacity = '0'; ans.style.zIndex = '2'; ans.dataset.rest = `${C.x.toFixed(1)},${C.y.toFixed(1)},${(72 * K).toFixed(1)}`; // the counter's resting box (tests)
  const skipHint = add(document.createElement('div')); skipHint.className = 'skiphint'; skipHint.textContent = 'Tap to skip';
  anim(skipHint, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 400, fill: 'both' });

  const fadeIn = (e: Element, ms = 220, delay = 0, dy = 6) => anim(e, [{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }], { duration: ms, delay, fill: 'both', easing: 'ease-out' });
  const later = (ms: number, f: () => void) => setTimeout(() => { if (!over) f(); }, ms);

  (async () => {
    const from = src; // v0.3.3.1: every dot leaves its own source badge
    dim(ctx.tiles.map((_, i) => i).filter(i => i < ctx.n && i !== ctx.iS && i !== ctx.iL && i !== ctx.iC));
    // a clean plate fades over the board once the parts have burst, so frames + captions read clearly
    anim(plate, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: reduced ? 0 : 140, fill: 'both' });
    setTimeout(() => { if (!over) dim('all'); }, reduced ? 0 : 260);
    frames.forEach((f, i) => fadeIn(f, 180, reduced ? 0 : 120 + i * 30, 0));
    srcs.forEach((e, i) => anim(e, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: '.6' }, { opacity: 1, scale: '1' }], { duration: 220, delay: reduced ? 0 : 140 + i * 40, fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' }));
    const dC = `${C.x - A.x}px ${C.y - A.y}px`;
    anim(ans, reduced ? [{ opacity: 0, translate: dC, scale: String(K) }, { opacity: 1, translate: dC, scale: String(K) }]
      : [{ opacity: 0, translate: dC, scale: String(K * 0.5) }, { opacity: 1, translate: dC, scale: String(K) }], { duration: 240, delay: reduced ? 0 : 220, fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' });
    /*
     * 1. count + make ten (v0.3.3): the smaller part's dots (light blue) land one at a time in the cells, left to right;
     * the larger part's dots (dark blue) carry on into the empty cells of the same frame, then the next frames. The
     * counter (the answer tile, big, under the frames) goes up by exactly 1 per dot with a 1.12x pop. Each time a frame
     * completes it rings green and the counter flashes a green ring; the make-ten frame (where the colours meet) also
     * shows "7 + 3 = 10" and the count holds ~0.6 s on it. Each source badge drains as its dots leave and pops into an outline when its group is done (partPop);
     * the final count turns the tile green (total). Reduced motion: no flight (dots appear in place), no pops.
     */
    ctx.onStage?.('fly');
    const tm = countTiming(ctx.pace ?? 'medium', plan.S, plan.L, plan.bridge), T0 = 360; // frames are in by T0
    plan.counters.forEach((c, k) => {
      const t = cell(c.slot), s = from[c.part], start = T0 + tm.land[k] - tm.fly;
      if (reduced) { anim(dots[k], [{ transform: T(t.x, t.y), opacity: 0 }, { transform: T(t.x, t.y), opacity: 1 }], { duration: 120, delay: start + tm.fly - 120, fill: 'both' }); return; }
      const mx = (s.x + t.x) / 2 + (c.part ? 24 : -24), my = Math.min(s.y, t.y) - 34;
      anim(dots[k], [
        { transform: T(s.x, s.y, 0.4), opacity: 0 },
        { transform: T(s.x, s.y - 6, 1.1), opacity: 1, offset: 0.18 },
        { transform: T(mx, my, 1), opacity: 1, offset: 0.6 },
        { transform: T(t.x, t.y), opacity: 1 },
      ], { duration: tm.fly, delay: start, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' });
    });
    const tenAt = new Map(plan.tens.map(t => [t.n, t]));
    const ring = (frame: HTMLElement, ms: number) => {
      frame.classList.add('ten'); ans.classList.add('flash'); later(ms, () => ans.classList.remove('flash'));
      if (!reduced) anim(frame, [{ scale: '1' }, { scale: '1.06', offset: 0.4 }, { scale: '1' }], { duration: 260 });
    };
    // group ends, staggered so the sounds never stack on the last dot (Audio Engineer): each part's badge pop + partPop
    // 150 ms after its last dot's actual frame; the tile turns green + total() 150 ms after the second partPop (+300 ms after the last dot)
    const POP_AFTER = 150, GREEN_AFTER = 150, CAP_MS = 750;
    const evAt = [T0 + tm.land[plan.S - 1] + POP_AFTER, T0 + tm.land[plan.c - 1] + POP_AFTER, T0 + tm.land[plan.c - 1] + POP_AFTER + GREEN_AFTER];
    let ev = 0;
    // the counter: one rAF loop, at most +1 per frame, so every dot visibly adds exactly one (count(i) on that frame)
    const t0 = performance.now(); let shown = 0, launched = 0;
    const left = [-1, -1];
    /** the glass empties from the top: clip the fill layer down to the share of dots still in the badge */
    const drain = (i: 0 | 1, gone: number, n: number) => {
      if (left[i] === n - gone) return; left[i] = n - gone;
      srcs[i].style.setProperty('--d', `${(100 * gone / n).toFixed(2)}%`); // drives both the fill and the two number copies
    };
    const emptied = (i: number) => {
      srcs[i].classList.add('drained');
      anim(srcs[i], reduced ? [{ scale: '.92' }, { scale: '.92' }] : [{ scale: '1' }, { scale: '1.08', offset: 0.35 }, { scale: '.92' }], { duration: reduced ? 1 : 260, easing: 'ease-out', fill: 'forwards', composite: 'replace' });
    };
    (window as any).__kkCount = [];
    await new Promise<void>(res => {
      const step = () => {
        if (over) { res(); return; }
        const now = performance.now() - t0;
        while (launched < plan.c && now >= T0 + tm.land[launched] - tm.fly) launched++;
        drain(0, Math.min(launched, plan.S), plan.S); drain(1, Math.max(0, launched - plan.S), plan.L);
        if (shown < plan.c && now >= T0 + tm.land[shown]) {
          const k = shown++, part = k < plan.S ? 0 : 1;
          ans.textContent = String(shown);
          ans.classList.toggle('c1', part === 1);
          (window as any).__kkCount.push([shown, Math.round(now)]);
          sfx.count(k); // zero-based running total (the dot that makes 10 is count(9), the ten accent), on the frame this dot lands
          if (!reduced) anim(ans, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: Math.min(220, tm.every + 40), easing: 'ease-out' });
          // a frame completes: ring it + flash the counter (no extra sound: count(i) already carries the ten accent)
          const ten = tenAt.get(shown);
          if (ten) {
            if (ten.caption) {
              ring(frames[ten.box], CAP_MS); fadeIn(cap, 160, 0, 4); ctx.onStage?.('ten');
              if (shown < plan.c) later(CAP_MS, () => anim(cap, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }));
            } else ring(frames[ten.box], 380);
          }
          // keep the stagger relative to the frame the dot was actually counted on (a dropped/stalled frame must not
          // pull partPop onto the same frame as the last count())
          if (shown === plan.S) evAt[0] = Math.max(evAt[0], now + POP_AFTER);
          if (shown === plan.c) { evAt[1] = Math.max(evAt[1], now + POP_AFTER); evAt[2] = Math.max(evAt[2], evAt[1] + GREEN_AFTER); }
        }
        // group events on their own frames (badge pop + partPop together; green + total together)
        if (ev < 3 && now >= evAt[ev] && (ev === 0 ? shown >= plan.S : shown >= plan.c)) {
          if (ev < 2) { emptied(ev); sfx.partPop(ev); if (ev === 1) evAt[2] = Math.max(evAt[2], now + GREEN_AFTER); }
          else {
            ans.classList.remove('counting', 'c1', 'flash'); sfx.total(); ctx.onStage?.('counted');
            if (!bridgeTen && plan.c < 10) fadeIn(cap, 200, 0, 4);
            if (!reduced) anim(ans, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
          }
          ev++;
        }
        if (ev >= 3) { res(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    if (over) return;
    // a beat on the green total (v0.3.3: no separate make-ten step any more; it happened during the count)
    if (await wait(reduced ? 450 : tm.every > 200 ? 500 : 400)) return;
    // 3. handover (v0.2.2, unchanged): the make-ten (frames, captions AND counters) fades out in place to opacity 0
    // first; counters never move during the fade. Only then does the answer rise on its own into the whole.
    ctx.onStage?.('absorb');
    const W = { x: w / 2, y: h * 0.27 }, P = [{ x: w / 2 - 88, y: h * 0.63 }, { x: w / 2 + 88, y: h * 0.63 }];
    const FADE = 200, RISE = reduced ? 1 : 300, B = FADE + 20; // B: the answer starts rising (just after the fade)
    [...frames, cap, ...srcs, ...dots].forEach(e => anim(e, [{ opacity: getComputedStyle(e).opacity }, { opacity: 0 }], { duration: FADE, fill: 'both', easing: 'ease-in' }));
    // v0.3.3: the green counter rises straight from where it counted (no glide back under a make-ten step)
    anim(ans, [{ translate: dC, scale: String(K) }, { translate: `${W.x - A.x}px ${W.y - A.y}px`, scale: String(88 / 72) }], { duration: RISE, delay: B, easing: 'cubic-bezier(.3,.8,.4,1)', fill: 'both', composite: 'replace' });
    sfx.bond(inMs(B)); // the answer rises
    /*
     * 4. bond (v0.2.3, GD spec). Clock 0 = the answer reaches the top.
     *   Build 0-0.8 s: the answer settles, branch 1 then branch 2 grow down; part 1 pops at 0.34, part 2 at 0.58.
     *   0.8 s: the caption lands (fading in from 0.54) = cheer: one confetti burst + Blaze's hop.
     *   Read: soft pulses at 1.0 (part 1), 1.6 (part 2), 2.2 s (whole), each with its caption word; hold to 3.3 s.
     *   Clear 3.3-3.6 s: the bond fades, the strip returns to "? + ? = ?", then the next board.
     * Reduced motion: the same clock and hold, but things simply appear (short fades); no draw, scale, confetti or hop.
     */
    const R = B + RISE; // answer at the top (relative to the handover)
    const SETTLE = 100, BR = 240, POP = 220;
    const tB1 = SETTLE, tB2 = SETTLE + BR, tP1 = 340, tP2 = 580, CAPIN = 260, tCap = 800, PULSE = [1000, 1600, 2200], tClear = 3300, CLEAR = 300;
    if (!reduced) anim(ans, [{ scale: '1' }, { scale: '1.06', offset: 0.45 }, { scale: '1' }], { duration: 200, delay: R, easing: 'ease-out', composite: 'accumulate' });
    const svg = add(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); svg.setAttribute('class', 'bondlines');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    P.forEach((p, i) => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', String(W.x)); l.setAttribute('y1', String(W.y)); l.setAttribute('x2', String(p.x)); l.setAttribute('y2', String(p.y));
      const len = Math.hypot(p.x - W.x, p.y - W.y); l.style.strokeDasharray = String(len); svg.appendChild(l);
      // v0.2.3.1: a fully dash-offset line still paints its round end-caps as two grey specks at the part
      // positions, so each branch stays at opacity 0 until its own growth starts (fill: 'both' holds it hidden).
      l.style.opacity = '0';
      anim(l, reduced ? [{ strokeDashoffset: 0, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }] : [{ strokeDashoffset: len, opacity: 0 }, { opacity: 1, offset: 0.04 }, { strokeDashoffset: 0, opacity: 1 }],
        { duration: reduced ? 200 : BR, delay: R + (reduced ? 0 : i ? tB2 : tB1), fill: 'both', easing: reduced ? 'linear' : 'cubic-bezier(.4,0,.3,1)' });
    });
    const circ = (x: number, y: number, v: number, cls: string, at: number, r: number) => {
      const e = add(document.createElement('div')); e.className = `bnode ${cls}`; e.textContent = String(v);
      e.style.width = e.style.height = 2 * r + 'px'; e.style.left = x - r + 'px'; e.style.top = y - r + 'px';
      anim(e, reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1' }], { duration: reduced ? 200 : POP, delay: R + (reduced ? 0 : at), fill: 'both', easing: 'cubic-bezier(.34,1.56,.64,1)' });
      return e;
    };
    const parts = [circ(P[0].x, P[0].y, plan.S, 'p0', tP1, 36), circ(P[1].x, P[1].y, plan.L, 'p1', tP2, 36)];
    sfx.partPop(0, inMs(R + (reduced ? 0 : tP1))); sfx.partPop(1, inMs(R + (reduced ? 0 : tP2)));
    const bc = add(document.createElement('div')); bc.className = 'tcap bondcap'; bc.style.top = P[0].y + 58 + 'px';
    bc.innerHTML = `<span class="w p0">${plan.S}</span> and <span class="w p1">${plan.L}</span> make <span class="w whole">${plan.c}</span>`;
    const capIn = reduced ? 200 : CAPIN, capLand = R + tCap; // the caption has fully landed at +0.8 s
    fadeIn(bc, capIn, capLand - capIn, reduced ? 0 : 6);
    // soft pulses in turn through the read: part 1, part 2, the whole, each with its word in the caption
    const words = [...bc.querySelectorAll('.w')] as HTMLElement[];
    [parts[0], parts[1], ans].forEach((node, i) => {
      const t = R + PULSE[i];
      sfx.pulse(i, inMs(t)); // same tick as its pulse animation
      if (reduced) return;
      anim(node, [{ scale: '1' }, { scale: '1.1', offset: 0.4 }, { scale: '1' }], { duration: 520, delay: t, easing: 'ease-in-out', composite: 'accumulate' });
      anim(words[i], [{ scale: '1' }, { scale: '1.18', offset: 0.4 }, { scale: '1' }], { duration: 520, delay: t, easing: 'ease-in-out' });
    });
    if (await wait(R)) return;
    ctx.onStage?.('bond');
    if (await wait(tCap)) return;
    // the caption has landed and the bond is complete: one confetti burst onto the finished bond, Blaze hops
    ctx.onStage?.('cheer'); sfx.caption(); sfx.cheer();
    confetti(layer, W.x, P[0].y, Math.max(80, Math.abs(P[1].x - P[0].x) / 2 + 50)); // v0.3.5: two angled bursts from either side of the bond (canvas, keeps falling after a skip)
    if (!reduced) ctx.onHop();
    if (await wait(tClear - tCap)) return; // hold: 2.5 s of reading after the caption lands
    // clear: the bond fades, then teach ends and the caller restores "? + ? = ?" and shows the next board
    ctx.onStage?.('clear');
    [ans, ...parts, bc, svg as unknown as HTMLElement, plate].forEach(e => anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: CLEAR, fill: 'forwards', easing: 'ease-in' }));
    if (await wait(CLEAR)) return;
    finish(false);
  })();
  return { done, skip: finish, plan };
}
