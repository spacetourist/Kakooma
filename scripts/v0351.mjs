// v0.3.5.1: GD confetti spec + three fixes. node scripts/v0351.mjs [baseUrl] [beforeUrl]. Checks the burst/shower
// parameters (log), cap + 300 ms skip, shower inside the lesson / holding the board without one, the filled sum held
// to the handover, the left badge's ink outline, FPS @4x with taps during a shower. Shots shots/v0351-*.png; with
// beforeUrl (the live v0.3.5) also the "before" shots for each fix.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`, BEFORE = process.argv[3];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [];
const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
let page;
async function open(base, q) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(() => { window.__sfxLog = []; document.addEventListener('pointerdown', () => { window.__tapT = performance.now(); }, true); });
  await page.goto(base + q); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(500);
}
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const waitPlay = (t = 15000) => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: t });
const tapAnswer = async () => { const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); };
const untilMs = async (ref, ms) => { const now = await kk(r => performance.now() - window[r], ref); if (ms > now) await wait(ms - now); return Math.round(await kk(r => performance.now() - window[r], ref)); };
const CL = () => kk(() => window.__kkConfetti.slice());

// ---------- normal burst at the bond (lesson): frames 0.1 / 0.4 / 1.0 s ----------
await open(BASE, '?round=600&level=medium&teach=full');
await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /confetti/.test(e.name)));
await kk(() => { window.__kkNext = [{ nums: [7, 9, 12, 19, 4], a: 7, b: 12, answer: 19 }]; });
await tapEl('#mStart'); await waitPlay(); await wait(300); await tapAnswer();
// v0.3.8: no per-solve confetti; the lesson's cheer frame (where the bond burst used to fire) stays clean
await page.waitForFunction(() => window.__kk.teachStage === 'cheer', null, { timeout: 15000, polling: 5 });
await wait(400); await page.screenshot({ path: `${SHOTS}v0351-confetti-0400.png` });
let c = await CL();
check(c.length === 0, `normal solve (lesson): no confetti at the bond (v0.3.8) ${JSON.stringify(c)}`);
await waitPlay();
// 300 ms rule + 150 cap
await wait(2600);
c = await kk(async () => { window.__kkConfetti.length = 0; window.__kkFx.burst(); await new Promise(r => setTimeout(r, 120)); window.__kkFx.burst(); await new Promise(r => setTimeout(r, 300)); window.__kkFx.burst(); await new Promise(r => setTimeout(r, 50)); return window.__kkConfetti.slice(); });
check(c[0][0] === 'burst' && c[2][0] === 'burst:skipped' && c.filter(e => e[0] === 'burst').length === 4 && c.slice(3).reduce((n, e) => n + e[2], 0) === 70, `a burst < 300 ms after the last is skipped; the cap trims the next to fit 150 alive (80 + 70): ${JSON.stringify(c.map(e => e[0] + ':' + e[2]))}`);
await wait(3000);
// ---------- big moment WITH a lesson (first 3 solves are full; streak 3) -> shower inside the lesson ----------
await open(BASE, '?round=600&level=easy&teach=full');
await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /confetti/.test(e.name)));
await tapEl('#mStart'); await waitPlay(); await wait(300);
for (let k = 0; k < 2; k++) { await tapAnswer(); await wait(1200); await tapEl('#play'); await waitPlay(); await wait(200); }
await kk(() => { window.__kkConfetti.length = 0; window.__l0 = window.__sfxLog?.length ?? 0; });
await tapAnswer(); await page.waitForFunction(() => window.__kk.teachStage === 'cheer', null, { timeout: 15000, polling: 5 });
const st3 = await kk(() => ({ stage: window.__kk.teachStage, streak: window.__kk.streak, phase: window.__kk.phase, pose: document.getElementById('blazeBody').dataset.pose }));
await wait(700); await page.screenshot({ path: `${SHOTS}v0351-shower.png` });
await wait(600); c = await CL();
check(st3.stage === 'cheer' && st3.streak === 3 && st3.pose === 'cheer' && c.length === 0, `streak 3 with a lesson: Blaze cheers at the bond, no shower (v0.3.8): ${JSON.stringify(st3)} ${JSON.stringify(c)}`);
await waitPlay();
// ---------- big moment with NO lesson (quick): the solved board holds until the shower has passed its peak ----------
async function quickShower(base, shot) {
  await open(base, '?round=600&level=easy&teach=quick');
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /confetti/.test(e.name)));
  await tapEl('#mStart'); await waitPlay(); await wait(300);
  for (let k = 0; k < 2; k++) { await tapAnswer(); await wait(1100); await waitPlay(); await wait(150); }
  await kk(() => { (window.__kkConfetti || []).length = 0; window.__nb = null; const p0 = window.__kk.puzzle; const f = () => { if (window.__kk.puzzle !== p0 && window.__kk.phase === 'play') window.__nb = performance.now() - window.__tapT; else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await tapAnswer(); const t = await untilMs('__tapT', 1600); await page.screenshot({ path: shot });
  await waitPlay(); await wait(100);
  return { t, nb: await kk(() => Math.round(window.__nb)), c: await kk(() => (window.__kkConfetti || []).slice()) };
}
const qa = await quickShower(BASE, `${SHOTS}v0351-fix2-after-quick-shower-1600.png`);
const lastShower = qa.c.filter(e => e[0] === 'shower').at(-1)?.[1] - (await kk(() => 0));
check(qa.c.length === 0 && qa.nb >= 1650 && qa.nb < 1950, `streak 3, no lesson: no shower, no held board (v0.3.8): next board after the beat + reset at ${qa.nb} ms (${qa.c.map(e => e[0]).join(',')})`);
// ---------- fix 1: filled sum held to the handover (0.95 s) ----------
async function sumAt(base, shot) {
  await open(base, '?round=600&level=easy&teach=quick');
  await tapEl('#mStart'); await waitPlay(); await wait(300); await tapAnswer(); await wait(1200); await waitPlay(); await wait(200);
  await tapAnswer(); const t = await untilMs('__tapT', 950);
  const s = await kk(() => ({ cls: document.getElementById('sum').className, text: document.getElementById('sum').textContent, lines: document.querySelectorAll('#board svg.connect line').length }));
  const b = await page.locator('#board').boundingBox(), sb = await page.locator('#sum').boundingBox();
  await page.screenshot({ path: shot, clip: { x: 0, y: b.y - 10, width: 390, height: sb.y + sb.height - b.y + 20 } });
  return { t, ...s };
}
const sa = await sumAt(BASE, `${SHOTS}v0351-fix1-after-sum-0950.png`);
check(/pop/.test(sa.cls) && /^\d+\+\d+=\d+$/.test(sa.text) && sa.lines === 2, `fix 1: at ${sa.t} ms the strip still shows ${sa.text} while the lines fade`);
// ---------- fix 3: left badge outline at every drain level ----------
async function badges(base, shot) {
  await open(base, '?round=600');
  const r = await kk(() => {
    const fx = document.getElementById('fx'); const out = [];
    [0, 50, 100].forEach((d, k) => { const e = document.createElement('div'); e.className = 'srcb p0'; e.style.cssText = `width:80px;height:80px;left:${20 + k * 100}px;top:20px;font-size:40px`; e.style.setProperty('--d', d + '%'); e.innerHTML = '<div class="over"><b>7</b></div><div class="fill"><b>7</b></div>'; fx.appendChild(e);
      out.push(getComputedStyle(e.querySelector('.fill')).webkitTextStrokeWidth); });
    return out;
  });
  const fr = await page.locator('#fx').boundingBox(); await page.screenshot({ path: shot, clip: { x: fr.x + 10, y: fr.y + 10, width: 310, height: 100 } });
  return r;
}
const ba = await badges(BASE, `${SHOTS}v0351-fix3-after-badge-000-050-100.png`);
check(ba.every(w => w === '2.5px'), `fix 3: left badge's white number carries the ink outline at 0/50/100 % drained (${ba})`);
// ---------- FPS @4x: taps during a shower ----------
await open(BASE, '?round=600&level=easy&teach=quick');
await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /confetti/.test(e.name)));
await tapEl('#mStart'); await waitPlay(); await wait(300);
const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await kk(() => { window.__fr = []; let l = 0; const t1 = performance.now(); const f = t => { if (l) window.__fr.push(t - l); l = t; if (t - t1 < 2600) requestAnimationFrame(f); }; requestAnimationFrame(f); window.__kkFx.shower(); window.__kkFx.burst(); });
const lat = [];
for (let k = 0; k < 4; k++) { await wait(400); lat.push(await kk(() => { const p = window.__kk.puzzle, i = p.nums.findIndex((v, j) => v !== p.answer && !window.__kk.badTiles.has(j)), t = document.querySelector(`.tile[data-i="${i}"]`), r = t.getBoundingClientRect(); const t0 = performance.now(); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 5, isPrimary: true, pointerType: 'touch', clientX: r.x + 20, clientY: r.y + 20 })); return +(performance.now() - t0).toFixed(2); })); }
await wait(1000);
const fr = await kk(() => window.__fr); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
const avg = fr.reduce((x, y) => x + y, 0) / fr.length;
check(1000 / avg >= 55, `FPS @4x with a shower + burst (150 pieces) and 4 taps while they fall: ${(1000 / avg).toFixed(1)} avg, max ${Math.max(...fr).toFixed(1)} ms, ${fr.filter(x => x > 20).length} > 20 ms of ${fr.length}; tap handlers ${lat.join('/')} ms`);
// ---------- before shots (live v0.3.5) ----------
if (BEFORE) {
  const qb = await quickShower(BEFORE, `${SHOTS}v0351-fix2-before-quick-shower-1600.png`);
  log.push(`     before (v0.3.5): next board at ${qb.nb} ms, shower over it`);
  const sb = await sumAt(BEFORE, `${SHOTS}v0351-fix1-before-sum-0950.png`); log.push(`     before (v0.3.5) sum at ${sb.t} ms: ${sb.text}`);
  const bb = await badges(BEFORE, `${SHOTS}v0351-fix3-before-badge-000-050-100.png`); log.push(`     before (v0.3.5) badge fill stroke: ${bb}`);
}
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V0351 CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
