// e2e v0.1: node scripts/e2e.mjs [baseUrl]. Without a URL it serves ./dist locally under /Kakooma/.
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
const ROUND = 20;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [], fails = [], log = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
const PREFIX = process.env.SHOT_PREFIX || '';
const shot = n => page.screenshot({ path: `${SHOTS}${PREFIX}${n}.png` });
const kk = f => page.evaluate(f);
const wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const tapTile = i => tapEl(`.tile[data-i="${i}"]`);
const answerIdx = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
const wrongIdx = () => kk(() => { const p = window.__kk.puzzle, a = p.nums.indexOf(p.answer); return a === 0 ? 1 : 0; });
const waitPlay = () => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 5000 });
async function correct() { await waitPlay(); await wait(120); await tapTile(await answerIdx()); }
async function pickN(n) { await tapEl(`#picker [data-n="${n}"]`); await wait(400); }
async function tilesOnCorners(n) {
  return kk(n => {
    const b = document.getElementById('board').getBoundingClientRect();
    const vis = [...document.querySelectorAll('.slot')].filter(s => getComputedStyle(s).visibility !== 'hidden' && +s.style.opacity > .99);
    const c = vis.map(s => { const r = s.getBoundingClientRect(); return [r.x + r.width / 2 - b.x, r.y + r.height / 2 - b.y]; });
    const cx = c.reduce((s, p) => s + p[0], 0) / c.length, cy = c.reduce((s, p) => s + p[1], 0) / c.length;
    const d = c.map(p => Math.hypot(p[0] - cx, p[1] - cy));
    const minGap = Math.min(...c.flatMap((p, i) => c.slice(i + 1).map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))));
    const tile = vis[0].querySelector('.tile').getBoundingClientRect().width; // v0.3: in the menu the visible corner is a small dot
    const inside = c.every(p => p[0] - tile / 2 >= -1 && p[0] + tile / 2 <= b.width + 1);
    return { count: vis.length, want: n, spread: Math.max(...d) - Math.min(...d), minGap, tile, inside, poly: document.getElementById('outlinePoly').getAttribute('points').split(' ').length };
  }, n);
}

await page.goto(BASE + '?level=hard&teach=quick&round=' + ROUND); await kk(() => localStorage.clear()); await page.reload();
await page.waitForFunction(() => document.fonts.status === 'loaded');
check(new RegExp('^' + (process.env.EXPECT_VER || 'v0\\.1') + '$').test(await page.textContent('#verLabel')), 'menu shows version v0.1: ' + await page.textContent('#verLabel'));
check((await page.textContent('.wordmark')) === 'KAKOOMA', 'wordmark KAKOOMA');
check(await kk(() => document.fonts.check('700 36px Fredoka') && document.fonts.check('800 12px Nunito')), 'Fredoka + Nunito loaded');
await pickN(4);
let g = await tilesOnCorners(4); check(g.count === 4 && g.spread < 2 && g.poly === 4 && g.inside, 'menu: 4 tiles on square corners ' + JSON.stringify(g));
await shot('01-menu');
// picker slide: mid-animation tiles are between corners
await tapEl('#picker [data-n="7"]'); await wait(90);
const mid = await tilesOnCorners(7); await wait(350); g = await tilesOnCorners(7);
check(g.count === 7 && g.spread < 2 && g.minGap > g.tile, 'picker 7: corners on the heptagon, no overlap ' + JSON.stringify(g));
check(mid.spread > 2 || mid.count !== 7, 'picker change animates (mid-slide not yet on corners)');
await pickN(4);

