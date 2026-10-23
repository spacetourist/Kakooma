// v0.3.8 "quiet solves + board reset": node scripts/v038.mjs [baseUrl]
// Both Show counting modes: no confetti during play (results #1 shower only), the correct-tile pop 1 -> 1.12 -> 1 in
// 180 ms + white tick badge + green ring 1 -> 1.4x in 300 ms, Blaze's 240 ms hop on every solve (sound pack v04's hop()
// on ordinary solves, the pack rotates its 3 plops; no pose sound with it; cheer on 3/5), the ~700 ms board reset (collapse 280 / beat 60 /
// emerge 360, clockwise stagger, ease-out-back ~1.15, numbers at 60 %, lines draw in, collapse()/emerge() v04 sounds), taps
// ignored during it, the round timer paused until the board is ready, the ON lesson unchanged vs v0.3.7 (compared
// against /tmp/base037/dist when present), reduced motion = 200 ms crossfade, 4x CPU perf. Shots: shots/v038-*.png
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { execFileSync } from 'child_process';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const OLD = process.env.KK_BASE_DIST || '/tmp/base037/dist', HAVE_OLD = existsSync(join(OLD, 'index.html'));
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const serve = root => createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '');
  if (!p || p === '/') p = '/index.html';
  const f = join(root, p); if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
});
const server = serve(ROOT), oldServer = serve(OLD); // v0.3.7 (the baseline for the ON lesson) on its own port, also under /Kakooma/
await new Promise(r => server.listen(0, '127.0.0.1', r)); await new Promise(r => oldServer.listen(0, '127.0.0.1', r));
const LOCAL = `http://127.0.0.1:${server.address().port}`, OLDURL = `http://127.0.0.1:${oldServer.address().port}/Kakooma/`;
const LIVE = !!process.argv[2], BASE = process.argv[2] || `${LOCAL}/Kakooma/`, TAG = LIVE ? 'live-' : '';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const fails = [], log = []; const check = (c, m) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
const P1 = { nums: [3, 7, 10, 2, 9], a: 3, b: 7, answer: 10 }, P2 = { nums: [4, 8, 1, 12, 6], a: 4, b: 8, answer: 12 };
const nextP = k => (k % 2 ? P2 : P1); // the puzzle served for solve k (k = 1 is the round's first board)

// test-only page instrumentation: sfx log, taps, long tasks, a rAF sampler, and a freeze (timers + rAF queue while
// frozen, running animations pause, so a shot is exactly one moment; the reset's promise chain waits with them)
const INIT = () => {
  window.__sfxLog = []; window.__taps = []; window.__kkSolveFx = []; window.__lt = []; window.__kkSpeedyMs = 0;
  document.addEventListener('pointerdown', () => window.__taps.push(performance.now()), true);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  const _st = window.setTimeout.bind(window), _raf = window.requestAnimationFrame.bind(window);
  window.__raf = _raf; window.__st0 = _st; window.__frozen = false; window.__q = []; window.__paused = [];
  window.setTimeout = (f, ms, ...a) => _st(() => { if (window.__frozen) window.__q.push(() => f(...a)); else f(...a); }, ms);
  window.requestAnimationFrame = f => _raf(t => { if (window.__frozen) window.__q.push(() => f(performance.now())); else f(t); });
  window.__fz = []; window.__freeze = () => { window.__fzAt = performance.now(); window.__frozen = true; window.__paused = document.getAnimations().filter(a => a.playState === 'running'); window.__paused.forEach(a => a.pause()); };
  window.__thaw = () => { window.__fz.push([window.__fzAt, performance.now()]); window.__frozen = false; window.__paused.forEach(a => { if (a.playState !== 'paused') return; const end = a.effect?.getComputedTiming().endTime ?? 0; if (a.currentTime >= end) a.finish(); else a.play(); }); /* play() on an animation at its end would auto-rewind it to 0 */ const q = window.__q; window.__q = []; q.forEach(f => f()); };
  const M = el => { const m = getComputedStyle(el).transform; if (!m || m === 'none') return [1, 0, 0]; const v = m.match(/-?[\d.e]+/g).map(Number); return [Math.hypot(v[0], v[1]), v[4], v[5]]; };
  // per-frame sampler, started at the tap: phase, reset stage, timer, answer pop, tick, ring, slots, numbers, outline
  window.__sampleFrom = (ansI, ms) => {
    window.__smp = []; const t0 = window.__taps.at(-1) ?? performance.now(), st = window.__kk, board = document.getElementById('board');
    const f = () => {
      const now = performance.now(), t = now - t0, tiles = [...board.querySelectorAll('.tile')];
      const tk = board.querySelector('.tick'), rg = document.querySelector('#fx .okring'), dot = document.querySelector('#fx .rdot');
      const poly = document.getElementById('outlinePoly'), outl = document.getElementById('outline');
      const n = st.puzzle?.nums.length ?? 5;
      window.__smp.push({ t, ph: st.phase, rs: st.resetStage, run: st.running, left: st.left, score: st.score,
        ans: M(tiles[ansI])[0], tick: tk ? M(tk)[0] : null, ring: rg ? [M(rg)[0], +getComputedStyle(rg).opacity] : null,
        slots: tiles.slice(0, n).map(tl => { const s = tl.parentElement, [k, x, y] = M(s); const nm = tl.querySelector('.n'); return [k, x, y, +getComputedStyle(s).opacity, nm ? +getComputedStyle(nm).opacity : -1, tl.textContent]; }),
        dash: +getComputedStyle(poly).strokeDashoffset.replace('px', '') || 0, outO: +getComputedStyle(outl).opacity, outS: M(outl)[0],
        dot: dot ? +getComputedStyle(dot).opacity : null, hop: document.getElementById('blazeBody').getAnimations().some(a => a.effect?.getTiming().duration === 240 && a.effect.composite === 'add') });
      if (t < ms) _raf(f);
    };
    _raf(f);
  };
  window.__frames = []; window.__frameRec = on => { window.__frOn = on; window.__frGen = (window.__frGen || 0) + 1; if (on) { window.__frames = []; const gen = window.__frGen; const g = () => { if (!window.__frOn || gen !== window.__frGen) return; window.__frames.push(performance.now()); _raf(g); }; _raf(g); } };
};

