// v0.3.5.2 (AE): streak(n) on the same frame as the star shower's first burst (in the lesson, and on the held board
// with no lesson); correct() stays on the tap; x20 (no shower) and reduced motion keep streak on the tap.
// v0.3.8: no showers and no held board any more: in the lesson streak(n) + cheer fire on the bond's cheer frame (with
// caption()), with no lesson they fire at the tap; x20 and reduced motion as before.
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
/** play to streak `to` (lessons always play in full since v0.3.6: waitPlay waits them out), then time the last solve */
async function playTo(to) {
  for (let s = 1; s <= to; s++) {
    await waitPlay(); await wait(150);
    if (s === to) await kk(() => { window.__sfxLog.length = 0; (window.__kkConfetti || []).length = 0; });
    await tapAnswer();
    if (s < to) await wait(1150);
  }
  await wait(4200); // long enough for a lesson's shower (bond at ~+6-8 s handled below) or the held-board shower
}
const timing = () => kk(() => { const t0 = window.__tapT, L = window.__sfxLog, c = window.__kkConfetti || [];
  const at = n => { const e = L.find(e => e[0] === n); return e ? Math.round(e[2] - t0) : null; };
  const ch = L.find(e => e[0] === 'blaze' && e[3] === 'cheer'), cap = L.find(e => e[0] === 'caption');
  return { branch: !!window.__kkReact, cheer: ch ? Math.round(ch[2] - t0) : null, correct: at('correct'), streak: at('streak'), streakN: (L.find(e => e[0] === 'streak') || [])[1], shower1: c.find(e => /^shower/.test(e[0])) ? Math.round(c.find(e => /^shower/.test(e[0]))[1] - t0) : null, caption: cap ? Math.round(cap[2] - t0) : null, stage: window.__kk.teachStage }; });