// ---------- N = 4 ----------
await tapEl('#mStart'); await waitPlay();
check(await kk(() => window.__kk.n === 4 && window.__kk.puzzle.nums.length === 4), 'round N=4 started');
await wait(300); await shot('02-puzzle-4');
// input latency: handler runs on pointerdown, before pointerup/click
const lat = await kk(() => new Promise(res => {
  const p = window.__kk.puzzle, i = p.nums.indexOf(p.answer), t = document.querySelector(`.tile[data-i="${i}"]`);
  const r = t.getBoundingClientRect(), o = { bubbles: true, cancelable: true, pointerId: 9, isPrimary: true, pointerType: 'touch', clientX: r.x + 5, clientY: r.y + 5 };
  const t0 = performance.now(); t.dispatchEvent(new PointerEvent('pointerdown', o));
  res({ ok: t.classList.contains('ok'), ms: performance.now() - t0 });
}));
check(lat.ok && lat.ms < 16, `correct registered synchronously on pointerdown (${lat.ms.toFixed(2)} ms handler)`);
// timer paused during feedback
const l1 = await kk(() => window.__kk.left); await wait(250); const l2 = await kk(() => ({ left: window.__kk.left, running: window.__kk.running, phase: window.__kk.phase }));
check(l2.phase === 'feedback' && !l2.running && l1 === l2.left, 'timer paused during correct feedback');
for (let k = 0; k < 4; k++) await correct();
await wait(620); // v0.3.5: the strip fills in 0.5 s into the connect beat
let s = await kk(() => ({ streak: window.__kk.streak, tier: document.getElementById('blaze').dataset.tier, pill: document.getElementById('streakPill').textContent, eq: document.getElementById('sum').textContent.replace(/([+=])/g, ' $1 '), eqOn: !!document.querySelector('#sum .a'), green: document.querySelectorAll('.tile.ok').length, blue: document.querySelectorAll('.tile.add').length }));
check(s.streak === 5 && s.tier === '1' && s.pill === 'x5', 'streak x5, Blaze tier 1 ' + JSON.stringify(s));
check(s.eqOn && /^\d+ \+ \d+ = \d+$/.test(s.eq) && s.green === 1 && s.blue === 2, 'feedback: 1 green, 2 blue, equation ' + s.eq);
await wait(150); await shot('03-mid-streak-4');
// wrong tap
await waitPlay(); await wait(100);
const before = await kk(() => window.__kk.left - (window.__kk.running ? performance.now() - window.__kk.since : 0));
await tapTile(await wrongIdx()); await wait(90);
s = await kk(() => ({ streak: window.__kk.streak, miss: window.__kk.miss, bad: document.querySelectorAll('.tile.bad').length, tier: document.getElementById('blaze').dataset.tier, left: window.__kk.left - (window.__kk.running ? performance.now() - window.__kk.since : 0) }));
check(s.streak === 0 && s.miss === 1 && s.bad === 1 && s.tier === '0', 'wrong tap: streak reset, coral tile ' + JSON.stringify(s));
check(before - s.left > 2900 && before - s.left < 3400, `wrong tap costs 3 s (${((before - s.left) / 1000).toFixed(2)}s)`);
await shot('04-wrong-sigh-4');
await tapTile(await wrongIdx()); check((await kk(() => window.__kk.miss)) === 1, 're-tapping the same wrong tile is not penalised twice');
// solve until time is up (checks the x20 sunglasses unlock on the way)
let saw20 = false;
while ((await kk(() => window.__kk.phase)) !== 'done') {
  try { await page.waitForFunction(() => ['play', 'done'].includes(window.__kk.phase), null, { timeout: 3000 }); } catch {}
  if ((await kk(() => window.__kk.phase)) !== 'play') continue;
  await wait(250); if ((await kk(() => window.__kk.phase)) === 'play') await tapTile(await answerIdx()).catch(() => {});
  if (!saw20 && (await kk(() => window.__kk.streak)) === 20) {
    saw20 = true; await wait(260);
    const z = await kk(() => ({ tier: document.getElementById('blaze').dataset.tier, scale: getComputedStyle(document.querySelector('#blaze .blaze-scale')).transform, shades: document.querySelectorAll('.shades').length }));
    check(z.tier === '3' && /matrix\(1\.25,/.test(z.scale) && z.shades === 0, 'x20 (v0.3.6.1): Blaze at his biggest size (tier 3, 1.25), no sunglasses ' + JSON.stringify(z));
    await shot('03b-streak-x20-4');
  }
}
check(saw20, 'reached a x20 streak');
await page.waitForSelector('#results:not(.hidden)');
let r = await kk(() => ({ score: +document.getElementById('rScore').textContent, streak: document.getElementById('rStreak').textContent, avg: document.getElementById('rAvg').textContent, miss: document.getElementById('rMiss').textContent, rank: document.getElementById('rRank').textContent, name: document.getElementById('nameIn').value, card: !document.getElementById('nameCard').classList.contains('hidden'), save: document.getElementById('nameSave').disabled, st: window.__kk.score, best: window.__kk.best }));
check(r.score === r.st && r.score >= 6 && r.streak === 'x' + r.best && /s$/.test(r.avg) && r.miss === '1', 'results ' + JSON.stringify(r));
check(r.card && r.name === '' && r.save && /#1/.test(r.rank), 'results: rank #1, name entry empty (no prefill), Save disabled until typed');
const foot = await kk(() => { const f = document.querySelector('#results .foot').getBoundingClientRect(); return { bottom: f.bottom, h: innerHeight }; });
check(Math.abs(foot.bottom - foot.h) < 2, 'results Retry/Menu pinned to the bottom');
await shot('05-results-4');
await tapEl('#nameIn'); await page.keyboard.type('xyz');
check((await page.inputValue('#nameIn')) === 'XYZ', 'initials uppercase');
await tapEl('#nameClear'); check((await page.inputValue('#nameIn')) === '', 'Clear empties initials');
await page.keyboard.type('cal'); await page.keyboard.press('Escape');
await tapEl('#nameSave'); await page.waitForSelector('#boards:not(.hidden)');
let b = await kk(() => ({ rows: [...document.querySelectorAll('#bRows .row:not(.head) .nm')].map(e => e.textContent), you: document.querySelector('#bRows .row.you .nm')?.textContent, tab: document.querySelector('#bTabs .on')?.dataset.n, retry: !document.getElementById('bRetry').classList.contains('hidden') }));
check(b.rows[0] === 'CAL' && b.you === 'CAL' && b.tab === '4' && b.retry, 'saved CAL on 4 board, highlighted, Retry shown ' + JSON.stringify(b));
await tapEl('#bRetry'); await waitPlay();
check(await kk(() => window.__kk.n === 4 && window.__kk.score === 0 && window.__kk.puzzle.nums.length === 4), 'Retry starts a fresh N=4 round');
await correct(); await correct();
await tapEl('#gQuit'); await wait(100);
check(await kk(() => window.__kk.phase === 'menu' && document.getElementById('play').dataset.mode === 'menu'), 'Quit returns to menu');
check((await page.textContent('#bestLine')).includes('CAL'), 'menu shows best for Square');

// ---------- N = 7 ----------
await pickN(7); await tapEl('#mStart'); await waitPlay(); await wait(300);
g = await tilesOnCorners(7); check(g.count === 7 && g.minGap > g.tile && g.inside, 'N=7 tiles fit without overlap ' + JSON.stringify(g));
await shot('06-puzzle-7');
for (let k = 0; k < 10; k++) await correct();
await wait(80);
s = await kk(() => ({ streak: window.__kk.streak, tier: document.getElementById('blaze').dataset.tier }));
check(s.streak === 10 && s.tier === '2', 'streak x10, Blaze tier 2 ' + JSON.stringify(s));
await shot('07-mid-streak-7');
await waitPlay(); await tapTile(await wrongIdx()); await wait(80);
check((await kk(() => window.__kk.streak)) === 0, 'N=7 wrong tap breaks the streak');
await shot('08-wrong-sigh-7');
await page.waitForSelector('#results:not(.hidden)', { timeout: (ROUND + 5) * 1000 });
await shot('09-results-7');
r = await kk(() => ({ score: document.getElementById('rScore').textContent, card: !document.getElementById('nameCard').classList.contains('hidden') }));
check(r.card, 'N=7 score qualifies ' + JSON.stringify(r));
await tapEl('#nameIn'); await page.keyboard.type('kid'); await page.keyboard.press('Enter');
await page.waitForSelector('#boards:not(.hidden)');
b = await kk(() => ({ rows: [...document.querySelectorAll('#bRows .row:not(.head) .nm')].map(e => e.textContent), tab: document.querySelector('#bTabs .on')?.dataset.n }));
check(b.tab === '7' && b.rows.join() === 'KID', 'N=7 board has only KID ' + JSON.stringify(b));
await shot('10-leaderboard-7');
await tapEl('#bTabs [data-n="4"]'); await wait(50);
b = await kk(() => [...document.querySelectorAll('#bRows .row:not(.head) .nm')].map(e => e.textContent));
check(b.join() === 'CAL', 'filter pill 4 shows only CAL');
await shot('11-leaderboard-4');
await tapEl('#bTabs [data-n="5"]'); await wait(50); await shot('12-leaderboard-empty-5');
await tapEl('#bMenu'); await wait(100);
check(await kk(() => window.__kk.phase === 'menu' && !document.getElementById('play').classList.contains('hidden')), 'leaderboard Menu returns to menu');
// results Menu button + persistence across reload
await page.reload(); await page.waitForFunction(() => window.__kk);
check((await kk(() => JSON.parse(localStorage.getItem('kk.board.v2')).length)) === 2, 'leaderboard persists across reload (localStorage)');
await tapEl('#mStart'); await waitPlay(); await tapEl('#gQuit'); await wait(50);
await tapEl('#mStart'); await page.waitForSelector('#results:not(.hidden)', { timeout: (ROUND + 5) * 1000 });
check(await kk(() => document.getElementById('nameCard').classList.contains('hidden')), 'zero score: no save prompt');
await tapEl('#rMenu'); await wait(100);
check(await kk(() => window.__kk.phase === 'menu' && !document.getElementById('play').classList.contains('hidden')), 'results Menu returns to menu');

console.log(log.join('\n'));
console.log(fails.length ? fails.join('\n') : 'ALL CHECKS PASSED');
console.log('page errors:', errs.length ? errs : 'none');
await browser.close(); server.close();
process.exit(fails.length || errs.length ? 1 : 0);