async function newPage(o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(INIT);
  await page.addInitScript(on => { try { localStorage.setItem('kk.lesson', on ? '1' : '0'); localStorage.setItem('kk.lv', 'easy'); localStorage.setItem('kk.n', '5'); } catch {} }, !!o.lesson);
  const url = (o.base || BASE) + '?level=easy' + (o.reduced ? '&reduced' : '') + (o.round ? `&round=${o.round}` : '');
  await page.goto(url); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(500);
  return { ctx, page, errs };
}
const H = page => {
  const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
  const tapXY = (x, y) => page.touchscreen.tap(x, y);
  const tileXY = async i => { const bb = await page.locator(`.tile[data-i="${i}"]`).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const tapTile = async i => { const [x, y] = await tileXY(i); await tapXY(x, y); };
  const waitPlay = (t = 30000) => page.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach && !window.__kk.resetStage, null, { timeout: t });
  const ansI = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
  const start = async () => { await kk(p => { window.__kkNext = [p]; }, P1); const bb = await page.locator('#mStart').boundingBox(); await tapXY(bb.x + bb.width / 2, bb.y + bb.height / 2); await waitPlay(); await wait(350); };
  // freeze at `ms` after a reference time (fn returns it, or null while unknown), screenshot, thaw
  const shotAt = async (ref, ms, path) => {
    await kk(([ref, ms]) => { window.__shotAt = null; const R = new Function('return (' + ref + ')()'); const el = r0 => performance.now() - r0 - window.__fz.reduce((a, [p, q]) => a + Math.max(0, q - Math.max(p, r0)), 0); // page time since r0, minus earlier shots' frozen time
    const f = () => { const r0 = R(); if (r0 != null && el(r0) >= ms) { window.__freeze(); const over = el(r0) - ms; for (const a of window.__paused) a.currentTime = Math.max(0, a.currentTime - over); window.__shotAt = ms; window.__shotLate = Math.round(over); } else window.__st0(f, 1); }; window.__st0(f, 1); }, [ref, ms]); // v0.3.8 final: poll every ~1-4 ms (not per frame) and rewind the paused animations by the few ms of overshoot, so a shot is exactly its moment
    for (let k = 0; k < 800 && (await kk(() => window.__shotAt)) == null; k++) await new Promise(r => setTimeout(r, 10));
    const at = await kk(() => window.__shotAt), late = await kk(() => window.__shotLate); if (late > 8) console.log(`note: shot ${path} frozen ${late} ms late (animations rewound)`);
    if (path) await page.screenshot({ path });
    await kk(() => window.__thaw());
    return at;
  };
  return { kk, wait, tapXY, tileXY, tapTile, waitPlay, ansI, start, shotAt };
};
const REF_TAP = '() => window.__taps.at(-1) ?? null';
const REF_RESET = '() => { const L = window.__kkReset.log, c = L.findLast(e => e[0] === "collapse"); return c && c[1] > (window.__taps.at(-1) ?? 0) ? c[1] : null; }';
const r0 = x => Math.round(x);