// (streak(n) and Blaze's cheer run in the same synchronous task as the first burst, just before it is fired + logged;
//  the cheer swap costs ~1-2 ms, hence a 3 ms tolerance)
// A: x5 in the lesson (default teach: milestone -> full lesson; streak(5) + cheer at the bond, with caption())
await open('?round=600&level=easy');
await tapEl('#mStart'); await playTo(5);
await page.waitForFunction(() => window.__sfxLog.some(e => e[0] === 'streak'), null, { timeout: 15000 });
let a = await timing();
check(a.correct < 20 && a.streakN?.[0] === 5 && a.caption > 1000 && Math.abs(a.streak - a.caption) <= 3 && a.shower1 === null, `x5 lesson: correct at +${a.correct} ms (tap), caption at +${a.caption} ms, streak(5) at +${a.streak} ms (same tick), no shower (v0.3.8)`);
if (a.branch) check(Math.abs(a.cheer - a.streak) <= 1, `x5 lesson: blaze('cheer') + pose swap at +${a.cheer} ms, with streak(5)`);
// B: x5 / x10 with no lesson (teach=quick): v0.3.8: no held board, streak(n) + cheer at the tap
await open('?round=600&level=easy&teach=quick');
await tapEl('#mStart'); await playTo(5);
let b = await timing();
check(b.correct < 20 && b.streakN?.[0] === 5 && b.streak < 20 && b.shower1 === null, `x5 no lesson: correct at +${b.correct} ms, streak(5) at +${b.streak} ms (the tap), no shower`);
if (b.branch) check(b.cheer !== null && b.cheer < 40, `x5 no lesson: blaze('cheer') + pose swap at +${b.cheer} ms (the frame after the tap)`);
await playTo(5); // streak 10
let b10 = await timing();
check(b10.streakN?.[0] === 10 && b10.streak < 20 && b10.shower1 === null, `x10 no lesson: streak(10) at +${b10.streak} ms (the tap), no shower`);
if (b10.branch) check(b10.cheer !== null && b10.cheer < 40, `x10 no lesson: blaze('cheer') at +${b10.cheer} ms`);
// C: x20 (no shower): streak stays on the tap
await playTo(10);
let c = await timing();
check(c.streakN?.[0] === 20 && c.shower1 === null && c.streak < 20 && c.correct < 20, `x20 (no shower): correct at +${c.correct} ms, streak(20) at +${c.streak} ms (unchanged, on the tap)`);
// D: reduced motion: no shower, streak(5) on the tap
await open('?round=600&level=easy&teach=quick', true);
await tapEl('#mStart'); await playTo(5);
let d = await timing();
check(d.streakN?.[0] === 5 && d.streak < 20 && d.shower1 === null, `reduced motion x5: no shower, streak(5) on the tap (+${d.streak} ms)`);
if (d.branch) check(d.cheer !== null && d.cheer < 40, `reduced motion x5: cheer stays at its old moment, the frame after the tap (+${d.cheer} ms)`);
// E (v0.3.6, no tap-to-skip): taps all through the x5 lesson change nothing: streak(5) + cheer still fire once, together,
// on the shower's first burst inside the lesson, and the lesson runs to its end
await open('?round=600&level=easy');
await tapEl('#mStart');
for (let s = 1; s <= 5; s++) { await waitPlay(); await wait(150); if (s === 5) await kk(() => { window.__sfxLog.length = 0; (window.__kkConfetti || []).length = 0; window.__e0 = performance.now(); /* the app stamps __tapT on every tap, ignored ones too */ }); await tapAnswer(); if (s === 5) for (let k = 0; k < 12; k++) { await wait(500); await page.touchscreen.tap(195, 600); } }
await waitPlay(); await wait(200);
const e = await kk(() => ({ s: window.__sfxLog.filter(e => e[0] === 'streak').map(e => [e[1][0], Math.round(e[2] - window.__e0)]), sh: (window.__kkConfetti || []).filter(e => /^shower/.test(e[0])).map(e => Math.round(e[1] - window.__e0))[0], cap: window.__sfxLog.filter(e => e[0] === 'caption').map(e => Math.round(e[2] - window.__e0))[0], stop: window.__sfxLog.some(e => e[0] === 'stopAll'), score: window.__kk.score }));
check(e.s.length === 1 && e.s[0][0] === 5 && Math.abs(e.s[0][1] - e.cap) <= 3 && e.sh === undefined && !e.stop && e.score === 5, `x5 lesson tapped 12x: not skipped (no stopAll), streak(5) once at +${e.s[0]?.[1]} ms with the caption (+${e.cap} ms), no shower, score ${e.score}`);
if (await kk(() => !!window.__kkReact)) {
  const f = await kk(() => { const s = window.__sfxLog.find(e => e[0] === 'streak'), c = window.__sfxLog.find(e => e[0] === 'blaze' && e[3] === 'cheer'); return { s: s && Math.round(s[2]), c: c && Math.round(c[2]), n: window.__sfxLog.filter(e => e[0] === 'blaze' && e[3] === 'cheer').length }; });
  check(f.n === 1 && Math.abs(f.c - f.s) <= 1, `x5 lesson tapped: cheer fires once, with streak(5) (${JSON.stringify(f)})`);
  // round ends while the cheer is pending (mid-lesson, before the bond): dropped
  await open('?round=600&level=easy');
  await tapEl('#mStart');
  for (let s = 1; s <= 5; s++) { await waitPlay(); await wait(150); if (s === 5) await kk(() => { window.__sfxLog.length = 0; }); await tapAnswer(); if (s < 5) await wait(1150); }
  await wait(1500); await tapEl('#gQuit'); await wait(8000);
  const g = await kk(() => ({ streak: window.__sfxLog.filter(e => e[0] === 'streak').length, cheer: window.__sfxLog.filter(e => e[0] === 'blaze' && e[3] === 'cheer').length, phase: window.__kk.phase }));
  check(g.streak === 0 && g.cheer === 0 && g.phase === 'menu', `x5 lesson, quit before the bond: deferred streak + cheer dropped ${JSON.stringify(g)}`);
}
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V0352 STREAK CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
