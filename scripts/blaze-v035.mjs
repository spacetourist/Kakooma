// v0.3.5 Blaze reactions: node scripts/blaze-v035.mjs [baseUrl]. Lazy pose preload, triggers (comeback thumbs, 3/5/10 cheer +
// sparks, oops every other wrong pick, clap at 10, think after 8 s idle, whoa off), the 1-in-3 budget, ~0.9 s revert,
// sfx.blaze(pose) on the swap frame, reduced motion, ?blaze=<pose>, input path untouched, FPS @4x. Shots shots/v035-*.png.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const TAG = process.env.SHOT_TAG || 'v035';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [];
const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
let page; const reqs = [];
async function open(q, reduced = false, speedy = 0) { // speedy: whoa threshold for this page (0 = off, so the scripted fast taps don't trigger it; null = the game's 2 s)
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('request', r => reqs.push(r.url())); await page.addInitScript(sp => { window.__sfxLog = []; if (sp != null) window.__kkSpeedyMs = sp; }, speedy);
  await page.goto(BASE + q); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(400);
}
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const shot = n => page.screenshot({ path: `${SHOTS}${TAG}-${n}.png` });
const crop = async n => { const b = await page.locator('header.top').boundingBox(); await page.screenshot({ path: `${SHOTS}${TAG}-${n}.png`, clip: { x: b.x + b.width - 170, y: b.y, width: 170, height: Math.min(200, b.height + 40) } }); };
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const waitPlay = (t = 9000) => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: t });
const right = async () => { await waitPlay(); const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); };
const wrong = async () => { await waitPlay(); const i = await kk(() => { const p = window.__kk.puzzle; return p.nums.findIndex((v, j) => v !== p.answer && !window.__kk.badTiles.has(j)); }); await tapEl(`.tile[data-i="${i}"]`); };
const B = () => kk(() => ({ log: window.__kkBlaze.map(x => x[0]), ...window.__kkBlazeState(), sparks: document.querySelectorAll('#blaze .spark').length, streak: window.__kk.streak, src: document.querySelector('#blazeBody img.pose')?.getAttribute('src'), hidden: document.querySelector('#blazeBody img.pose')?.hidden, baseVis: document.querySelector('#blazeBody img').style.visibility }));
const last = async () => (await B()).log.at(-1);
// milestone cheers now swap in on the star shower's first burst (with streak(n)), ~0.5 s after the tap on a held board
const waitCheer = () => page.waitForFunction(() => window.__kkBlaze.at(-1)?.[0] === 'cheer' && document.querySelectorAll('#blaze .spark').length > 0, null, { timeout: 3000, polling: 10 }).then(() => wait(60));