// ---------- A. Show counting OFF: 5 solves ----------
{
  const { ctx, page, errs } = await newPage({ lesson: false }); const h = H(page);
  const ver = await h.kk(() => document.getElementById('verLabel').textContent);
  check(/v?0\.3\.8/.test(ver), `version label: "${ver}"`);
  await h.start();
  const c0 = await h.kk(() => window.__kkConfetti.length);
  const res = [];
  for (let k = 1; k <= 5; k++) {
    await h.kk(p => { window.__kkNext = [p]; }, nextP(k));
    const i = await h.ansI(), score0 = await h.kk(() => window.__kk.score), left0 = await h.kk(() => window.__kk.left);
    await h.kk(() => { window.__l0 = window.__sfxLog.length; window.__r0 = window.__kkReset.log.length; window.__b0 = window.__kkBlaze.length; window.__tp0 = window.__taps.length; });
    await h.tapTile(i);
    await h.kk(i => window.__sampleFrom(i, 2100), i);
    let ignored = null;
    if (k === 2) { // taps during the reset (collapse, beat, emerge x2) on the new board's answer spot and another tile: all ignored
      const nx = nextP(k), ai = nx.nums.indexOf(nx.answer), [ax, ay] = await h.tileXY(ai), [ox, oy] = await h.tileXY((ai + 2) % 5);
      const tapsAt = [];
      for (const [stage, after, x, y] of [['collapse', 100, ax, ay], ['beat', 0, ox, oy], ['emerge', 60, ax, ay], ['emerge', 250, ax, ay]]) {
        await page.waitForFunction(([s, a]) => { const e = window.__kkReset.log.slice(window.__r0).findLast(e => e[0] === s); return e && performance.now() - e[1] >= a; }, [stage, after], { polling: 'raf', timeout: 5000 });
        await h.tapXY(x, y); tapsAt.push(await h.kk(s => [s, window.__kk.resetStage, window.__kk.phase], stage));
      }
      ignored = tapsAt;
    }
    await h.waitPlay(); await h.wait(450);
    const r = await h.kk(() => {
      const tp = window.__taps[window.__tp0], L = window.__sfxLog.slice(window.__l0), R = window.__kkReset.log.slice(window.__r0);
      const at = n => L.filter(e => e[0] === n).map(e => Math.round(e[2] - tp)), st = name => { const e = R.find(e => e[0] === name); return e ? Math.round(e[1] - tp) : null; };
      return { tp, score: window.__kk.score, miss: window.__kk.miss, left: window.__kk.left, shownAt: Math.round(window.__kk.shownAt - tp), running: window.__kk.running,
        stages: { collapse: st('collapse'), beat: st('beat'), emerge: st('emerge'), ready: st('ready') }, names: L.map(e => e[0]),
        hop: L.filter(e => e[0] === 'hop').map(e => e[3]), blaze: L.filter(e => e[0] === 'blaze').map(e => e[3] ?? e[1]),
        sounds: { correct: at('correct'), link: at('link'), collapse: at('collapse'), emerge: at('emerge'), streak: at('streak'), tap: at('tap'), wrong: at('wrong'), cheer: at('cheer'), hop: at('hop') },
        poses: window.__kkBlaze.slice(window.__b0).map(e => e[0] ?? e), smp: window.__smp, taps: window.__taps.length - window.__tp0, solveFx: window.__kkSolveFx.at(-1) };
    });
    res.push({ k, i, score0, left0, ignored, ...r });
  }
  const cN = await h.kk(() => window.__kkConfetti.slice());
  check(cN.length === c0, `OFF: no confetti during play (5 solves incl. streak 3 and 5): ${cN.length - c0} confetti/shower calls`);
  for (const r of res) {
    const S = r.stages, sm = r.smp;
    check(r.score === r.score0 + 1, `OFF solve ${r.k}: score ${r.score0} -> ${r.score} (+1)`);
    // pop
    const pops = sm.filter(s => s.t < 400 && s.ph === 'feedback'), peak = Math.max(...pops.map(s => s.ans)), tPeak = pops.find(s => s.ans === peak)?.t, back = pops.filter(s => s.t >= 200 && s.t < 450);
    if (r.k === 1 || r.k === 4) {
      check(peak > 1.09 && peak <= 1.125 && tPeak > 30 && tPeak < 140 && back.length && back.every(s => Math.abs(s.ans - 1) < 0.01), `OFF solve ${r.k}: answer pops 1 -> ${peak.toFixed(3)} (at ${r0(tPeak)} ms) -> 1 by 180-200 ms (${back.map(s => s.ans.toFixed(3)).slice(0, 2).join(', ')})`);
      const tk = sm.filter(s => s.tick != null && s.t < 400), tkPeak = Math.max(...tk.map(s => s.tick)), tkEnd = tk.filter(s => s.t > 220);
      check(tk.length && tk[0].t < 40 && tkPeak > 1.1 && tkPeak < 1.25 && tkEnd.every(s => Math.abs(s.tick - 1) < 0.01), `OFF solve ${r.k}: tick badge pops on with the tile (first seen ${r0(tk[0]?.t)} ms, peak ${tkPeak.toFixed(2)}, then 1)`);
      const rg = sm.filter(s => s.ring), rgMax = Math.max(...rg.map(s => s.ring[0])), rgLast = rg.at(-1), gone = sm.filter(s => s.t > 360 && s.t < 900).every(s => !s.ring);
      check(rg.length && rg[0].ring[1] > 0.5 && rgMax > 1.3 && rgMax <= 1.401 && rgLast.t < 340 && gone, `OFF solve ${r.k}: one green ring ripples 1 -> ${rgMax.toFixed(2)}x while fading (opacity ${rg[0].ring[1].toFixed(2)} -> ${rgLast.ring[1].toFixed(2)}), gone after ${r0(rgLast.t)} ms`);
      const tickLife = sm.filter(s => s.tick != null).at(-1)?.t;
      check(tickLife > S.collapse && tickLife <= S.beat + 20, `OFF solve ${r.k}: the tick rides the collapse and goes with the old numbers (last seen ${r0(tickLife)} ms; collapse ${S.collapse}, beat ${S.beat})`);
    }
    check(sm.some(s => s.hop && s.t < 300), `OFF solve ${r.k}: Blaze hops (240 ms additive hop)`);
    // reset timings
    const dC = S.beat - S.collapse, dB = S.emerge - S.beat, dE = S.ready - S.emerge, tot = S.ready - S.collapse;
    check(S.collapse >= 990 && S.collapse < 1060 && dC >= 265 && dC < 305 && dB >= 45 && dB < 85 && dE >= 345 && dE < 385 && tot >= 685 && tot < 730,
      `OFF solve ${r.k}: reset after the ${S.collapse} ms beat: collapse ${dC} / beat ${dB} / emerge ${dE} ms = ${tot} ms, ready at ${S.ready} ms`);
    check(r.sounds.collapse.length === 1 && Math.abs(r.sounds.collapse[0] - S.collapse) <= 2 && r.sounds.emerge.length === 1 && Math.abs(r.sounds.emerge[0] - S.emerge) <= 2,
      `OFF solve ${r.k}: collapse() at ${r.sounds.collapse} (stage ${S.collapse}), emerge() at ${r.sounds.emerge} (stage ${S.emerge}); correct ${r.sounds.correct}, link ${r.sounds.link}`);
    // timer paused through the beat and the reset; restarts at ready
    const runBefore = sm.filter(s => s.t < S.ready - 5).some(s => s.run), runAfter = sm.filter(s => s.t > S.ready + 20).every(s => s.run);
    check(!runBefore && runAfter && Math.abs(r.shownAt - S.ready) <= 2, `OFF solve ${r.k}: round timer paused until the board is ready (running before ready: ${runBefore}; solve clock starts at ${r.shownAt} ms = ready ${S.ready})`);
    if (r.k === 1 || r.k === 4) {
      // collapse geometry: everything slides to the centre at 0.2x, fading; emerge: clockwise stagger, scale overshoot, numbers at 60 %, lines draw in
      const cs = sm.filter(s => s.rs === 'collapse'), last = cs.at(-1), first = sm.find(s => s.rs === 'collapse');
      const W = 390, mid = await h.kk(() => { const b = document.getElementById('board'); return [b.clientWidth / 2, b.clientHeight / 2]; });
      const minS = Math.min(...cs.flatMap(s => s.slots.map(q => q[0]))), endD = Math.max(...last.slots.map(q => Math.hypot(q[1] - mid[0], q[2] - mid[1])));
      check(minS < 0.3 && last.slots.every(q => q[3] < 0.25) && endD < 30 && first.slots[0][0] > 0.9 && last.outS < 0.35 && last.outO < 0.25,
        `OFF solve ${r.k}: collapse: tiles + lines slide to the centre (last frame ${r0(endD)} px off, scale ${minS.toFixed(2)}, opacity <= ${Math.max(...last.slots.map(q => q[3])).toFixed(2)}; outline ${last.outS.toFixed(2)}x)`);
      const stagC = [0, 1, 2, 3, 4].map(j => cs.find(s => s.slots[j][0] < 0.97)?.t ?? 1e9);
      check(stagC.every((t, j) => j === 0 || t >= stagC[j - 1] - 1), `OFF solve ${r.k}: collapse staggered clockwise (tile starts ${stagC.map(t => r0(t - S.collapse)).join('/')} ms)`);
      const em = sm.filter(s => s.rs === 'emerge'), emS = Math.max(...em.flatMap(s => s.slots.map(q => q[0])));
      const stagE = [0, 1, 2, 3, 4].map(j => em.find(s => s.slots[j][3] > 0.02)?.t ?? 1e9);
      const ang = em.at(-1).slots.map(q => Math.atan2(q[2] - mid[1], q[1] - mid[0]));
      const cw = ang.every((a, j) => j === 0 || ((a - ang[j - 1] + 2 * Math.PI) % (2 * Math.PI)) < Math.PI); // y-down: increasing atan2 = clockwise on screen
      check(emS > 1.1 && emS < 1.2 && stagE.every((t, j) => j === 0 || t >= stagE[j - 1]) && cw, `OFF solve ${r.k}: emerge: ease-out-back (scale peak ${emS.toFixed(3)}), clockwise stagger (tile starts ${stagE.map(t => r0(t - S.emerge)).join('/')} ms)`);
      // numbers: hidden until the tile is ~60 % of the way out (progress = distance from centre / final distance)
      const fin = sm.find(s => s.t > S.ready + 10) ?? sm.at(-1);
      let early = 0, late = 0, firstSeen = [];
      for (let j = 0; j < 5; j++) {
        const D = Math.hypot(fin.slots[j][1] - mid[0], fin.slots[j][2] - mid[1]); let seen = null;
        for (const s of em) { const u = Math.hypot(s.slots[j][1] - mid[0], s.slots[j][2] - mid[1]) / D; if (s.slots[j][4] > 0.05 && seen == null) seen = u; if (u < 0.5 && s.slots[j][4] > 0.05 && s.slots[j][3] > 0) early++; }
        firstSeen.push(seen); if (!(fin.slots[j][4] > 0.99)) late++;
      }
      check(early === 0 && late === 0 && firstSeen.every(u => u == null || u >= 0.55), `OFF solve ${r.k}: numbers fade in at >= 60 % of the way out (first visible at ${firstSeen.map(u => u == null ? '-' : (u * 100).toFixed(0) + '%').join('/')}), all 1 at ready`);
      // transform + opacity only: the outline scales out from the centre on the tiles' curve, just behind them, fading in
      const os = em.map(s => s.outS), oo = em.map(s => s.outO), behind = em.every(s => s.outS <= Math.max(...s.slots.map(q => Math.hypot(q[1] - mid[0], q[2] - mid[1]) / Math.hypot(fin.slots[0][1] - mid[0], fin.slots[0][2] - mid[1]))) + 0.02);
      check(os[0] < 0.2 && Math.max(...os) > 0.9 && oo[0] < 0.3 && behind && em.every(s => s.dash === 0) && Math.abs(fin.outS - 1) < 1e-3 && fin.outO === 1, `OFF solve ${r.k}: the outline draws in behind the tiles (scale ${os[0].toFixed(2)} -> ${Math.max(...os).toFixed(2)} -> 1, opacity ${oo[0].toFixed(2)} -> 1, never ahead of the tiles; no dash-offset paint)`);
      const nb = nextP(r.k); // the board queued before solve k is the one that emerges after it check(fin.slots.map(q => q[5]).join(',') === nb.nums.join(',') && fin.slots.every(q => Math.abs(q[0] - 1) < 1e-3 && q[3] > 0.999), `OFF solve ${r.k}: next board ready with the new numbers (${fin.slots.map(q => q[5]).join(',')}), every tile at 1x, opaque (${fin.slots.map(q => q[0].toFixed(3) + '/' + q[3]).join(' ')})`);
      const dot = sm.filter(s => s.dot != null), dotMax = Math.max(...dot.map(s => s.dot)), dotAt = dot.find(s => s.dot === dotMax)?.t;
      check(dotMax > 0.6 && dotAt >= S.collapse + 230 && dotAt <= S.emerge + 60, `OFF solve ${r.k}: the blue dot pulses once at the centre (peak opacity ${dotMax.toFixed(2)} at ${r0(dotAt)} ms; beat ${S.beat}-${S.emerge})`);
    }
    if (r.ignored) {
      const extra = r.taps;
      check(r.ignored.every(x => x[2] === 'feedback') && r.score === r.score0 + 1 && r.miss === 0 && !r.sounds.tap.some(t => t > 100) && !r.sounds.wrong.length && extra >= 5 && S.ready - S.collapse < 790,
        `OFF solve ${r.k}: ${extra - 1} taps during the reset (${r.ignored.map(x => x[1]).join(', ')}) all ignored: score ${r.score}, miss ${r.miss}, no tap/wrong sounds, no skip (ready after ${S.ready - S.collapse} ms)`);
    }
  }
  // Blaze: hop sound alternates on ordinary solves; cheer at 3 and 5 (streak at the tap, OFF)
  const ord = res.filter(r => ![3, 5].includes(r.k));
  const hops = ord.flatMap(r => r.hop);
  check(ord.every(r => r.hop.length === 1 && r.sounds.hop.length === 1 && r.sounds.hop[0] < 60) && hops.every(x => x === undefined), `OFF: ordinary solves 1/2/4 sound through the pack's hop() once each, on the hop's first frame (${ord.map(r => r.sounds.hop[0]).join('/')} ms after the tap; no thumbs/clap stand-in)`);
  check(ord.every(r => !r.blaze.length && !r.poses.length), `OFF: no pose change on ordinary solves (blaze log ${ord.map(r => r.blaze.length).join('/')}, poses ${ord.map(r => r.poses.join('+') || '-').join('/')})`);
  for (const k of [3, 5]) { const r = res[k - 1];
    const stOk = k === 5 ? r.sounds.streak.length === 1 && r.sounds.streak[0] < 40 : !r.sounds.streak.length; // streak(n) is the x5/x10/x20 tier sound
    check(r.hop.length === 0 && r.blaze.includes('cheer') && r.poses.includes('cheer') && stOk && r.stages.collapse < 1060, `OFF streak ${k}: Blaze cheers (blaze ${r.blaze.join(',')}, pose ${r.poses.join(',')})${k === 5 ? `, streak(5) at the tap (${r.sounds.streak} ms)` : ''}, no hop sound, no held board (reset at ${r.stages.collapse} ms)`); }
  check(!errs.length, `OFF: no page errors ${errs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}

// ---------- B. shots: solve 0/90/180/300, reset 0/150/300/450/700, OFF mid-pop / mid-shrink / mid-grow / next board, frame strip ----------
{
  const { ctx, page } = await newPage({ lesson: false }); const h = H(page); await h.start();
  const got = [];
  // v0.3.8 final: ONE frozen shot per solve, each on a fresh round (Quit -> Start, the first solve of the round), so no
  // earlier freeze can shift the clock (the reset pins its animations to the page timeline) and every shot shows the
  // same moment of the same solve (streak 1, score 1, Blaze idle + hop)
  const fresh = async () => { if (await h.kk(() => window.__kk.phase !== 'menu')) { await h.waitPlay(); const b = await page.locator('#gQuit').boundingBox(); await h.tapXY(b.x + b.width / 2, b.y + b.height / 2); await page.waitForFunction(() => window.__kk.phase === 'menu', null, { timeout: 10000 }); await h.wait(300); }
    await h.start(); await h.kk(p => { window.__kkNext = [p]; }, P2); await h.tapTile(await h.ansI()); };
  const one = async (ref, ms, name) => { await fresh(); const a = await h.shotAt(ref, ms, name.startsWith('/') ? name : `${SHOTS}/${TAG}${name}`); await h.waitPlay(); return a; };
  for (const ms of [0, 90, 180, 300]) got.push([`v038-solve-${String(ms).padStart(4, '0')}.png`, await one(REF_TAP, ms, `v038-solve-${String(ms).padStart(4, '0')}.png`)]);
  for (const ms of [0, 150, 300, 450, 700]) got.push([`v038-reset-${String(ms).padStart(4, '0')}.png`, await one(REF_RESET, ms, `v038-reset-${String(ms).padStart(4, '0')}.png`)]);
  got.push(['v038-off-midpop.png', await one(REF_TAP, 80, 'v038-off-midpop.png')]);
  got.push(['v038-off-midshrink.png', await one(REF_RESET, 150, 'v038-off-midshrink.png')]);
  got.push(['v038-off-midgrow.png', await one(REF_RESET, 520, 'v038-off-midgrow.png')]);
  await fresh();
  await h.waitPlay(); await h.wait(200); await page.screenshot({ path: `${SHOTS}/${TAG}v038-off-next-board.png` }); got.push(['v038-off-next-board.png', 'ready']);
  if (LIVE) await page.screenshot({ path: `${SHOTS}/live-v038-next-board.png` });
  // frame strip: the OFF transition, tap -> next board ready (one fresh solve per frame, as above)
  await h.waitPlay();
  const frames = [];
  for (const ms of [40, 160, 600]) { const f = `/tmp/v038-strip-tap-${ms}.png`; await one(REF_TAP, ms, f); frames.push([f, `tap +${ms}`]); }
  for (const ms of [0, 70, 140, 210, 280, 310, 360, 420, 480, 560, 640, 700]) { const f = `/tmp/v038-strip-r-${ms}.png`; const a = await one(REF_RESET, ms, f); frames.push([f, `reset +${a}`]); }
  await h.wait(150); await page.screenshot({ path: '/tmp/v038-strip-ready.png' }); frames.push(['/tmp/v038-strip-ready.png', 'ready']);
  const bb = await page.locator('#board').boundingBox();
  writeFileSync('/tmp/v038-strip.json', JSON.stringify({ frames, box: [bb.x, bb.y, bb.width, bb.height], dpr: 2, out: `${SHOTS}/${TAG}v038-strip-off.png` }));
  execFileSync('python3', ['-c', `
import json
from PIL import Image, ImageDraw, ImageFont
c = json.load(open('/tmp/v038-strip.json')); x, y, w, h = [v * c['dpr'] for v in c['box']]
pad = 40; tiles = []
for f, lab in c['frames']:
    im = Image.open(f).convert('RGB').crop((int(x), int(y - pad), int(x + w), int(y + h + pad))).resize((int(w / 2), int((h + 2 * pad) / 2)))
    tiles.append((im, lab))
cols = 5; tw, th = tiles[0][0].size; rows = (len(tiles) + cols - 1) // cols
out = Image.new('RGB', (cols * tw, rows * (th + 26)), (255, 255, 255)); d = ImageDraw.Draw(out)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
except Exception: font = None
for k, (im, lab) in enumerate(tiles):
    cx, cy = (k % cols) * tw, (k // cols) * (th + 26); out.paste(im, (cx, cy + 26)); d.text((cx + 8, cy + 4), lab + ' ms' if lab != 'ready' else 'next board ready', fill=(40, 50, 80), font=font)
out.save(c['out'])
`]);
  got.push(['v038-strip-off.png', frames.length + ' frames']);
  check(got.every(g => g[1] != null), `shots (${TAG || 'local'}): ${got.map(g => `${TAG}${g[0]}@${g[1]}`).join(', ')}`);
  await ctx.close();
}

// ---------- C. Show counting ON: lesson unchanged vs v0.3.7, no confetti, cheer at the caption ----------
async function onRun(base, k3) {
  const { ctx, page, errs } = await newPage({ lesson: true, base }); const h = H(page); await h.start();
  const out = [];
  for (let k = 1; k <= (k3 ? 3 : 1); k++) {
    await h.kk(p => { window.__kkNext = [p]; }, nextP(k));
    const i = await h.ansI();
    await h.kk(() => { window.__l0 = window.__sfxLog.length; window.__c0 = window.__kkConfetti.length; window.__tp0 = window.__taps.length; window.__stg = []; window.__b0 = window.__kkBlaze.length;
      const f = () => { const g = window.__kk.teachStage, tp = window.__taps[window.__tp0]; if (tp && g && window.__stg.at(-1)?.[0] !== g) window.__stg.push([g, Math.round(performance.now() - tp)]); if (!(tp && window.__kk.phase === 'play' && !window.__kk.teach && !window.__kk.resetStage)) window.__raf(f); else window.__rdy = Math.round(performance.now() - tp); };
      window.__rdy = 0; window.__raf(f); });
    await h.tapTile(i);
    await h.waitPlay(); await page.waitForFunction(() => window.__rdy > 0);
    out.push(await h.kk(() => { const tp = window.__taps[window.__tp0], L = window.__sfxLog.slice(window.__l0);
      return { stg: window.__stg, rdy: window.__rdy, conf: window.__kkConfetti.length - window.__c0, sfx: L.map(e => [e[0], Math.round(e[2] - tp), e[3] ?? null]), poses: window.__kkBlaze.slice(window.__b0).map(e => e[0] ?? e),
        reset: (window.__kkReset?.log ?? []).filter(e => e[1] > tp).map(e => [e[0], Math.round(e[1] - tp)]) }; }));
    await h.wait(300);
  }
  await page.screenshot({ path: '/tmp/v038-on-after.png' });
  await ctx.close(); return { out, errs };
}
{
  // a mid-lesson shot (the bond with its caption) for the ON lesson
  const { ctx, page } = await newPage({ lesson: true }); const h = H(page); await h.start();
  await h.kk(p => { window.__kkNext = [p]; }, P2); await h.tapTile(await h.ansI());
  await page.waitForFunction(() => window.__kk.teachStage === 'cheer', null, { polling: 'raf', timeout: 20000 }); await h.wait(250);
  await page.screenshot({ path: `${SHOTS}/${TAG}v038-on-lesson.png` });
  await h.waitPlay(); await ctx.close();
}
const NEW = await onRun(BASE, true);
const LESSON = ['connect', 'count', 'rise', 'cheer', 'clear'];
for (const [k, r] of NEW.out.entries()) {
  const stg = r.stg.map(s => s[0]), cheer = r.stg.find(s => s[0] === 'cheer')?.[1], cheerSfx = r.sfx.find(s => s[0] === 'cheer')?.[1];
  check(r.conf === 0, `ON solve ${k + 1}: no confetti during the lesson (${r.conf} calls)`);
  check(cheer != null && cheerSfx != null && Math.abs(cheerSfx - cheer) < 20 && r.sfx.some(s => s[0] === 'caption'), `ON solve ${k + 1}: cheer() still plays as the caption lands (cheer stage ${cheer} ms, cheer() ${cheerSfx} ms); stages ${stg.join('>')}`);
  const col = r.reset.find(e => e[0] === 'collapse')?.[1], lastStage = r.stg.at(-1)?.[1];
  check(col != null && r.rdy - col >= 670 && r.rdy - col < 800, `ON solve ${k + 1}: the board reset starts after the lesson (${col} ms) and the board is ready ${r.rdy - col} ms later`);
}
{ const r3 = NEW.out[2]; if (r3) { const cheer = r3.stg.find(s => s[0] === 'cheer')?.[1], streak = r3.sfx.filter(s => s[0] === 'streak').map(s => s[1]), bl = r3.sfx.filter(s => s[0] === 'blaze').map(s => [s[2], s[1]]);
  check(!streak.length && bl.some(b => b[0] === 'cheer' && Math.abs(b[1] - cheer) < 20) && !r3.sfx.some(s => s[0] === 'hop'), `ON streak 3: Blaze's cheer still on the bond's cheer frame (${bl.map(b => b.join('@')).join(',')} vs cheer ${cheer} ms), no hop sound`); } }
if (HAVE_OLD) {
  const OLDR = await onRun(OLDURL, true);
  for (const [k, n] of NEW.out.entries()) {
    const o = OLDR.out[k]; if (!o) continue;
    const ns = n.stg.map(s => s[0]).join('>'), os = o.stg.map(s => s[0]).join('>');
    const dt = Math.max(...n.stg.map((s, j) => Math.abs(s[1] - (o.stg[j]?.[1] ?? 1e9))));
    const skip = new Set(['hop', 'collapse', 'emerge', 'tap', 'uiTap', 'roundStart']);
    const nf = n.sfx.filter(s => !skip.has(s[0]) && s[1] < (n.reset[0]?.[1] ?? 1e9)), of = o.sfx.filter(s => !skip.has(s[0]) && s[1] < o.rdy);
    const sameNames = nf.map(s => s[0]).join(',') === of.map(s => s[0]).join(','), sdt = sameNames ? Math.max(0, ...nf.map((s, j) => Math.abs(s[1] - of[j][1]))) : 1e9;
    const endDiff = (n.reset[0]?.[1] ?? 1e9) - o.rdy;
    check(ns === os && dt < 60 && sameNames && sdt < 60 && Math.abs(endDiff) < 70, `ON solve ${k + 1} vs v0.3.7: same lesson (${ns}; stage times within ${dt} ms; ${nf.length} sounds same order within ${sdt} ms; lesson ends ${endDiff >= 0 ? '+' : ''}${endDiff} ms vs v0.3.7's next board)${sameNames ? '' : ` NEW ${nf.map(s => s[0]).join(',')} OLD ${of.map(s => s[0]).join(',')}`}`);
    if (k === 0) check(o.conf > 0 && n.conf === 0, `ON solve 1: v0.3.7 had ${o.conf} confetti call(s) in the lesson, v0.3.8 has ${n.conf}`);
  }
} else log.push('skip  ON vs v0.3.7 comparison (no /tmp/base037/dist)');
check(!NEW.errs.length, `ON: no page errors ${NEW.errs.slice(0, 3).join(' | ')}`);

// ---------- D. reduced motion: a plain 200 ms crossfade, no pop/ring/hop, badge just appears ----------
{
  const { ctx, page, errs } = await newPage({ lesson: false, reduced: true }); const h = H(page); await h.start();
  await h.kk(p => { window.__kkNext = [p]; }, P2); const i = await h.ansI();
  await h.kk(() => { window.__r0 = window.__kkReset.log.length; window.__c0 = window.__kkConfetti.length; }); await h.tapTile(i); await h.kk(i => window.__sampleFrom(i, 1600), i);
  await h.waitPlay(); await h.wait(200);
  const r = await h.kk(() => { const tp = window.__taps.at(-1), R = window.__kkReset.log.slice(window.__r0).map(e => [e[0], Math.round(e[1] - tp)]); return { R, smp: window.__smp, conf: window.__kkConfetti.length - window.__c0 }; });
  const g = n => r.R.find(e => e[0] === n)?.[1], tot = g('ready') - g('collapse');
  const scales = r.smp.flatMap(s => s.slots.map(q => q[0])), ansS = r.smp.map(s => s.ans), op = r.smp.filter(s => s.rs).map(s => s.slots[0][3]);
  check(tot >= 195 && tot < 260 && !r.R.some(e => e[0] === 'beat') && scales.every(k => Math.abs(k - 1) < 1e-3) && ansS.every(k => k <= 1 + 1e-3) && Math.min(...op) < 0.2,
    `reduced motion: ${tot} ms crossfade (out ${g('emerge') - g('collapse')} / in ${g('ready') - g('emerge')}), opacity dips to ${Math.min(...op).toFixed(2)}, no scale animation (the answer only shows the 0.95 finger-press; slot scales ${[...new Set(scales.map(k => k.toFixed(3)))].join(',')}, answer ${[...new Set(ansS.map(k => (+k).toFixed(3)))].join(',')}, stages ${r.R.map(e => e[0]).join(',')})`);
  check(r.smp.some(s => s.tick === 1) && !r.smp.some(s => s.ring) && !r.smp.some(s => s.hop) && r.conf === 0, `reduced motion: tick badge just appears, no ring, no hop, no confetti`);
  const snd = await h.kk(() => { const tp = window.__taps.at(-1); return window.__sfxLog.filter(e => e[2] >= tp - 5 && ['collapse', 'emerge'].includes(e[0])).map(e => [e[0], e.opts?.gainDb ?? null]); });
  check(snd.length === 1 && snd[0][0] === 'emerge' && snd[0][1] === -3, `reduced motion: emerge({ gainDb: -3 }) only, no collapse() (${JSON.stringify(snd)})`);
  check(!errs.length, `reduced: no page errors ${errs.join(' | ')}`);
  await ctx.close();
}

// ---------- E. 4x CPU: no long tasks / jank during the solve + reset, timer starts only when the board is ready ----------
const perf = {};
for (const lesson of [false, true]) {
  const { ctx, page, errs } = await newPage({ lesson }); const h = H(page);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await h.start(); await h.wait(600);
  const runs = [];
  for (let k = 1; k <= (lesson ? 2 : 4); k++) {
    await h.kk(p => { window.__kkNext = [p]; }, nextP(k)); const i = await h.ansI();
    await h.kk(() => { window.__lt = []; window.__r0 = window.__kkReset.log.length; window.__frameRec(true); window.__run = [];
      let left = false; const f = () => { window.__run.push([performance.now(), window.__kk.running]); if (window.__kk.phase !== 'play') left = true; if (!left || window.__kk.phase !== 'play' || window.__kk.resetStage) window.__raf(f); else { let n = 0; const g = () => { window.__run.push([performance.now(), window.__kk.running]); if (++n < 10) window.__raf(g); }; window.__raf(g); } }; window.__raf(f); });
    await h.tapTile(i); await h.waitPlay(30000); await h.wait(250);
    runs.push(await h.kk(() => { window.__frameRec(false); const tp = window.__taps.at(-1), R = window.__kkReset.log.slice(window.__r0), c = R.find(e => e[0] === 'collapse')[1], rd = R.find(e => e[0] === 'ready')[1];
      const fr = window.__frames.filter(t => t >= c - 20 && t <= rd + 20), gaps = fr.slice(1).map((t, j) => t - fr[j]).sort((a, b) => a - b);
      const all = window.__frames.slice(1).map((t, j) => t - window.__frames[j]);
      const firstRun = window.__run.find(e => e[0] > tp + 5 && e[1])?.[0]; // the first frame after the tap with the clock running
      return { reset: Math.round(rd - c), frames: fr.length, p95: gaps[Math.floor(gaps.length * 0.95)] ?? 0, max: gaps.at(-1) ?? 0, over50: all.filter(g => g > 50).length, lt: window.__lt.filter(e => e[0] >= tp - 5).map(e => Math.round(e[1])),
        runEarly: window.__run.filter(e => e[0] < rd - 1 && e[0] > tp + 5).some(e => e[1]), firstRun: firstRun ? Math.round(firstRun - rd) : null, left: window.__kk.left }; }));
  }
  perf[lesson ? 'ON' : 'OFF'] = runs;
  const lt = runs.flatMap(r => r.lt), mx = Math.max(...runs.map(r => r.max)), p95 = Math.max(...runs.map(r => r.p95)), o50 = runs.reduce((a, r) => a + r.over50, 0);
  check(!lt.length && mx < 50 && o50 === 0, `4x CPU, ${lesson ? 'ON' : 'OFF'}: ${runs.length} solves, no long tasks (${lt.length ? lt.join(',') + ' ms' : 'none'}), reset frames ${runs.map(r => r.frames).join('/')} (p95 ${p95.toFixed(1)} ms, worst ${mx.toFixed(1)} ms), frames > 50 ms over solve+reset: ${o50}; reset ${runs.map(r => r.reset).join('/')} ms`);
  check(runs.every(r => !r.runEarly && r.firstRun != null && r.firstRun >= -1 && r.firstRun < 40), `4x CPU, ${lesson ? 'ON' : 'OFF'}: round timer starts only once the board is ready (first running frame ${runs.map(r => r.firstRun).join('/')} ms after ready)`);
  check(!errs.length, `4x CPU ${lesson ? 'ON' : 'OFF'}: no page errors ${errs.join(' | ')}`);
  await ctx.close();
}
writeFileSync(`/tmp/${TAG}v038-perf.json`, JSON.stringify(perf, null, 1));

// ---------- F. results: the new-#1 shower is still the one confetti moment ----------
{
  const { ctx, page, errs } = await newPage({ lesson: false, round: 6 }); const h = H(page);
  await h.kk(() => localStorage.setItem('kk.board.v2', JSON.stringify([{ name: 'AAA', lv: 'easy', n: 5, score: 1, streak: 1, avg: 3, miss: 0, at: 1 }])));
  await h.start();
  const c0 = await h.kk(() => window.__kkConfetti.length);
  for (let k = 1; k <= 2; k++) { await h.kk(p => { window.__kkNext = [p]; }, nextP(k)); await h.tapTile(await h.ansI()); await h.waitPlay(); }
  const cPlay = await h.kk(() => window.__kkConfetti.length);
  await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 20000 }); await h.wait(1500);
  const cEnd = await h.kk(() => window.__kkConfetti.slice());
  check(cPlay === c0 && cEnd.slice(c0).some(e => /^shower/.test(e[0])), `results: no confetti in play (incl. beating the #1 mid-round), the new-#1 shower on the results screen (${cEnd.slice(c0).map(e => e[0]).join(',')})`);
  check(!errs.length, `results: no page errors ${errs.join(' | ')}`);
  await ctx.close();
}

