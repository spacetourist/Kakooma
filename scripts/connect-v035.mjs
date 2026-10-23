// v0.3.5 connect beat + canvas confetti: node scripts/connect-v035.mjs [baseUrl]. Frozen-frame shots of the beat at
// 0.15/0.35/0.6/0.9 s (Easy + Hard), a 50 ms frame sequence per level for GD, timing/state checks, link() once with no
// partPop, timer paused, taps during the beat do nothing (v0.3.6), reduced motion, lazy confetti chunk, burst + shower shots, FPS @4x with taps
// during a shower. Shots shots/v035-connect-*.png, v035-confetti-*.png, sequences in shots/v035-seq/.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots/', import.meta.url).pathname, SEQ = SHOTS + 'v035-seq/';
mkdirSync(SEQ, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const TAG = process.env.SHOT_TAG || 'v035', NOSEQ = !!process.env.NOSEQ;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [];
const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
let page; const reqs = [];
// test-only freeze: timers + rAF callbacks queue while frozen, running animations pause, so a shot is exactly one moment
const FREEZE = () => {
  const _st = window.setTimeout.bind(window), _raf = window.requestAnimationFrame.bind(window);
  window.__raf = _raf; window.__frozen = false; window.__q = []; window.__paused = []; window.__sfxLog = [];
  window.setTimeout = (f, ms, ...a) => _st(() => { if (window.__frozen) window.__q.push(() => f(...a)); else f(...a); }, ms);
  window.requestAnimationFrame = f => _raf(t => { if (window.__frozen) window.__q.push(() => f(performance.now())); else f(t); });
  window.__freeze = () => { window.__frozen = true; window.__paused = document.getAnimations().filter(a => a.playState === 'running'); window.__paused.forEach(a => a.pause()); };
  window.__thaw = () => { window.__frozen = false; window.__paused.forEach(a => a.play()); const q = window.__q; window.__q = []; q.forEach(f => f()); };
  document.addEventListener('pointerdown', e => { window.__tapT = performance.now(); }, true);
};
async function open(q, reduced = false) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('request', r => reqs.push([r.url(), Date.now()]));
  await page.addInitScript(FREEZE);
  await page.goto(BASE + q); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(400);
}
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const waitPlay = (t = 12000) => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: t });
const queue = ps => kk(ps => { window.__kkNext = ps; }, ps);
const tapAnswer = async () => { const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); };
const clip = async () => { const b = await page.locator('#board').boundingBox(), s = await page.locator('#sum').boundingBox(); return { x: 0, y: b.y - 10, width: 390, height: s.y + s.height - b.y + 20 }; };
/** tap the answer, freeze at t ms after the tap, return the state (and shoot), thaw */
async function at(t, shotPath) {
  await kk(t => { window.__shotAt = null; const f = () => { if (window.__tapT && performance.now() - window.__tapT >= t) { window.__freeze(); window.__shotAt = Math.round(performance.now() - window.__tapT); } else window.__raf(f); }; window.__tapT = 0; window.__raf(f); }, t);
  await kk(() => { window.__kk.streak = 0; }); // clean shots: no milestone shower from the setup solves
  await tapAnswer();
  for (let k = 0; k < 400 && (await kk(() => window.__shotAt)) == null; k++) await new Promise(r => setTimeout(r, 15)); // (page polling would sit in the frozen queue)
  const s = await kk(() => {
    const p = window.__kk.solved.at(-1), nums = p.nums, tiles = [...document.querySelectorAll('.tile')], iC = nums.indexOf(p.c), iS = nums.indexOf(Math.min(p.a, p.b)), iL = nums.indexOf(Math.max(p.a, p.b));
    const cs = e => getComputedStyle(e), lines = [...document.querySelectorAll('#board svg.connect line')];
    return { at: window.__shotAt, ans: { bg: cs(tiles[iC]).backgroundColor, tf: cs(tiles[iC]).transform }, S: cs(tiles[iS]).backgroundColor, L: cs(tiles[iL]).backgroundColor,
      dim: tiles.filter((_, k) => k < nums.length && ![iC, iS, iL].includes(k)).map(e => +cs(e).opacity),
      // v0.3.6 layering: the line layer is in #board before the first slot (under every tile), the fx layer stays on top
      under: (() => { const sv = document.querySelector('#board svg.connect'), sl = document.querySelector('#board .slot'); return !!sv && sv.parentElement.id === 'board' && !!(sv.compareDocumentPosition(sl) & Node.DOCUMENT_POSITION_FOLLOWING); })(),
      hit: [iC, iS, iL].map(k => { const r = tiles[k].getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && tiles[k].contains(e); }),
      cunder: tiles.filter((_, k) => k < nums.length && ![iC, iS, iL].includes(k)).every(e => e.parentElement.classList.contains('cunder')),
      ends: (() => { const sv = document.querySelector('#board svg.connect'); if (!sv) return null; const br = document.getElementById('board').getBoundingClientRect(), ctr = k => { const r = tiles[k].parentElement.getBoundingClientRect(); return [r.left + r.width / 2 - br.left, r.top + r.height / 2 - br.top]; };
        const rA = tiles[iC].offsetWidth / 2; return { err: lines.map((l, j) => { const P = ctr(j ? iL : iS), A = ctr(iC); return Math.max(Math.abs(+l.getAttribute('x1') - P[0]), Math.abs(+l.getAttribute('y1') - P[1]), Math.abs(+l.getAttribute('x2') - A[0]), Math.abs(+l.getAttribute('y2') - A[1])); }), rA, rP: [iS, iL].map(k => tiles[k].offsetWidth / 2) }; })(),
      lines: lines.map(l => ({ c: cs(l).stroke, o: +cs(l).opacity, off: parseFloat(cs(l).strokeDashoffset), len: parseFloat(l.style.strokeDasharray), w: cs(l).strokeWidth, cap: cs(l).strokeLinecap })),
      sum: document.getElementById('sum').className, left: window.__kk.left, running: window.__kk.running,
      sfx: window.__sfxLog.filter(e => e[2] >= window.__tapT - 5).map(e => e[0]) };
  });
  if (shotPath) await page.screenshot({ path: shotPath, clip: await clip() });
  await kk(() => window.__thaw());
  await waitPlay();
  return s;
}
// fraction of the VISIBLE stretch drawn (v0.3.6: tip from 6 px inside the source edge to 6 px inside the answer's 1.08 edge)
const vis = (q, j) => { const l = q.lines[j], s0 = q.ends.rP[j] - 6, e0 = l.len - (q.ends.rA * 1.08 - 6); return (l.len - l.off - s0) / (e0 - s0); };
const scale = tf => { const m = /matrix\(([-\d.]+)/.exec(tf); return m ? +(+m[1]).toFixed(3) : 1; };
const PZ = { easy: [{ nums: [3, 7, 10, 2, 9], a: 3, b: 7, answer: 10 }], hard: [{ nums: [24, 26, 50, 9, 31], a: 24, b: 26, answer: 50 }] };
/** the queue applies to the NEXT board: play the current board through so the live one is the known puzzle */
async function known(lv) { await queue(PZ[lv]); await kk(() => { window.__kk.streak = 0; }); await tapAnswer(); await wait(1150); await waitPlay(); await wait(150); }
const LB = 'rgb(156, 192, 255)', DB = 'rgb(58, 123, 255)', GR = 'rgb(34, 197, 94)';
for (const lv of ['easy', 'hard']) {
  await open(`?round=600&level=${lv}&teach=quick`);
  await tapEl('#mStart'); await waitPlay(); await wait(300);
  const st = {};
  for (const t of [150, 350, 600, 900]) { await known(lv); st[t] = await at(t, `${SHOTS}${TAG}-connect-${lv}-${String(t).padStart(4, '0')}.png`); }
  const s1 = st[150], s2 = st[350], s3 = st[600], s4 = st[900];
  log.push(`     ${lv}: ` + JSON.stringify({ 600: s3 }));
  check(s1.ans.bg === GR && scale(s1.ans.tf) > 1.0 && scale(s1.ans.tf) <= 1.121 && /* v0.3.8: 1 -> 1.12 -> 1 pop over 180 ms */ s1.dim.every(o => Math.abs(o - 0.4) < 0.05), `${lv} 0.15 s: answer green at ${scale(s1.ans.tf)}, others at ${s1.dim} opacity`);
  check(s1.lines.length === 2 && s1.lines.every(l => l.o > 0 && l.off > 0.5 * l.len) && s1.S !== 'rgb(255, 255, 255)' && s1.L !== 'rgb(255, 255, 255)' && s2.S === LB && s2.L === DB, `${lv} 0.15-0.35 s: parts light up (#9cc0ff / #3a7bff), both lines just started ${JSON.stringify(s1.lines.map(l => [l.o, Math.round(l.off)]))}`);
  check(s2.lines.every(l => l.off > 0 && l.off < l.len) && Math.abs(vis(s2, 0) - vis(s2, 1)) < 0.04 && /* v0.3.8: tips stop rA-6 short of the centre */ /ph|hint/.test(s2.sum), `${lv} 0.35 s: both lines mid-draw at the same visible fraction (${vis(s2, 0).toFixed(3)} / ${vis(s2, 1).toFixed(3)}: arrive together), sum strip not yet filled`);
  check(s2.lines[0].c === LB && s2.lines[1].c === DB && s2.lines.every(l => l.w === '10px' && l.cap === 'round'), `${lv}: thick round-ended lines in the part colours`);
  check([s1, s2, s3].every(s => s.under && s.hit.every(Boolean) && s.cunder), `${lv}: lines on a layer UNDER all the tiles (answer + both parts on top at their centres; dimmed slots keep an opaque disc)`);
  check([s1, s2, s3].every(s => s.ends && s.ends.err.every(e => e < 1)), `${lv}: each line runs centre to centre (max end error ${Math.max(...s1.ends.err).toFixed(2)} px)`);
  check(s1.lines.every((l, j) => l.len - l.off <= s1.ends.rP[j] + 1), `${lv} 0.15 s: the drawn tip has only just left the source circle (${s1.lines.map((l, j) => (l.len - l.off - s1.ends.rP[j]).toFixed(1))} px past its edge)`);
  check(s3.lines.every(l => l.off > 0 && l.off <= s3.ends.rA * 1.12 && l.off >= s3.ends.rA - 10) && /pop/.test(s3.sum) && scale(s3.ans.tf) > 1.01 /* v0.3.8: pulse to 1.06 */, `${lv} 0.6 s: lines joined, soft pulse (${scale(s3.ans.tf)}), sum strip filled`);
  check(s4.lines.every(l => l.o < 1 && l.o > 0) && s4.dim.every(o => o > 0.4), `${lv} 0.9 s: lines + dimming fading out (${s4.lines.map(l => l.o.toFixed(2))}, ${s4.dim.map(o => o.toFixed(2))})`);
  check([s1, s2, s3, s4].every(s => !s.running), `${lv}: round timer paused through the beat`);
  const sx = s4.sfx; check(sx.filter(x => x === 'link').length === 1 && !sx.includes('partPop'), `${lv}: link() once, no partPop in the reveal (${sx.join(',')})`);
  const lk = await kk(() => { const e = window.__sfxLog.filter(e => e[0] === 'link').at(-1), c = window.__sfxLog.filter(e => e[0] === 'correct').at(-1); return Math.round(e[2] - c[2]); });
  check(Math.abs(lk - 100) <= 20, `${lv}: link() scheduled 0.1 s after the tap (${lk} ms after correct())`);
  // v0.3.6 shots: the lines under the tiles at 0.3 / 0.5 / 0.7 s into the beat
  if (lv === 'easy') for (const t of [300, 500, 700]) { await known(lv); const q = await at(t, `${SHOTS}v036-lines-under-${String(t).padStart(4, '0')}.png`);
    check(q.under && q.hit.every(Boolean), `shot v036-lines-under-${t}: lines under the tiles (at ${q.at} ms; tips ${q.lines.map(l => Math.round(l.len - l.off)).join('/')} of ${q.lines.map(l => Math.round(l.len)).join('/')} px)`); }
  // handover at 1.0 s
  await known(lv); await tapAnswer(); const t0 = Date.now(); await page.waitForFunction(() => window.__kk.phase === 'play' && !document.querySelector('#board svg.connect'), null, { timeout: 3000 }); const ho = Date.now() - t0;
  check(ho > 1550 && ho < 2000, `${lv}: next puzzle ${ho} ms after the tap (v0.3.8: 1.0 s beat + ~0.7 s board reset)`);
  // frame sequence for GD
  if (!NOSEQ) { for (let t = 0; t <= 1000; t += 50) { await known(lv); await at(t, `${SEQ}${lv}-${String(t).padStart(4, '0')}.png`); await wait(150); } }
}
// ---------- full lesson handover, no skip, reduced ----------
await open('?round=600&level=medium&teach=full');
await queue([{ nums: [7, 9, 12, 19, 4], a: 7, b: 12, answer: 19 }]); await tapEl('#mStart'); await waitPlay(); await wait(300);
await tapAnswer(); const tf = Date.now();
await page.waitForFunction(() => window.__kk.teachStage === 'fly', null, { timeout: 3000 }); const tfly = Date.now() - tf;
check(tfly > 850 && tfly < 1300, `full lesson: counting starts after the beat (${tfly} ms)`);
await page.waitForFunction(() => window.__kk.teachStage === 'cheer', null, { timeout: 15000, polling: 10 });
for (let k = 0; k < 8; k++) { await page.screenshot({ path: `${SEQ}burst-${k}.png` }); if (k === 2) await page.screenshot({ path: `${SHOTS}${TAG}-confetti-burst.png` }); await wait(100); }
await waitPlay(); await wait(300);
// v0.3.6: taps during the beat (on the board, on a dimmed tile, on the answer again) do nothing: it plays in full and
// the lesson follows as usual
await queue([{ nums: [7, 9, 12, 19, 4], a: 7, b: 12, answer: 19 }]); await tapAnswer(); const tb = Date.now(); await wait(300);
const sc0 = await kk(() => window.__kk.score);
await page.touchscreen.tap(200, 700); await tapEl('.tile[data-i="4"]'); await tapAnswer(); await wait(100);
const mid = await kk(() => ({ svg: !!document.querySelector('#board svg.connect'), stage: window.__kk.teachStage, score: window.__kk.score, miss: window.__kk.miss }));
await page.waitForFunction(() => window.__kk.teachStage === 'fly', null, { timeout: 3000 }); const tfly2 = Date.now() - tb;
check(mid.svg && mid.stage === 'connect' && mid.score === sc0 && mid.miss === 0 && tfly2 > 850, `taps during the beat do nothing: beat still running after 3 taps (${mid.stage}), score ${mid.score}, no miss, lesson counting at ${tfly2} ms`);
await waitPlay(20000);
// shower (streak 3) + taps while it falls, @4x CPU
await open('?round=600&level=medium&teach=quick');
const loadAt = await kk(() => performance.getEntriesByType('navigation')[0].loadEventEnd), chunk = await kk(() => performance.getEntriesByType('resource').filter(e => /confetti/.test(e.name)).map(e => Math.round(e.startTime)));
check(chunk.length === 1 && chunk[0] >= loadAt, `confetti chunk is lazy: fetched at ${chunk} ms, after load (${Math.round(loadAt)} ms)`);
await tapEl('#mStart'); await waitPlay(); await wait(300);
for (let i = 0; i < 2; i++) { await tapAnswer(); await wait(1150); await waitPlay(); }
const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await kk(() => { window.__fr = []; let l = 0; const t1 = performance.now(); const f = t => { if (l) window.__fr.push(t - l); l = t; if (t - t1 < 3000) window.__raf(f); }; window.__raf(f); });
await tapAnswer(); await wait(1000);
await page.screenshot({ path: `${SHOTS}${TAG}-confetti-shower.png` });
await waitPlay();
const lat = [];
for (let k = 0; k < 3; k++) { lat.push(await kk(() => { const p = window.__kk.puzzle, i = p.nums.findIndex(v => v !== p.answer), t = document.querySelector(`.tile[data-i="${i}"]`), r = t.getBoundingClientRect(); const t0 = performance.now(); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3 + i, isPrimary: true, pointerType: 'touch', clientX: r.x + 20, clientY: r.y + 20 })); return +(performance.now() - t0).toFixed(2); })); await wait(250); }
await wait(1200);
const fr = await kk(() => window.__fr); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
const avg = fr.reduce((x, y) => x + y, 0) / fr.length;
check(1000 / avg >= 55, `FPS @4x through the connect beat + star shower with 3 wrong taps while it falls: ${(1000 / avg).toFixed(1)} avg, max ${Math.max(...fr).toFixed(1)} ms, ${fr.filter(x => x > 20).length} > 20 ms of ${fr.length}; tap handlers ${lat.join('/')} ms`);
await tapAnswer(); await wait(80);
for (let k = 0; k < 6; k++) { await page.screenshot({ path: `${SEQ}shower-${k}.png` }); await wait(150); }
// reduced motion: lines instantly at 0.1 s, no scale, no confetti canvas pieces
await open('?round=600&level=easy&teach=quick', true);
await tapEl('#mStart'); await waitPlay(); await wait(300);
await known('easy');
const r = await at(150, `${SHOTS}${TAG}-connect-reduced-0150.png`);
check(r.lines.every(l => l.o === 1 && l.off === 0) && scale(r.ans.tf) === 1, `reduced motion: lines appear whole at 0.1 s, no scale ${JSON.stringify(r.lines)}`);
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V035 CONNECT CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
