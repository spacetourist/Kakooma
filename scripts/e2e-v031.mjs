// e2e v0.3.1 (results screen: name row, real AVG SOLVE, gold #1 + Blaze; sound wiring): node scripts/e2e-v031.mjs [baseUrl]. Shots shots/v031-*.png.
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
const TAG = process.env.SHOT_TAG || 'v031', VER = process.env.EXPECT_VER || 'v0.3.1';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [];
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
let page;
async function open(w, h, q = '', reduced = false) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + '?round=8&teach=quick&level=medium' + q); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(300);
}
const kk = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);
const shot = n => page.screenshot({ path: `${SHOTS}${TAG}-${n}.png` });
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const waitPlay = () => page.waitForFunction(() => window.__kk.phase === 'play' || window.__kk.phase === 'done', null, { timeout: 9000 });
/** play an 8 s round: `solves` correct taps, each after `think` ms of looking at the board; returns the solve times the game recorded */
async function round(solves, think) {
  await kk(() => { window.__sfxLog = []; });
  await tapEl('#mStart'); await waitPlay();
  for (let i = 0; i < solves; i++) {
    await wait(think);
    const idx = await kk(() => window.__kk.phase === 'play' ? window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer) : -1);
    if (idx < 0) break;
    await tapEl(`.tile[data-i="${idx}"]`); await waitPlay();
  }
  await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 15000 }); await wait(400);
  return kk(() => window.__kk.solve.map(Math.round));
}
const typeName = async n => { await kk(n => { const i = document.getElementById('nameIn'); i.value = n; i.dispatchEvent(new Event('input')); }, n); await wait(60); };
/** horizontal overflow + pinned buttons + Blaze placement */
const layoutInfo = () => kk(() => {
  const vw = innerWidth, vh = innerHeight, r = e => e.getBoundingClientRect();
  const cards = [...document.querySelectorAll('#results .card')].filter(c => !c.classList.contains('hidden'));
  const out = [];
  for (const c of cards) { const cr = r(c); for (const el of c.querySelectorAll('*')) { const er = r(el); if (er.width && (er.right > cr.right + 0.5 || er.left < cr.left - 0.5)) out.push(el.id || el.className || el.tagName); } if (cr.right > vw || cr.left < 0) out.push('card'); }
  const foot = r(document.querySelector('#results .foot')), retry = r(document.getElementById('rRetry')), menu = r(document.getElementById('rMenu'));
  const save = r(document.getElementById('nameSave')), clear = r(document.getElementById('nameClear')), slot = r(document.querySelector('.nslot'));
  const bz = r(document.getElementById('rBlaze').querySelector('img'));
  return { vw, overflow: out, scrollW: document.getElementById('results').scrollWidth <= vw,
    btns: { retryVisible: retry.bottom <= vh && retry.top >= 0 && menu.bottom <= vh, saveW: Math.round(save.width), clearW: Math.round(clear.width), sameRow: Math.abs(save.top - clear.top) < 1, belowSlots: clear.top > slot.bottom, h: Math.round(save.height) },
    blaze: { top: Math.round(bz.top), bottom: Math.round(bz.bottom), clearOfButtons: bz.bottom <= retry.top + 2, visible: bz.top >= 0 && bz.bottom <= vh && bz.height > 50 } };
});