// ---------- F. sound pack v04: the served files are the AE's dist files byte for byte; sprites as AUDIO.md says ----------
{
  const { createHash } = await import('crypto');
  const PACK = '/workspace/kakooma-audio/v04/dist/', sums = [];
  for (const f of ['kk_sfx.ogg', 'kk_sfx.m4a', 'kk_sfx.json']) {
    const buf = Buffer.from(await (await fetch(BASE + 'audio/' + f, { cache: 'no-store' })).arrayBuffer());
    const got = createHash('sha256').update(buf).digest('hex'), want = existsSync(PACK + f) ? createHash('sha256').update(readFileSync(PACK + f)).digest('hex') : null;
    sums.push(`${f} ${buf.length} B ${got.slice(0, 12)}`);
    check(want ? got === want : buf.length > 0, `audio v04: served ${f} (${buf.length} B, sha256 ${got}) ${want ? (got === want ? 'matches' : 'DIFFERS from') + ' the pack' : '(pack folder absent)'}`);
    if (f === 'kk_sfx.ogg') check(buf.length < 120000, `audio v04: Opus sprite ${buf.length} B < 120 KB`);
    if (f === 'kk_sfx.json') { const j = JSON.parse(buf.toString()), keys = Object.keys(j.sprites ?? j.sprite ?? j);
      check(['collapse', 'emerge', 'hop_0', 'hop_1', 'hop_2'].every(k => keys.includes(k)) && !['makeTen', 'clear', 'hop'].some(k => keys.includes(k)), `audio v04: sprites collapse/emerge/hop_0-2 present, makeTen/clear/hop retired (${keys.length} sprites)`); }
  }
  console.log('audio files: ' + sums.join(', '));
}
await browser.close(); server.close(); oldServer.close();
console.log('\n' + JSON.stringify(perf));
console.log(fails.length ? `\n${fails.length} FAILED:\n${fails.join('\n')}` : '\nALL V038 CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
