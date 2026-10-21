// v0.3.5.2 (AE): streak(n) on the same frame as the star shower's first burst (in the lesson, and on the held board
// with no lesson); correct() stays on the tap; x20 (no shower) and reduced motion keep streak on the tap.
// node scripts/streak-v0352.mjs [baseUrl]. Prints the timing log.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [];
const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
let page;
async function open(q, reduced = false) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(() => { window.__sfxLog = []; document.addEventListener('pointerdown', () => { window.__tapT = performance.now(); }, true); });
  await page.goto(BASE + q); await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /confetti/.test(e.name)) || matchMedia('(prefers-reduced-motion: reduce)').matches); await page.waitForTimeout(300);
}
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const waitPlay = (t = 20000) => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: t });
const tapAnswer = async () => { const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); };
/** play to streak `to`, skipping lessons (after their beat), then return the timing for the last solve */
async function playTo(to, skipLessons) {
  for (let s = 1; s <= to; s++) {
    await waitPlay(); await wait(150);
    if (s === to) await kk(() => { window.__sfxLog.length = 0; (window.__kkConfetti || []).length = 0; });
    await tapAnswer();
    if (s < to) { await wait(1150); if (skipLessons && await kk(() => window.__kk.teach != null)) await tapEl('#skipper'); }
  }
  await wait(4200); // long enough for a lesson's shower (bond at ~+6-8 s handled below) or the held-board shower
}
const timing = () => kk(() => { const t0 = window.__tapT, L = window.__sfxLog, c = window.__kkConfetti || [];
  const at = n => { const e = L.find(e => e[0] === n); return e ? Math.round(e[2] - t0) : null; };
  return { correct: at('correct'), streak: at('streak'), streakN: (L.find(e => e[0] === 'streak') || [])[1], shower1: c.find(e => /^shower/.test(e[0])) ? Math.round(c.find(e => /^shower/.test(e[0]))[1] - t0) : null, stage: window.__kk.teachStage }; });
// A: x5 in the lesson (default teach: milestone -> full lesson; shower at the bond)
await open('?round=600&level=easy');
await tapEl('#mStart'); await playTo(5, true);
await page.waitForFunction(() => (window.__kkConfetti || []).some(e => /^shower/.test(e[0])), null, { timeout: 15000 });
let a = await timing();
check(a.correct < 20 && a.streakN?.[0] === 5 && a.shower1 > 1000 && Math.abs(a.streak - a.shower1) <= 1, `x5 lesson: correct at +${a.correct} ms (tap), shower's first burst at +${a.shower1} ms, streak(5) at +${a.streak} ms (same tick)`);
// B: x5 / x10 with no lesson (teach=quick): the held-board shower at 0.5 s
await open('?round=600&level=easy&teach=quick');
await tapEl('#mStart'); await playTo(5, false);
let b = await timing();
check(b.correct < 20 && b.streakN?.[0] === 5 && Math.abs(b.shower1 - 500) < 60 && Math.abs(b.streak - b.shower1) <= 1, `x5 no lesson: correct at +${b.correct} ms, shower's first burst at +${b.shower1} ms, streak(5) at +${b.streak} ms`);
await playTo(5, false); // streak 10
let b10 = await timing();
check(b10.streakN?.[0] === 10 && Math.abs(b10.streak - b10.shower1) <= 1, `x10 no lesson: shower's first burst at +${b10.shower1} ms, streak(10) at +${b10.streak} ms`);
// C: x20 (no shower): streak stays on the tap
await playTo(10, false);
let c = await timing();
check(c.streakN?.[0] === 20 && c.shower1 === null && c.streak < 20 && c.correct < 20, `x20 (no shower): correct at +${c.correct} ms, streak(20) at +${c.streak} ms (unchanged, on the tap)`);
// D: reduced motion: no shower, streak(5) on the tap
await open('?round=600&level=easy&teach=quick', true);
await tapEl('#mStart'); await playTo(5, false);
let d = await timing();
check(d.streakN?.[0] === 5 && d.streak < 20 && d.shower1 === null, `reduced motion x5: no shower, streak(5) on the tap (+${d.streak} ms)`);
// E: lesson skipped before its bond: the deferred streak plays at the next board instead of being lost
await open('?round=600&level=easy');
await tapEl('#mStart');
for (let s = 1; s <= 5; s++) { await waitPlay(); await wait(150); if (s === 5) await kk(() => { window.__sfxLog.length = 0; }); await tapAnswer(); await wait(1150); if (await kk(() => window.__kk.teach != null)) await tapEl('#skipper'); }
await waitPlay(); await wait(200);
const e = await kk(() => window.__sfxLog.filter(e => e[0] === 'streak').map(e => e[1]));
check(e.length === 1 && e[0][0] === 5, `x5 lesson skipped before the bond: streak(5) still plays once, at the next board (${JSON.stringify(e)})`);
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V0352 STREAK CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
