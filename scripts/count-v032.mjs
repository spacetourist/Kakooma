// v0.3.2 counting stage: node scripts/count-v032.mjs [baseUrl]. Per level: lesson length + hook timings for 3+7, 7+12, 24+26,
// +1-per-dot check, Easy timeline shots every 300 ms, a Hard frame, reduced motion, skip mid-count.
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
const TAG = process.env.SHOT_TAG || 'v032', ONLY = process.env.ONLY;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [], out = {};
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
let page;
async function open(level, n, reduced = false) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + `?round=600&teach=full&level=${level}` + (reduced ? '&reduced' : '')); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(300);
  await tapEl(`#picker [data-n="${n}"]`); await page.waitForTimeout(300);
}
const kk = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const SUMS = { '3+7': [3, 7, [3, 7, 10, 1, 9]], '7+12': [7, 12, [7, 12, 19, 4, 2]], '24+26': [24, 26, [24, 26, 50, 1, 3]] };
/** start a round on puzzle P (twice queued), tap the answer at t=0; returns tap time (performance.now) */
async function lesson(P) {
  await kk(p => { window.__kkNext = [p, p]; }, P);
  await tapEl('#mStart'); await page.waitForFunction(() => window.__kk.phase === 'play'); await wait(300);
  await kk(() => { window.__sfxLog = []; window.__kkCount = []; window.__stages = []; window.__green = null; new MutationObserver(() => { const e = document.querySelector('#fx .bnode.whole'); if (e && window.__green == null && !e.classList.contains('counting')) window.__green = performance.now(); }).observe(document.getElementById('fx'), { subtree: true, attributes: true, attributeFilter: ['class'] }); let last = ''; const poll = () => { const g = window.__kk.teachStage; if (g !== last) { window.__stages.push([g, performance.now()]); last = g; } if (window.__kk.phase !== 'menu') requestAnimationFrame(poll); }; requestAnimationFrame(poll); });
  const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
  const bb = await page.locator(`.tile[data-i="${i}"]`).boundingBox();
  const tap = await kk(() => performance.now());
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  return tap;
}
const LV = ONLY ? [ONLY] : ['easy', 'medium', 'hard'];
for (const lv of LV) for (const [name, [a, b, nums]] of Object.entries(SUMS)) {
  if (lv === 'easy' && a + b > 10) continue;
  if (lv === 'medium' && a + b > 20) continue;
  const c = a + b;
  await open(lv, 5);
  const tap = await lesson({ nums, a, b, answer: c });
  // timeline shots for Easy 3 + 7, one Hard frame mid-count for 24 + 26
  if (lv === 'easy' && name === '3+7') { for (let t = 300; t <= 4200; t += 300) { const now = await kk(() => performance.now()); if (now - tap < t) await wait(t - (now - tap)); await page.screenshot({ path: `${SHOTS}${TAG}-easy-3-7-t${String(t).padStart(4, '0')}.png` }); } }
  if (lv === 'hard' && name === '24+26') { await page.waitForFunction(() => (window.__kkCount || []).length >= 32); await page.screenshot({ path: `${SHOTS}${TAG}-hard-24-26-count.png` }); }
  if (lv === 'medium' && name === '7+12') { await page.waitForFunction(() => (window.__kkCount || []).length >= 12); await page.screenshot({ path: `${SHOTS}${TAG}-medium-7-12-count.png` }); }
  await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 20000 });
  const end = await kk(() => performance.now());
  const r = await kk(() => ({ green: window.__green, cnt: window.__kkCount, sfx: window.__sfxLog.map(([n, a, t]) => [n + (a.length ? `(${a.join()})` : ''), t]), stages: window.__stages }));
  const rel = t => Math.round(t - tap);
  const seq = r.cnt.map(x => x[0]);
  const frames = r.cnt.map(x => x[1]); const gaps = frames.slice(1).map((t, i) => t - frames[i]);
  const counts = r.sfx.filter(x => x[0].startsWith('count'));
  check(JSON.stringify(seq) === JSON.stringify(Array.from({ length: c }, (_, i) => i + 1)) && gaps.every(g => g >= 8), `${lv} ${name}: counter 1..${c}, +1 per dot, each on its own frame (min gap ${Math.min(...gaps)} ms)`);
  check(counts.length === c && counts.every((x, i) => x[0] === `count(${i})`), `${lv} ${name}: count(i) fires once per landing, i = running total 0..${c - 1}`);
  { // staggered group ends (first occurrences = the counting stage; the bond stage fires partPop/bond again later)
    const first = n => r.sfx.find(x => x[0] === n)?.[1];
    const d0 = first('partPop(0)') - first(`count(${a - 1})`), d1 = first('partPop(1)') - first(`count(${c - 1})`), d2 = first('bond') - first('partPop(1)');
    check(Math.abs(d0 - 150) <= 20 && Math.abs(d1 - 150) <= 20 && Math.abs(d2 - 400) <= 20, `${lv} ${name}: partPop(0) ${Math.round(d0)} ms after the last light dot, partPop(1) ${Math.round(d1)} ms after the last dark dot, bond ${Math.round(d2)} ms after that`);
    check(Math.abs(r.green - first('bond')) < 1, `${lv} ${name}: the tile turns green in the same frame as bond()`);
  }
  const countMs = frames[c - 1] - frames[0];
  const med = [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length / 2)]; // per dot, not counting the beat between the parts
  const lessonMs = rel(end);
  out[`${lv} ${name}`] = { lessonMs, countStageMs: Math.round(frames[c - 1]) , msPerDot: Math.round(med), hooks: r.sfx.filter(x => !x[0].startsWith('count') || /count\((0|\d+)\)/.test(x[0])).map(([n, t]) => [n, rel(t)]), stages: r.stages.map(([g, t]) => [g, rel(t)]) };
  if (lv === 'easy') check(Math.abs(med - 300) <= 20, `easy ${name}: ~300 ms per dot (median ${Math.round(med)})`);
  if (lv === 'medium') check(Math.abs(med - 150) <= 12, `medium ${name}: ~150 ms per dot (median ${Math.round(med)})`);
  if (lv === 'hard') check(med <= 84 && countMs <= 3100, `hard ${name}: median ${Math.round(med)} ms per dot, count stage ${countMs} ms`);
  await tapEl('#gQuit'); await wait(200);
}
// reduced motion: same pace, no flying (dots appear in place)
if (!ONLY) {
  await open('easy', 4, true);
  const tap = await lesson({ nums: [3, 7, 10, 1], a: 3, b: 7, answer: 10 });
  await page.waitForFunction(() => (window.__kkCount || []).length >= 4);
  const tf = await kk(() => [...document.querySelectorAll('#fx .ctr')].map(e => getComputedStyle(e).transform));
  await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 20000 });
  const cnt = await kk(() => window.__kkCount);
  const per = (cnt[9][1] - cnt[0][1]) / 9;
  check(cnt.length === 10 && Math.abs(per - 300) <= 25, `reduced: counter still steps every ~300 ms (${Math.round(per)})`);
  out['reduced easy 3+7'] = { lessonMs: Math.round((await kk(() => performance.now())) - tap) };
  // skip mid-count: instant, stopAll
  await open('easy', 4);
  await lesson({ nums: [3, 7, 10, 1], a: 3, b: 7, answer: 10 });
  await page.waitForFunction(() => (window.__kkCount || []).length >= 3);
  const t1 = await kk(() => performance.now()); await page.touchscreen.tap(195, 600);
  await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 2000 });
  const sk = await kk(() => ({ ms: performance.now(), fx: document.querySelectorAll('#fx > *').length, stop: window.__sfxLog.some(x => x[0] === 'stopAll'), running: window.__kk.running }));
  const n0 = await kk(() => window.__kkCount.length); await wait(400); const n1 = await kk(() => window.__kkCount.length);
  check(sk.ms - t1 < 300 && sk.fx === 0 && sk.stop && sk.running && n1 === n0, `skip mid-count: next board in ${Math.round(sk.ms - t1)} ms, overlay gone, stopAll, timer running, counting stopped`);
}
writeFileSync(`${SHOTS}${TAG}-count.json`, JSON.stringify(out, null, 1));
check(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
for (const [k, v] of Object.entries(out)) console.log(k, 'lesson', v.lessonMs, 'ms', v.msPerDot ? `${v.msPerDot} ms/dot` : '');
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V032 COUNT CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