// ---------- A: lazy preload ----------
await open('?round=90&level=medium&teach=quick');
await page.waitForFunction(() => performance.getEntriesByType('resource').filter(e => /\/blaze\/\w+\.webp/.test(e.name)).length >= 6, null, { timeout: 8000 });
const pre = await kk(() => { const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0, nav = performance.getEntriesByType('navigation')[0];
  return { fcp, load: nav.loadEventEnd, poses: performance.getEntriesByType('resource').filter(e => /\/blaze\//.test(e.name)).map(e => ({ n: e.name.split('/').pop(), start: Math.round(e.startTime), kb: +(e.transferSize / 1024 || e.decodedBodySize / 1024).toFixed(1) })) }; });
check(pre.poses.length === 6 && pre.poses.every(p => p.start >= pre.fcp && p.start >= pre.load), `poses preload after first paint + load: fcp ${Math.round(pre.fcp)} load ${Math.round(pre.load)} ${JSON.stringify(pre.poses)}`);
check(reqs.some(u => /whoa\.webp/.test(u)), 'whoa (v2) preloaded with the others');

// ---------- B: wrong (oops), budget, comeback (thumbs), milestones ----------
await tapEl('#mStart'); await waitPlay(); await wait(300);
await wrong(); await wait(220); let b = await B();
check(b.log[0] === 'oops' && b.current === 'oops' && !b.hidden && b.baseVis === 'hidden' && /oops\.webp/.test(b.src), `wrong #1: oops swaps in ${JSON.stringify(b)}`);
await shot('oops'); await crop('oops-crop');
await wait(800); b = await B();
check(b.current === null && b.hidden && b.baseVis === '', 'oops reverts to the normal Blaze after ~0.9 s');
await right(); await wait(260); b = await B();
check(b.log.at(-1) === 'thumbs' && b.current === 'thumbs', `comeback: first correct pick after a miss -> thumbs ${b.log}`);
await shot('thumbs'); await crop('thumbs-crop');
await wait(900);
await wrong(); await wait(150); const n0 = (await B()).log.length;
await wrong(); await wait(150); b = await B();
check(b.log.length === n0 && b.log.at(-1) === 'thumbs', `wrong #2 (off turn) tilts; wrong #3 (on turn) inside the 1-in-3 budget also just tilts ${JSON.stringify(b)}`);
await right(); await wait(200); check(await last() === 'thumbs', 'comeback always plays (exempt from the budget)');
await wait(800); await right(); await wait(150); check((await B()).log.length === n0 + 1, 'streak 2: normal (no special)');
await right(); await waitCheer(); b = await B();
check(b.log.at(-1) === 'cheer' && b.streak === 3 && b.sparks === 4, `streak 3: cheer + 4 sparks ${JSON.stringify(b)}`);
await wait(100); await shot('cheer-3-sparks'); await crop('cheer-3-crop');
await wait(900); await wrong(); await wait(150); await wrong(); await wait(150); b = await B();
check(b.log.at(-1) === 'oops', `budget open again (4 solves since the last special): next on-turn wrong pick -> oops ${b.log}`);
for (let s = 1; s <= 10; s++) {
  await wait(900); await right(); if (s === 5 || s === 10) await waitCheer(); else await wait(120); b = await B();
  if (s === 1) check(b.log.at(-1) === 'thumbs', 'comeback after the oops');
  if (s === 5) check(b.log.at(-1) === 'cheer' && b.sparks === 5, `streak 5: cheer + 5 sparks (${b.sparks})`);
  if (s === 10) { check(b.log.at(-1) === 'cheer' && b.sparks === 7, `streak 10: cheer + 7 sparks (${b.sparks})`); await wait(100); await shot('cheer-10-sparks'); await crop('cheer-10-crop'); }
}
const cheers = (await B()).log.slice(5).filter(x => x === 'cheer').length;
check(cheers === 3, `after the oops: cheer at 3, 5, 10 only (${cheers})`);
// ---------- think ----------
await wait(1000); await waitPlay(); const t0 = Date.now();
await page.waitForFunction(() => window.__kkBlazeState().current === 'think', null, { timeout: 11000 });
const idle = Date.now() - t0;
check(idle > 6500 && idle < 9800, `think after ~8 s with no tap (${idle} ms after the board went live)`);
await wait(600); await shot('think'); await crop('think-crop');
await wait(1200); check((await B()).current === 'think', 'think holds while idle');
await wrong(); await wait(80); b = await B();
check(b.current !== 'think', `next tap cancels think (${b.current})`);
// sfx.blaze on the swap frame
const sx = await kk(() => ({ s: window.__sfxLog.filter(e => e[0] === 'blaze').map(e => [e[3], Math.round(e[2])]), b: window.__kkBlaze }));
check(sx.s.length === sx.b.length && sx.s.every((e, i) => e[0] === sx.b[i][0] && Math.abs(e[1] - sx.b[i][1]) <= 1), `sfx.blaze(pose) fired once per swap, same frame (${sx.s.length} calls: ${sx.s.map(e => e[0]).join(',')})`);
check(!sx.s.some(e => e[0] === 'whoa'), 'no whoa while the speedy threshold is off for this page');
await tapEl('#gQuit'); await wait(200);

// ---------- input path + FPS @4x during a milestone ----------
await open('?round=60&level=medium&teach=quick');
await page.waitForFunction(() => window.__kkReact && performance.getEntriesByType('resource').filter(e => /blaze\/\w+\.webp/.test(e.name)).length >= 6);
await wait(300);
await tapEl('#mStart'); await waitPlay(); await wait(300); await right(); await wait(900); await right(); await wait(900); await waitPlay(); await wait(300);
const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await kk(() => { window.__fr = []; let l = 0; const t1 = performance.now(); const f = t => { if (l) window.__fr.push(t - l); l = t; if (t - t1 < 1300) requestAnimationFrame(f); }; requestAnimationFrame(f); });
const lat = await kk(() => { const p = window.__kk.puzzle, i = p.nums.indexOf(p.answer), t = document.querySelector(`.tile[data-i="${i}"]`), r = t.getBoundingClientRect(), n = window.__kkBlaze.length;
  const t0 = performance.now(); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3, isPrimary: true, pointerType: 'touch', clientX: r.x + 20, clientY: r.y + 20 })); return { ms: performance.now() - t0, sync: window.__kkBlaze.length - n, streak: window.__kk.streak }; });
await wait(1500);
const fr = await kk(() => window.__fr); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
const avg = fr.reduce((x, y) => x + y, 0) / fr.length, mx = Math.max(...fr);
check(lat.sync === 0 && lat.streak === 3 && (await last()) === 'cheer', `reaction is never on the input path (tap handler ${lat.ms.toFixed(2)} ms @4x, 0 swaps inside it; cheer next frame)`);
check(1000 / avg >= 55, `FPS @4x CPU through a cheer + sparks: ${(1000 / avg).toFixed(1)} avg, max frame ${mx.toFixed(1)} ms, ${fr.filter(x => x > 20).length} > 20 ms of ${fr.length}`);

// ---------- clap at the green flash at 10 (full lesson) ----------
await open('?round=60&level=medium&teach=full');
await page.waitForFunction(() => window.__kkReact && performance.getEntriesByType('resource').filter(e => /blaze\/\w+\.webp/.test(e.name)).length >= 6);
await kk(() => { window.__kkNext = [{ nums: [7, 9, 12, 19, 4], a: 7, b: 12, answer: 19 }]; });
await tapEl('#mStart'); await waitPlay(); await wait(300);
await kk(() => { window.__clapAt = null; const f = () => { const c = window.__kkBlaze.find(x => x[0] === 'clap'); if (c) window.__clapAt = { count: window.__kkCount.length, last: window.__kkCount.at(-1)[0] }; else requestAnimationFrame(f); }; requestAnimationFrame(f); });
await right();
await page.waitForFunction(() => window.__kkBlaze.some(x => x[0] === 'clap'), null, { timeout: 8000 }); await wait(250);
await shot('clap'); await crop('clap-crop');
const cl = await kk(() => window.__clapAt);
check(cl && cl.last === 10, `clap swaps in on the frame the count reaches 10 (count shown when clap first seen: ${JSON.stringify(cl)})`);
await wait(4000);

// ---------- reduced motion: swap only ----------
await open('?round=60&level=medium&teach=quick', true);
await page.waitForFunction(() => window.__kkReact && performance.getEntriesByType('resource').filter(e => /blaze\/\w+\.webp/.test(e.name)).length >= 6);
await tapEl('#mStart'); await waitPlay(); await wait(300);
const rm = await kk(() => new Promise(res => { window.__kkReact('cheer', { sparks: 7 }); requestAnimationFrame(() => res({ waapi: document.getElementById('blazeBody').getAnimations().filter(a => !(a instanceof CSSAnimation)).length, sparks: document.querySelectorAll('#blaze .spark').length, cur: window.__kkBlazeState().current })); }));
check(rm.cur === 'cheer' && rm.waapi === 0 && rm.sparks === 0, `reduced motion: pose swaps, no squash/stretch, no sparks ${JSON.stringify(rm)}`);
await shot('reduced-cheer'); await wait(1000); check((await B()).current === null, 'reduced: reverts after ~0.9 s');

// ---------- ?blaze=<pose> ----------
for (const p of ['cheer', 'thumbs', 'oops', 'clap', 'think', 'whoa']) {
  await open(`?round=60&level=medium&teach=quick&blaze=${p}`);
  await tapEl('#mStart'); await waitPlay(); await wait(1600);
  const c = (await B()).current;
  check(c === p, `?blaze=${p}: held through play (${c})`);
  await crop(`force-${p}`); await shot(`force-${p}`);
  await tapEl('#gQuit'); await wait(100);
}
// ---------- whoa (v2): speedy solve under 2 s, once a round, within the budget ----------
await open('?round=60&level=medium&teach=quick', false, null);
await page.waitForFunction(() => window.__kkReact && performance.getEntriesByType('resource').filter(e => /blaze\/\w+\.webp/.test(e.name)).length >= 6);
await tapEl('#mStart'); await waitPlay(); await wait(500);
await right(); await wait(200); let w = await B();
check(w.log[0] === 'whoa' && w.current === 'whoa', `speedy first solve (${await kk(() => Math.round(window.__kk.solve[0]))} ms) -> whoa ${w.log}`);
await wait(120); await shot('whoa'); await crop('whoa-crop');
for (let k = 0; k < 4; k++) { await wait(1100); await right(); }
await wait(300); w = await B();
check(w.log.filter(x => x === 'whoa').length === 1, `whoa at most once a round (${w.log})`);
await tapEl('#gQuit'); await wait(200);
await open('?round=60&level=medium&teach=quick', false, null);
await page.waitForFunction(() => window.__kkReact && performance.getEntriesByType('resource').filter(e => /blaze\/\w+\.webp/.test(e.name)).length >= 6);
await tapEl('#mStart'); await waitPlay(); await wait(2300); await right(); await wait(200);
check(!(await B()).log.includes('whoa'), 'a solve slower than 2 s: no whoa');
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V035 BLAZE CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
