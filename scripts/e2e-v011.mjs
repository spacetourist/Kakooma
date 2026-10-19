// e2e v0.1.1: node scripts/e2e-v011.mjs [baseUrl]. Coral cleared on solve, sum strip, solved tray, first-puzzle hint, N=7.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
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
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [], fails = [], log = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
const shot = n => page.screenshot({ path: `${SHOTS}v011-${n}.png` });
const kk = f => page.evaluate(f);
const wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const tapTile = i => tapEl(`.tile[data-i="${i}"]`);
const answerIdx = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
const wrongIdx = () => kk(() => { const p = window.__kk.puzzle, a = p.nums.indexOf(p.answer); return a === 0 ? 1 : 0; });
const waitPlay = () => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 5000 });
const geo = () => kk(() => {
  const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.width), Math.round(b.height)]; };
  const sum = document.getElementById('sum').getBoundingClientRect(), score = document.querySelector('.below.game-only .lblrow').getBoundingClientRect();
  const tray = document.getElementById('tray'), tb = tray.getBoundingClientRect(), quit = document.getElementById('gQuit').getBoundingClientRect();
  return { tiles: [...document.querySelectorAll('.slot')].map(r).join('|'), board: r(document.getElementById('board')).join(), quit: r(document.getElementById('gQuit')).join(),
    quitIn: quit.bottom <= innerHeight && quit.top > 0, trayAboveQuit: tb.bottom <= quit.top + 1, sumToScore: Math.round(score.top - sum.bottom),
    chips: tray.children.length, news: tray.querySelectorAll('.chip.new').length, firstNew: tray.firstElementChild?.classList.contains('new') ?? null,
    overflow: tray.scrollHeight > tray.clientHeight, pageScroll: document.documentElement.scrollHeight > innerHeight + 1, trayH: Math.round(tb.height) };
});
const sumState = () => kk(() => {
  const s = document.getElementById('sum'), cs = e => getComputedStyle(e).color;
  return { text: s.textContent, hint: s.classList.contains('hint'), parts: [...s.querySelectorAll('.p')].map(e => [e.textContent, cs(e)]), ans: s.querySelector('.a') ? [s.querySelector('.a').textContent, cs(s.querySelector('.a'))] : null, size: parseFloat(getComputedStyle(s).fontSize) };
});
const BLUE = 'rgb(58, 123, 255)', GREEN = 'rgb(34, 197, 94)';
const centreClear = () => kk(() => { const b = document.getElementById('board'); return [...b.children].filter(e => !e.classList.contains('slot') && !e.classList.contains('outline') && e.id !== 'fx').length === 0 && !/=/.test(document.getElementById('fx')?.textContent || ''); });

await page.goto(BASE + '?teach=quick&round=45'); await kk(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => document.fonts.status === 'loaded');
check((await page.textContent('#verLabel')) === (process.env.EXPECT_VER || 'v0.1.1'), 'menu shows v0.1.1: ' + await page.textContent('#verLabel'));
await tapEl('#picker [data-n="5"]'); await wait(400);
await shot('menu');

// ---------- N=5: first puzzle hint, wrong then correct ----------
await tapEl('#mStart'); await waitPlay(); await wait(300);
let s = await sumState();
check(s.hint && s.text === 'Find the number made by two others', 'first puzzle: hint shown in the strip under the board');
check(await centreClear(), 'board centre is clear (no equation inside the board)');
const g0 = await geo();
check(g0.sumToScore >= 0 && g0.sumToScore <= 24, `SCORE + time bar directly under the sum strip (gap ${g0.sumToScore}px)`);
check(!(await kk(() => [...document.querySelectorAll('.below.game-only .lbl')].some(e => e.textContent.trim().toLowerCase() === 'time'))), 'TIME label removed');
check(g0.quitIn && g0.trayAboveQuit && !g0.pageScroll, 'Quit on screen, tray above it, no page scroll ' + JSON.stringify(g0));
await shot('hint-first');
await tapTile(await wrongIdx()); await wait(120);
check((await kk(() => document.querySelectorAll('.tile.bad').length)) === 1, 'wrong tap: coral ring on the tapped tile');
// v0.2.1: the wrong-tap reason replaces the hint inside the strip for 2 s, then the hint comes back
check(await kk(() => document.getElementById('sum').classList.contains('wrong')), 'wrong tap: reason shown inside the sum strip');
await wait(2100);
check((await sumState()).hint, 'hint back in the strip after the wrong-tap caption');
await shot('wrong');
await wait(200); await tapTile(await answerIdx()); await wait(170);
s = await sumState();
const t = await kk(() => ({ bad: document.querySelectorAll('.tile.bad').length, ok: document.querySelectorAll('.tile.ok').length, add: document.querySelectorAll('.tile.add').length, p: window.__kk.puzzle }));
check(t.bad === 0 && t.ok === 1 && t.add === 2, 'wrong then correct: no coral left, 1 green + 2 blue ' + JSON.stringify({ bad: t.bad, ok: t.ok, add: t.add }));
check(s.parts.length === 2 && s.parts.every(p => p[1] === BLUE) && s.ans && s.ans[1] === GREEN && +s.parts[0][0] + +s.parts[1][0] === +s.ans[0] && +s.ans[0] === t.p.answer, 'sum strip: parts blue, answer green ' + JSON.stringify(s));
check(s.size >= 32, `sum strip is large (${s.size}px)`);
check(await centreClear(), 'board centre still clear during feedback');
let g = await geo();
check(g.chips === 1 && g.news === 1 && g.firstNew, 'tray: first chip added, green');
await shot('wrong-then-correct');
await waitPlay(); await wait(60);
s = await sumState();
check(!s.hint && s.text === '?+?=?', 'second puzzle: no hint, placeholder ? + ? = ? ' + JSON.stringify(s.text));
await shot('second-puzzle-no-hint');

