// v0.2.3 sound-hook check: node scripts/sfx-hooks.mjs [baseUrl]. Records window.__sfxLog through a short round + Bond Lab and checks every hook fires at its moment.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname;
const SHOTS = new URL('../shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/';
  if (p === '/') p = '/index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctxOpts = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const page = await browser.newPage(ctxOpts); const errs = []; page.on('pageerror', e => errs.push(e.message));
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const tapEl = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const ans = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
const wrong = () => kk(() => { const p = window.__kk.puzzle, a = p.nums.indexOf(p.answer); return a === 0 ? 1 : 0; });
const waitPlay = () => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 12000 });
const fails = [], ok = []; const check = (c, m) => (c ? ok : fails).push((c ? 'ok   ' : 'FAIL ') + m);
await page.goto(BASE + '?round=14&teach=quick'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(() => { localStorage.clear(); localStorage.setItem('kk.board.v1', JSON.stringify([{ name: 'AAA', n: 4, score: 1, streak: 1, avg: 900, miss: 0, at: 1 }])); }); await page.reload(); await page.waitForFunction(() => window.__kk);
await kk(() => { window.__sfxLog = []; window.__T = performance.now(); });
const since = () => kk(() => window.__sfxLog.map(([n, a, t]) => [n + (a.length ? `(${a.join(',')})` : ''), Math.round(t - window.__T)]));
await tapEl('#picker [data-n="4"]'); await wait(300);
await tapEl('#mStart'); await waitPlay(); await wait(200);
await tapEl(`.tile[data-i="${await wrong()}"]`); await wait(200);
for (let k = 0; k < 6; k++) { await tapEl(`.tile[data-i="${await ans()}"]`); await wait(80); await waitPlay(); await wait(80); }
await page.locator('#tray .chip').last().scrollIntoViewIfNeeded(); await tapEl('#tray .chip >> nth=-1'); await wait(100);
const rph = await kk(() => window.__kk.phase); console.log('after chip tap:', rph); if (rph === 'replay') { await wait(300); await page.touchscreen.tap(206, 640); } await waitPlay();
await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 20000 }); await wait(200);
const g = await since();
const names = g.map(x => x[0]), has = n => names.includes(n), t = n => g.find(x => x[0] === n)?.[1];
for (const n of ['uiTap', 'roundStart', 'tap', 'wrong', 'penalty', 'correct', 'streak(5)', 'newBest', 'replay', 'lowTime', 'tick(5)', 'tick(4)', 'tick(3)', 'tick(2)', 'tick(1)', 'timeUp']) check(has(n), `${n} fired (${t(n)} ms)`);
check(names.filter(n => n === 'lowTime').length === 1 && names.filter(n => n.startsWith('tick(')).join() === 'tick(5),tick(4),tick(3),tick(2),tick(1)', 'lowTime once; tick 5..1 once each, in order');
check(names.filter(n => n === 'newBest').length === 1 && names.indexOf('newBest') > names.indexOf('correct'), 'newBest once, after the correct that beats the old best');
check(t('tick(1)') < t('timeUp') && t('lowTime') < t('tick(5)'), 'lowTime < tick(5..1) < timeUp');
// Bond Lab
await tapEl('#rMenu'); await wait(200); await kk(() => { window.__sfxLog = []; window.__T = performance.now(); });
await tapEl('#mLab'); await wait(200); await tapEl('#labWholes [data-w="6"]'); await wait(100);
for (const v of [1, 2, 2, 3]) { await page.locator('#labSlider').fill(String(v)); await page.locator('#labSlider').dispatchEvent('change'); await wait(120); }
await wait(400); await tapEl('#labQuizBtn'); await wait(200);
const l = await since(), ln = l.map(x => x[0]);
check(ln[0] === 'uiTap', 'uiTap on the Bond Lab menu button');
check(ln.filter(n => n.startsWith('slide(')).join() === 'slide(1),slide(2),slide(3)', 'slide(n) once per step change (repeat value ignored): ' + ln.filter(n => n.startsWith('slide(')).join());
check(ln.filter(n => n.startsWith('labPair(')).join() === 'labPair(1),labPair(2),labPair(3)', 'labPair(a) once per new pair: ' + ln.filter(n => n.startsWith('labPair(')).join());
check(ln.includes('star') && ln.includes('quizStart'), 'star + quizStart');
console.log(JSON.stringify({ round: g.filter(x => !['tap', 'correct'].includes(x[0])), lab: l }));
console.log(ok.join('\n')); console.log(fails.length ? fails.join('\n') : 'ALL SFX CHECKS PASSED'); console.log('page errors:', errs.length ? errs : 'none');
await browser.close(); server.close(); process.exit(fails.length || errs.length ? 1 : 0);