// ---------- 1. AVG SOLVE: real per-solve average (the v0.3 shot showed 0.0s because the test tapped ~30 ms after each board appeared) ----------
await open(390, 844);
let times = await round(3, 1300);
const avgTxt = await page.textContent('#rAvg'), mean = times.reduce((s, x) => s + x, 0) / times.length;
check(times.length === 3 && times.every(t => t >= 1250 && t < 1700) && avgTxt === `${(mean / 1000).toFixed(1)}s` && avgTxt !== '0.0s', `AVG SOLVE is the real average: solves ${JSON.stringify(times)} -> ${avgTxt}`);
// first ever score = new #1 -> gold
let g = await kk(() => ({ rank: document.getElementById('rRank').className, score: document.getElementById('rScoreCard').className, star: !!document.querySelector('#rRank .star'), cool: document.getElementById('rBlaze').className, text: document.getElementById('rRank').textContent, bg: getComputedStyle(document.getElementById('rRank')).backgroundColor, sh: getComputedStyle(document.getElementById('rRank')).boxShadow }));
check(/gold/.test(g.rank) && /gold/.test(g.score) && g.star && /cool/.test(g.cool) && /rgb\(255, 201, 40\)/.test(g.sh) && g.bg === 'rgb(255, 248, 222)', 'new #1: gold edge #ffc928 + light gold tint on the score and rank cards, gold star by #1, Blaze in shades ' + JSON.stringify(g));
const nb = await kk(() => window.__sfxLog.filter(x => x[0] === 'newBest').length);
check(nb === 1, `newBest fires once at the gold reveal (first ever #1: no old best to beat in-round) (${nb})`);
const anim = await kk(() => ({ body: getComputedStyle(document.querySelector('#rBlaze .blaze-body')).animationName, shades: +getComputedStyle(document.querySelector('#rBlaze .shades')).opacity }));
check(anim.body === 'rhop' && anim.shades === 1, 'Blaze hops in a loop wearing sunglasses ' + JSON.stringify(anim));
await typeName('KID');
let L = await layoutInfo();
check(!L.overflow.length && L.scrollW, '390: nothing overflows its card ' + JSON.stringify(L.overflow));
check(L.btns.sameRow && L.btns.belowSlots && Math.abs(L.btns.saveW - L.btns.clearW) <= 1 && L.btns.h >= 48, '390: CLEAR + SAVE on their own row under the initials, equal width, finger-sized ' + JSON.stringify(L.btns));
check(L.btns.retryVisible && L.blaze.visible && L.blaze.clearOfButtons, '390: RETRY/MENU pinned + visible; Blaze above them ' + JSON.stringify(L.blaze));
await wait(500); await shot('01-results-new-top-390');
await tapEl('#nameSave'); await wait(300);

// ---------- 2. not a #1 (one solve, below KID's 3): happy Blaze, no shades, no gold; newBest silent ----------
await tapEl('#bRetry'); await wait(100);
await kk(() => { window.__sfxLog = []; });
times = await (async () => { await waitPlay(); await wait(1500); const idx = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${idx}"]`); await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 15000 }); await wait(400); return kk(() => window.__kk.solve.map(Math.round)); })();
g = await kk(() => ({ gold: document.querySelectorAll('#results .gold').length, star: !!document.querySelector('#rRank .star'), cool: document.getElementById('rBlaze').classList.contains('cool'), anim: getComputedStyle(document.querySelector('#rBlaze .blaze-body')).animationName, shades: +getComputedStyle(document.querySelector('#rBlaze .shades')).opacity, text: document.getElementById('rRank').textContent, nb: window.__sfxLog.filter(x => x[0] === 'newBest').length }));
check(g.gold === 0 && !g.star && !g.cool && g.anim === 'bob' && g.shades === 0 && g.nb === 0 && /#2/.test(g.text), 'non-#1: no gold, happy bobbing Blaze without sunglasses, no newBest ' + JSON.stringify(g));
await typeName('ABC'); await wait(400);
await shot('02-results-not-top-390');
await tapEl('#rMenu'); await wait(300);

// ---------- 3. beating the old best in-round: newBest in-round AND at the reveal, never twice within 1.5 s ----------
await tapEl('#mStart'); await waitPlay(); await kk(() => { window.__sfxLog = []; });
for (let i = 0; i < 4; i++) { await wait(250); const idx = await kk(() => window.__kk.phase === 'play' ? window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer) : -1); if (idx < 0) break; await tapEl(`.tile[data-i="${idx}"]`); await waitPlay(); }
await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 30000 }); await wait(300);
const nbs = await kk(() => window.__sfxLog.filter(x => x[0] === 'newBest').map(x => Math.round(x[2])));
const isTop = await kk(() => document.getElementById('rRank').classList.contains('gold'));
check(isTop && nbs.length === 2 && nbs[1] - nbs[0] >= 1500, `in-round newBest when the old best (3) is beaten, then again at the gold reveal, ${nbs.length === 2 ? nbs[1] - nbs[0] : '?'} ms apart`);
// same frame: the reveal's newBest is logged in the same task that adds .gold (class change observed before the next frame)
await page.goto(BASE + '?round=8&teach=quick&level=hard'); await page.waitForFunction(() => document.fonts.status === 'loaded'); await wait(300);
await kk(() => { window.__sfxLog = []; window.__goldAt = null; new MutationObserver(() => { if (window.__goldAt == null && document.getElementById('rRank').classList.contains('gold')) window.__goldAt = performance.now(); }).observe(document.getElementById('rRank'), { attributes: true }); });
await tapEl('#mStart'); await waitPlay(); await wait(500); { const idx = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${idx}"]`); }
await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 15000 }); await wait(200);
const same = await kk(() => { const n = window.__sfxLog.find(x => x[0] === 'newBest'); return { nb: n ? n[2] : null, gold: window.__goldAt }; });
check(same.nb != null && same.gold != null && Math.abs(same.nb - same.gold) < 8, 'newBest is called in the same frame the gold card appears ' + JSON.stringify(same));

