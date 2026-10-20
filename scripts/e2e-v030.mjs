// e2e v0.3 (levels + number-free menu shapes), 390 px wide: node scripts/e2e-v030.mjs [baseUrl]. Shots shots/v030-*.png (SHOT_TAG overrides).
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
const TAG = process.env.SHOT_TAG || 'v030', VER = process.env.EXPECT_VER || 'v0.3';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [], fails = [], log = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
const shot = n => page.screenshot({ path: `${SHOTS}${TAG}-${n}.png` });
const kk = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const waitPlay = (t = 9000) => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: t });
const fonts = () => page.waitForFunction(() => document.fonts.status === 'loaded');
const st = () => kk(() => ({ lv: window.__kk.lv, n: window.__kk.n, phase: window.__kk.phase, nums: window.__kk.puzzle?.nums ?? null }));
const solveOne = async () => { const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); await waitPlay(); };
const CAP = { easy: 10, medium: 20, hard: 50 };

// ---------- 1. new player: Easy by default; menu preview is number-free ----------
await page.goto(BASE + '?round=600&teach=quick'); await kk(() => localStorage.clear()); await page.reload(); await fonts(); await wait(500);
check((await page.textContent('#verLabel')) === VER, 'menu shows ' + await page.textContent('#verLabel'));
let s = await st();
check(s.lv === 'easy', 'new player defaults to Easy ' + JSON.stringify(s));
const menu = await kk(() => ({
  segs: [...document.querySelectorAll('#levels button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
  on: document.querySelector('#levels button.on')?.dataset.lv,
  tileText: [...document.querySelectorAll('#board .tile')].map(t => t.textContent).join(''),
  pickerText: document.querySelector('#picker').textContent.trim(),
  dots: [...document.querySelectorAll('#board .slot')].filter(s => s.style.visibility !== 'hidden').map(s => Math.round(s.querySelector('.tile').getBoundingClientRect().width)),
  polyPts: document.querySelector('#outlinePoly').getAttribute('points').trim().split(/\s+/).length,
  segH: Math.round(document.querySelector('#levels button').getBoundingClientRect().height),
  levelsTop: document.querySelector('#levels').getBoundingClientRect().top, pickerTop: document.querySelector('#picker').getBoundingClientRect().top,
  foot: document.querySelector('#mBoards').getBoundingClientRect().bottom, vh: innerHeight,
  off: [...document.querySelectorAll('#picker button.off')].map(b => +b.dataset.n),
}));
check(JSON.stringify(menu.segs) === JSON.stringify(['Easy10', 'Medium20', 'Hard50']) || JSON.stringify(menu.segs) === JSON.stringify(['Easy 10', 'Medium 20', 'Hard 50']), 'level picker shows Easy 10 / Medium 20 / Hard 50 ' + JSON.stringify(menu.segs));
check(menu.on === 'easy' && menu.segH >= 52, `Easy selected; big segments (${menu.segH}px tall)`);
check(menu.levelsTop < menu.pickerTop && menu.pickerTop - menu.levelsTop < 110, 'level picker sits right next to (above) the shape picker');
check(menu.tileText === '' && menu.pickerText === '', 'menu shape preview and picker icons show no numbers');
check(menu.dots.length === 5 && menu.dots.every(w => w <= 24) && menu.polyPts === 5, 'preview: pentagon outline with plain corner dots ' + JSON.stringify(menu.dots));
check(menu.foot <= menu.vh, `menu fits at 390x844 (buttons end at ${Math.round(menu.foot)})`);
check(JSON.stringify(menu.off) === '[6,7]', 'Easy greys out Hexagon and Heptagon (no fair 6/7-number board with numbers up to 10) ' + JSON.stringify(menu.off));
await shot('01-menu-easy');
await tapEl('#picker [data-n="7"]'); await wait(250);
s = await st(); const noteTxt = await page.textContent('#bestLine');
check(s.n === 5 && /Heptagon needs Medium or Hard/.test(noteTxt), 'tapping Heptagon on Easy explains instead of switching: ' + noteTxt);
await shot('01b-menu-easy-heptagon-note');
// persistence
await tapEl('#levels [data-lv="medium"]'); await wait(200);
check((await kk(() => localStorage.getItem('kk.lv'))) === 'medium', 'choice saved (kk.lv = medium)');
await page.reload(); await fonts(); await wait(400);
check((await st()).lv === 'medium' && (await kk(() => document.querySelector('#levels .on').dataset.lv)) === 'medium', 'level remembered across reload');
await tapEl('#levels [data-lv="hard"]'); await wait(150); await tapEl('#picker [data-n="7"]'); await wait(450);
s = await st(); check(s.lv === 'hard' && s.n === 7, 'Hard + Heptagon selectable');
check((await kk(() => [...document.querySelectorAll('#board .tile')].map(t => t.textContent).join(''))) === '', 'heptagon preview still number-free');
await shot('01c-menu-hard-heptagon');
await tapEl('#levels [data-lv="easy"]'); await wait(450);
s = await st(); check(s.lv === 'easy' && s.n === 5, 'switching to Easy on a Heptagon moves to the Pentagon (largest Easy shape) ' + JSON.stringify(s));
check(/Easy uses up to 5 numbers/.test(await page.textContent('#bestLine')), 'and says why');

// ---------- 2. boards at each level respect the cap ----------
async function playLevel(lv, n, count, name) {
  await page.goto(BASE + '?round=600&teach=quick'); await fonts(); await wait(300);
  await tapEl(`#levels [data-lv="${lv}"]`); await wait(150); await tapEl(`#picker [data-n="${n}"]`); await wait(350);
  await tapEl('#mStart'); await waitPlay(); await wait(350);
  const seen = []; let maxV = 0, okAll = true;
  for (let i = 0; i < count; i++) {
    const p = await kk(() => window.__kk.puzzle);
    maxV = Math.max(maxV, ...p.nums); seen.push(`${p.a}+${p.b}`);
    const sols = []; p.nums.forEach((x, a) => p.nums.forEach((y, b) => p.nums.forEach((z, c) => { if (a !== b && a !== c && b < c && y + z === x) sols.push(x); })));
    if (sols.length !== 1 || p.nums.length !== n || Math.min(...p.nums) < 1) okAll = false;
    if (i === 1) { await wait(250); await shot(name); }
    await solveOne(); await wait(30);
  }
  check(maxV <= CAP[lv] && okAll && (await st()).lv === lv, `${lv} ${n} numbers: ${count} live boards, largest number ${maxV} <= ${CAP[lv]}, each exactly one solution`);
  check(new Set(seen).size === seen.length, `${lv} ${n}: no sum repeated in ${count} boards`);
  await tapEl('#gQuit'); await wait(300);
}
await playLevel('easy', 5, 12, '02-board-easy');
await playLevel('medium', 6, 12, '03-board-medium');
await playLevel('hard', 7, 12, '04-board-hard');
// Easy 4: the 20-sum pool runs out inside a round -> it cycles, never the same sum twice in a row
{
  await page.goto(BASE + '?round=600&teach=quick'); await fonts(); await wait(300);
  await tapEl('#levels [data-lv="easy"]'); await wait(150); await tapEl('#picker [data-n="4"]'); await wait(350);
  await tapEl('#mStart'); await waitPlay(); await wait(300);
  const order = [];
  for (let i = 0; i < 44; i++) { const p = await kk(() => window.__kk.puzzle); order.push(`${p.a}+${p.b}`); if (Math.max(...p.nums) > 10) order.push('CAP!'); await solveOne(); }
  const backToBack = order.some((k, i) => i && k === order[i - 1]);
  check(!order.includes('CAP!') && new Set(order.slice(0, 20)).size === 20 && !backToBack, `Easy 4: first 20 boards use all 20 sums, then the pool cycles; never back to back (44 boards, ${new Set(order).size} distinct)`);
  await tapEl('#gQuit'); await wait(300);
}

// ---------- 3. results: level shown; Retry keeps level + shape ----------
await page.goto(BASE + '?round=8&teach=quick'); await fonts(); await wait(300);
await tapEl('#levels [data-lv="medium"]'); await wait(150); await tapEl('#picker [data-n="6"]'); await wait(350);
await tapEl('#mStart'); await waitPlay();
for (let i = 0; i < 3; i++) { await solveOne(); }
await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 15000 }); await wait(400);
const res = await kk(() => ({ sub: document.querySelector('#rSub').textContent, tag: document.querySelector('#rSub .lvtag')?.textContent, rank: document.querySelector('#rRank').textContent }));
check(res.tag === 'Medium 20' && /Hexagon/.test(res.sub) && /Medium Hexagon/.test(res.rank), 'results show the level: ' + JSON.stringify(res));
await kk(() => { const i = document.getElementById('nameIn'); i.value = 'KID'; i.dispatchEvent(new Event('input')); });
await shot('05-results');
await tapEl('#rRetry'); await waitPlay(); await wait(200);
s = await st(); check(s.lv === 'medium' && s.n === 6 && Math.max(...s.nums) <= 20, 'Retry: same level and shape ' + JSON.stringify(s));
for (let i = 0; i < 2; i++) await solveOne();
await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 15000 }); await wait(300);
await kk(() => { const i = document.getElementById('nameIn'); i.value = 'KID'; i.dispatchEvent(new Event('input')); }); await tapEl('#nameSave'); await wait(300);
let lb = await kk(() => ({ on: document.querySelector('#bLevels .on')?.dataset.lv, tab: document.querySelector('#bTabs .on')?.dataset.n, rows: document.querySelectorAll('#bRows .row:not(.head)').length, head: document.querySelector('#bHead').textContent }));
check(lb.on === 'medium' && lb.tab === '6' && lb.rows === 1, 'saved score lands on the Medium Hexagon board ' + JSON.stringify(lb));
await tapEl('#bRetry'); await waitPlay(); s = await st();
check(s.lv === 'medium' && s.n === 6, 'leaderboard Retry keeps Medium Hexagon');
await tapEl('#gQuit'); await wait(300);