// ---------- 18 more solves: tray fills, nothing moves ----------
const tilesBefore = (await geo()).tiles, quitBefore = g0.quit, boardBefore = g0.board;
let moved = 0, quitMoved = 0, badChip = 0;
for (let k = 0; k < 18; k++) {
  await waitPlay(); await wait(160);
  await tapTile(await answerIdx()); await wait(40);
  g = await geo();
  if (g.tiles !== tilesBefore || g.board !== boardBefore) moved++;
  if (g.quit !== quitBefore || !g.quitIn || !g.trayAboveQuit || g.pageScroll) quitMoved++;
  if (g.chips !== k + 2 || g.news !== 1 || !g.firstNew) badChip++;
  if (k === 7) await shot('tray-8');
}
check(moved === 0, 'tiles/board never moved while the tray filled');
check(quitMoved === 0, 'Quit never moved or left the screen; no page scroll');
check(badChip === 0, 'one chip per solve, newest first and the only green one');
g = await geo();
check(g.chips === 19 && g.overflow, `19 chips; tray scrolls inside itself (height ${g.trayH}px)`);
const chipTexts = await kk(() => [...document.querySelectorAll('#tray .chip')].slice(0, 3).map(c => c.textContent));
check(chipTexts.every(x => /^\d+ \+ \d+ = \d+$/.test(x)), 'chips show their sums ' + chipTexts.join(', '));
const st = await kk(() => ({ solved: window.__kk.solved.length, k0: document.querySelector('#tray .chip').dataset.k }));
check(st.solved === 19 && st.k0 === '18', 'chips map to stored solves (data-k) for the v0.2 replay');
await shot('tray-full');
await waitPlay(); await wait(80); await shot('tray-full-play');

// ---------- N=7 ----------
await tapEl('#gQuit'); await wait(150);
await tapEl('#picker [data-n="7"]'); await wait(400);
await tapEl('#mStart'); await waitPlay(); await wait(300);
check((await sumState()).hint && (await geo()).chips === 0, 'N=7 new round: hint back, tray empty');
await shot('n7-first');
const tiles7 = (await geo()).tiles;
await tapTile(await wrongIdx()); await wait(100); await tapTile(await answerIdx()); await wait(170);
check((await kk(() => document.querySelectorAll('.tile.bad').length)) === 0, 'N=7 wrong then correct: no coral left');
s = await sumState(); check(!!s.ans && s.ans[1] === GREEN, 'N=7 sum strip ' + s.text);
await shot('n7-sum');
for (let k = 0; k < 14; k++) { await waitPlay(); await wait(160); await tapTile(await answerIdx()); }
await wait(60);
g = await geo();
check(g.tiles === tiles7 && g.quitIn && g.trayAboveQuit && !g.pageScroll && g.chips === 15, 'N=7 after 15 solves: no shift, Quit on screen ' + JSON.stringify({ chips: g.chips, overflow: g.overflow }));
await shot('n7-tray');
// timing unchanged: timer paused during 500 ms feedback
const l1 = await kk(() => ({ left: window.__kk.left, phase: window.__kk.phase }));
await wait(200); const l2 = await kk(() => ({ left: window.__kk.left, running: window.__kk.running }));
check(l1.phase === 'feedback' && !l2.running && l1.left === l2.left, 'timer still paused during feedback');

console.log(log.join('\n'));
console.log(fails.length ? fails.join('\n') : 'ALL CHECKS PASSED');
console.log('page errors:', errs.length ? errs : 'none');
await browser.close(); server.close();
process.exit(fails.length || errs.length ? 1 : 0);