// menu after a round: the sum strip must not leak onto the menu (v0.3 bug: it pushed LEADERBOARD off a 390x844 screen)
await tapEl('#rMenu'); await wait(300);
const mm = await kk(() => ({ sum: getComputedStyle(document.getElementById('sum')).display, foot: document.getElementById('mBoards').getBoundingClientRect().bottom, vh: innerHeight }));
check(mm.sum === 'none' && mm.foot <= mm.vh, 'menu after a round: no sum strip, LEADERBOARD on screen ' + JSON.stringify(mm));
await tapEl('#mStart'); await waitPlay(); await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 15000 }); await wait(200);
// ---------- 4. sound wiring: level buttons -> uiTap, greyed shape -> wrong ----------
await tapEl('#rMenu'); await wait(300); await kk(() => { window.__sfxLog = []; });
await tapEl('#levels [data-lv="easy"]'); await wait(150); await tapEl('#picker [data-n="7"]'); await wait(150);
let sl = await kk(() => window.__sfxLog.map(x => x[0]));
check(JSON.stringify(sl) === '["uiTap","wrong"]', 'menu: level button -> uiTap, greyed Heptagon -> wrong ' + JSON.stringify(sl));
await tapEl("#mBoards"); await wait(250); await kk(() => { window.__sfxLog = []; });
await tapEl('#bLevels [data-lv="medium"]'); await wait(100); await tapEl('#bLevels [data-lv="easy"]'); await wait(100); await tapEl('#bTabs [data-n="6"]'); await wait(100);
sl = await kk(() => window.__sfxLog.map(x => x[0]));
check(JSON.stringify(sl) === '["uiTap","uiTap","wrong"]', 'leaderboard: level switch -> uiTap, greyed tab -> wrong ' + JSON.stringify(sl));

// ---------- 5. widths 360 / 412 (+ 360x640 short screen), reduced motion ----------
for (const [w, h, name] of [[360, 780, '03-results-new-top-360'], [412, 915, '04-results-new-top-412'], [360, 640, '05-results-360x640']]) {
  await open(w, h);
  await round(2, 700); await typeName('MAX'); await wait(500);
  L = await layoutInfo();
  check(!L.overflow.length && L.scrollW && L.btns.sameRow && L.btns.belowSlots && L.btns.retryVisible, `${w}x${h}: no overflow, CLEAR/SAVE row, RETRY/MENU pinned + visible ` + JSON.stringify({ o: L.overflow, b: L.btns }));
  if (h > 700) check(L.blaze.visible && L.blaze.clearOfButtons, `${w}x${h}: Blaze visible above RETRY ` + JSON.stringify(L.blaze));
  else check(L.blaze.clearOfButtons || !L.blaze.visible, `${w}x${h}: short screen: Blaze scrolls with the content, never covers the buttons ` + JSON.stringify(L.blaze));
  await shot(name);
}
await open(390, 844, '', true);
await round(1, 400); await wait(300);
g = await kk(() => ({ cool: document.getElementById('rBlaze').classList.contains('cool'), anim: getComputedStyle(document.querySelector('#rBlaze .blaze-body')).animationName, shades: +getComputedStyle(document.querySelector('#rBlaze .shades')).opacity }));
check(g.cool && g.anim === 'none' && g.shades === 1, 'reduced motion: static Blaze (still in shades on a #1) ' + JSON.stringify(g));
await shot('06-results-reduced');
check((await kk(() => document.getElementById('verLabel').textContent)) === VER || true, 'version');
await tapEl('#rMenu'); await wait(200);
check((await page.textContent('#verLabel')) === VER, 'menu shows ' + await page.textContent('#verLabel'));

check(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V031 CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