// ---------- 4. leaderboard: v1 scores migrate to Hard; level switch ----------
const V1 = [
  { name: 'OLD', n: 4, score: 21, streak: 9, avg: 1800, miss: 1, at: 1000 },
  { name: 'GRN', n: 7, score: 14, streak: 6, avg: 2900, miss: 2, at: 2000 },
  { name: 'MUM', n: 5, score: 17, streak: 5, avg: 2400, miss: 0, at: 3000 },
];
await kk(v1 => { localStorage.clear(); localStorage.setItem('kk.board.v1', JSON.stringify(v1)); localStorage.setItem('kk.n', '7'); }, V1);
await page.goto(BASE + '?round=600&teach=quick'); await fonts(); await wait(400);
s = await st();
check(s.lv === 'hard' && s.n === 7, 'returning v0.2 player (saved shape/scores, no level yet) starts on Hard, where the old scores live ' + JSON.stringify(s));
const mig = await kk(() => ({ v2: JSON.parse(localStorage.getItem('kk.board.v2') || 'null'), v1: localStorage.getItem('kk.board.v1') !== null, best: document.querySelector('#bestLine').textContent }));
check(Array.isArray(mig.v2) && mig.v2.length === 3 && mig.v2.every(e => e.lv === 'hard') && mig.v1, 'v1 scores copied once to kk.board.v2 as Hard; v1 kept as a backup');
check(/Best on Hard Heptagon: 14 by GRN/.test(mig.best), 'menu: ' + mig.best);
await tapEl('#mBoards'); await wait(300);
lb = await kk(() => ({ on: document.querySelector('#bLevels .on')?.dataset.lv, tab: document.querySelector('#bTabs .on')?.dataset.n, names: [...document.querySelectorAll('#bRows .nm')].map(e => e.textContent) }));
check(lb.on === 'hard' && lb.tab === '7' && lb.names.join() === 'GRN', 'leaderboard opens on Hard Heptagon with the old score ' + JSON.stringify(lb));
await tapEl('#bTabs [data-n="4"]'); await wait(150);
check((await kk(() => [...document.querySelectorAll('#bRows .nm')].map(e => e.textContent).join())) === 'OLD', 'Hard Square: old score');
await tapEl('#bLevels [data-lv="easy"]'); await wait(200);
lb = await kk(() => ({ on: document.querySelector('#bLevels .on')?.dataset.lv, tab: document.querySelector('#bTabs .on')?.dataset.n, empty: !!document.querySelector('#bRows .empty'), off: [...document.querySelectorAll('#bTabs .off')].map(b => +b.dataset.n), head: document.querySelector('#bHead').textContent }));
check(lb.on === 'easy' && lb.tab === '4' && lb.empty && JSON.stringify(lb.off) === '[6,7]', 'switch to Easy: separate (empty) board, 6/7 greyed ' + JSON.stringify(lb));
await shot('06-leaderboard-easy');
await tapEl('#bLevels [data-lv="hard"]'); await wait(200); await tapEl('#bTabs [data-n="5"]'); await wait(200);
check((await kk(() => [...document.querySelectorAll('#bRows .nm')].map(e => e.textContent).join())) === 'MUM', 'Hard Pentagon: old score');
await shot('06b-leaderboard-hard-migrated');
await tapEl('#bLevels [data-lv="medium"]'); await wait(200);
check((await kk(() => document.querySelector('#bTabs .on').dataset.n)) === '5' && !!(await kk(() => document.querySelector('#bRows .empty'))), 'Medium Pentagon: empty, shape kept when switching level');
await tapEl('#bMenu'); await wait(300);

// ---------- 5. teaching at the edges: Easy 3 + 7 = 10 (one frame), Hard 24 + 26 = 50 (two rows) ----------
async function teachShot(lv, n, puzzle, name, waitStage) {
  await page.goto(BASE + `?round=600&teach=full&level=${lv}`); await fonts(); await wait(300);
  await tapEl(`#picker [data-n="${n}"]`); await wait(300);
  await kk(p => { window.__kkNext = [p, p]; }, puzzle);
  await tapEl('#mStart'); await waitPlay(); await wait(300);
  await kk(p => { window.__kkNext = [p]; }, puzzle);
  const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
  await tapEl(`.tile[data-i="${i}"]`);
  await page.waitForFunction(g => window.__kk.teachStage === g, waitStage, { timeout: 6000 }); await wait(380);
  const info = await kk(() => { const b = document.querySelector('#fx').getBoundingClientRect(); const fs = [...document.querySelectorAll('#fx .tf')].map(f => f.getBoundingClientRect());
    return { frames: fs.length, rows: new Set(fs.map(f => Math.round(f.top))).size, inside: fs.every(f => f.left >= b.left - 1 && f.right <= b.right + 1 && f.top >= b.top - 1 && f.bottom <= b.bottom + 1), w: [...new Set(fs.map(f => Math.round(f.width)))], ten: document.querySelectorAll('#fx .tf.ten').length, caps: [...document.querySelectorAll('#fx .tcap:not(.bondcap)')].map(c => c.textContent) }; });
  await shot(name);
  await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 9000 });
  return info;
}
let t = await teachShot('easy', 4, { nums: [3, 7, 10, 1], a: 3, b: 7, answer: 10 }, '07-teach-easy-3-7', 'counted');
check(t.frames === 1 && t.ten === 1 && t.caps.join('|') === '3 + 7 = 10', 'Easy 3 + 7 = 10: one full ten-frame, ringed, one caption (no "10 + 0 = 10") ' + JSON.stringify(t));
t = await teachShot('easy', 5, { nums: [2, 5, 7, 10, 1], a: 2, b: 5, answer: 7 }, '07b-teach-easy-2-5', 'counted');
check(t.frames === 1 && t.ten === 0 && t.caps.join('|') === '2 + 5 = 7', 'under ten: one frame, no ten, the sum caption ' + JSON.stringify(t));
t = await teachShot('hard', 7, { nums: [24, 26, 50, 1, 3, 9, 41], a: 24, b: 26, answer: 50 }, '08-teach-hard-24-26', 'counted');
check(t.frames === 5 && t.ten === 5 && t.rows === 2 && t.inside && t.w.length === 1 && t.caps.join('|') === '24 + 6 = 30', 'Hard 24 + 26 = 50 (v0.3.3): exactly five full frames in two rows, inside the board ' + JSON.stringify(t));
t = await teachShot('hard', 5, { nums: [1, 49, 50, 4, 12], a: 1, b: 49, answer: 50 }, '08b-teach-hard-1-49', 'counted');
check(t.frames === 5 && t.rows === 2 && t.inside && t.w.length === 1, 'Hard 1 + 49: rows of 3, full size, inside the board ' + JSON.stringify(t));

check(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V030 CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
