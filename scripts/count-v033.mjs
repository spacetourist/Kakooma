// v0.3.3 count + make-ten stage: node scripts/count-v033.mjs [baseUrl]. Per level: lesson length + hook timings for 3+7, 7+12, 24+26,
// +1-per-dot, continuous fill, the in-count make-ten flash/caption, source badges (v0.3.3.1), total() stagger, reduced motion, skip mid-count.
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
const TAG = process.env.SHOT_TAG || 'v033', ONLY = process.env.ONLY;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const errs = [], fails = [], log = [], out = {};
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
let page;
let VP = { width: 390, height: 844 };
async function open(level, n, reduced = false) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: VP, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  await kk(() => { window.__sfxLog = []; window.__kkCount = []; window.__stages = []; window.__green = null; window.__empty = []; new MutationObserver(() => { const e = document.querySelector('#fx .bnode.whole'); if (e && window.__green == null && !e.classList.contains('counting')) window.__green = performance.now(); window.__empty = window.__empty || []; document.querySelectorAll('#fx .srcb.drained').forEach((b, i) => { const k = b.classList.contains('p0') ? 0 : 1; if (window.__empty[k] == null) window.__empty[k] = performance.now(); }); }).observe(document.getElementById('fx'), { subtree: true, attributes: true, attributeFilter: ['class'] }); let last = ''; const poll = () => { const g = window.__kk.teachStage; if (g !== last) { window.__stages.push([g, performance.now()]); last = g; } if (window.__kk.phase !== 'menu') requestAnimationFrame(poll); }; requestAnimationFrame(poll); });
  const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
  const bb = await page.locator(`.tile[data-i="${i}"]`).boundingBox();
  const tap = await kk(() => performance.now());
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  return tap;
}
const LV = ONLY ? [ONLY] : ['easy', 'medium', 'hard'];
async function runOne(lv, name, a, b, nums) {
  if (lv === 'easy' && a + b > 10) return;
  if (lv === 'medium' && a + b > 20) return;
  const c = a + b;
  await open(lv, 5);
  const tap = await lesson({ nums, a, b, answer: c });
  const cntAt = n => page.waitForFunction(n => (window.__kkCount || []).length >= n, n, { timeout: 15000 });
  const mid = Math.max(2, Math.round(c * 0.6));
  const midShot = async () => {
    await cntAt(mid); await page.screenshot({ path: `${SHOTS}${TAG}-sources-${lv}-${a}-${b}${VP.width === 390 ? '' : '-' + VP.width}.png` });
    const m = await kk(() => { const box = (l, t, w, h) => ({ l, r: l + w, t, b: t + h, cx: l + w / 2, cy: t + h / 2, w }); const R = e => box(e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight); // layout boxes (no pop/pulse transforms)
      const sb = [...document.querySelectorAll('#fx .srcb')], ans = document.querySelector('#fx .bnode.whole'), cap = document.querySelector('#fx .mk10'), hint = document.querySelector('#fx .skiphint'), board = document.getElementById('board');
      return { n: sb.length, sb: sb.map(R), fill: sb.map(e => [getComputedStyle(e.querySelector('.fill')).backgroundColor, getComputedStyle(e.querySelector('.fill')).clipPath, getComputedStyle(e.querySelector('.fill b')).color, +getComputedStyle(e).opacity]),
        ans: (([x, y, d]) => box(x - d / 2, y - d / 2, d, d))(ans.dataset.rest.split(',').map(Number)), frames: [...document.querySelectorAll('#fx .tf')].map(R), cap: +getComputedStyle(cap).opacity > 0.05 ? R(cap) : null, hint: R(hint), board: box(0, 0, document.getElementById('fx').clientWidth, document.getElementById('fx').clientHeight), key: document.querySelectorAll('#fx .pkey').length }; });
    const ov = (p, q) => p.l < q.r - 0.5 && q.l < p.r - 0.5 && p.t < q.b - 0.5 && q.t < p.b - 0.5;
    const [L, Rr] = m.sb, A = m.ans, others = [...m.frames, ...(m.cap ? [m.cap] : []), m.hint];
    const row = m.n === 2 && Math.abs(L.cy - A.cy) < 3 && Math.abs(Rr.cy - A.cy) < 3 && L.r <= A.l && A.r <= Rr.l && Math.abs((A.l - L.r) - (Rr.l - A.r)) < 2;
    const noOv = [L, Rr, A].every(x => others.every(o => !ov(x, o))) && !ov(L, A) && !ov(Rr, A) && [L, Rr, A, ...m.frames].every(x => x.l >= m.board.l - 1 && x.r <= m.board.r + 1);
    check(row && noOv && m.key === 0, `${lv} ${name} @${VP.width}px: one row [${Math.round(L.w)}] ${Math.round(A.l - L.r)} [${Math.round(A.w)}] ${Math.round(Rr.l - A.r)} [${Math.round(Rr.w)}] under the frames, nothing overlaps, no colour key`);
    check(m.fill[0][0] === 'rgb(156, 192, 255)' && m.fill[1][0] === 'rgb(58, 123, 255)' && m.fill.every(f => f[2] === 'rgb(255, 255, 255)' && f[3] > 0.95) && m.fill.some(f => /inset\([1-9]/.test(f[1])), `${lv} ${name}: sources #9cc0ff / #3a7bff with white numbers, draining mid-count ${JSON.stringify(m.fill.map(f => f[1]))}`);
  };
  const tenN = Math.ceil(a / 10) * 10 <= c && a % 10 ? Math.ceil(a / 10) * 10 : 10;
  if (c < 10 || mid <= tenN) await midShot();
  if (c >= 10) { // the make-ten / first ten
    const ten = tenN;
    await cntAt(ten); await wait(220);
    const f = await kk(() => { const cap = document.querySelector('#fx .mk10'), ans = document.querySelector('#fx .bnode.whole'); return { cap: cap.textContent, capOp: +getComputedStyle(cap).opacity, flash: ans.classList.contains('flash'), ring: getComputedStyle(ans).boxShadow, txt: ans.textContent, tens: document.querySelectorAll('#fx .tf.ten').length, capTop: Math.round(cap.getBoundingClientRect().top), capBot: Math.round(cap.getBoundingClientRect().bottom), fBot: Math.round(Math.max(...[...document.querySelectorAll('#fx .tf')].map(e => e.getBoundingClientRect().bottom))), ansTop: Math.round(ans.getBoundingClientRect().top) }; });
    check(f.capTop >= f.fBot && f.capBot <= f.ansTop + 2, `${lv} ${name}: the make-ten caption sits between the frames and the counter (${f.fBot} <= ${f.capTop}..${f.capBot} <= ${f.ansTop})`);
    const want = a % 10 ? `${a} + ${ten - a} = ${ten}` : '';
    check(f.cap === want && (want ? f.capOp > 0.9 : true) && f.flash && /34, 197, 94/.test(f.ring) && f.tens >= 1, `${lv} ${name}: at ${ten} the frame rings, the counter flashes a green ring and the caption reads "${f.cap}" (${JSON.stringify(f)})`);
    if (lv === 'medium' && name === '7+12') await page.screenshot({ path: `${SHOTS}${TAG}-medium-7-12-ten-flash.png` });
    if (mid > ten) await midShot();
  }
  await page.waitForFunction(() => window.__kk.teachStage === 'counted', null, { timeout: 15000 }); await wait(120);
  const g = await kk(() => ({ frames: [...document.querySelectorAll('#fx .tf')].map(f => f.classList.contains('ten')), src: [...document.querySelectorAll('#fx .srcb')].map(e => [e.querySelector('b').textContent, e.classList.contains('drained'), getComputedStyle(e).color, Math.round(e.getBoundingClientRect().width), getComputedStyle(e).boxShadow]), sum: document.getElementById('sum').textContent.replace(/\s/g, '') }));
  check(g.frames.length === Math.ceil(c / 10) && g.frames.filter(Boolean).length === Math.floor(c / 10), `${lv} ${name}: continuous fill: ${g.frames.length} frame(s), ${g.frames.filter(Boolean).length} full and ringed`);
  check(g.src.length === 2 && g.src[0][0] === String(a) && g.src[1][0] === String(b) && g.src.every(x => x[1] && /inset/.test(x[4])) && g.src[0][2] === 'rgb(82, 135, 234)' && g.src[1][2] === 'rgb(58, 123, 255)' && g.sum === `${a}+${b}=${c}`, `${lv} ${name}: both sources emptied into coloured outlines ${JSON.stringify(g.src.map(x => x.slice(0, 4)))}, strip "${g.sum}"`);
  if (lv === 'hard' && name === '24+26') await page.screenshot({ path: `${SHOTS}${TAG}-hard-24-26-five-frames.png` });
  await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 20000 });
  const end = await kk(() => performance.now());
  const r = await kk(() => ({ empty: window.__empty, green: window.__green, cnt: window.__kkCount, sfx: window.__sfxLog.map(([n, a, t]) => [n + (a.length ? `(${a.join()})` : ''), t]), stages: window.__stages }));
  const rel = t => Math.round(t - tap);
  const seq = r.cnt.map(x => x[0]);
  const frames = r.cnt.map(x => x[1]); const gaps = frames.slice(1).map((t, i) => t - frames[i]);
  const counts = r.sfx.filter(x => x[0].startsWith('count'));
  check(JSON.stringify(seq) === JSON.stringify(Array.from({ length: c }, (_, i) => i + 1)) && gaps.every(g => g >= 8), `${lv} ${name}: counter 1..${c}, +1 per dot, each on its own frame (min gap ${Math.min(...gaps)} ms)`);
  check(counts.length === c && counts.every((x, i) => x[0] === `count(${i})`), `${lv} ${name}: count(i) fires once per landing, i = running total 0..${c - 1}`);
  { // staggered group ends (first occurrences = the counting stage; the bond stage fires partPop/bond again later)
    const first = n => r.sfx.find(x => x[0] === n)?.[1];
    const d0 = first('partPop(0)') - first(`count(${a - 1})`), d1 = first('partPop(1)') - first(`count(${c - 1})`), d2 = first('total') - first('partPop(1)');
    check(Math.abs(d0 - 150) <= 20 && Math.abs(d1 - 150) <= 20 && Math.abs(d2 - 150) <= 20, `${lv} ${name}: partPop(0) ${Math.round(d0)} ms after the last light dot, partPop(1) ${Math.round(d1)} ms after the last dark dot, total ${Math.round(d2)} ms after that`);
    check(r.empty.length === 2 && Math.abs(r.empty[0] - first('partPop(0)')) < 1 && Math.abs(r.empty[1] - first('partPop(1)')) < 1, `${lv} ${name}: each source pops empty in the same frame as its partPop`);
    check(Math.abs(r.green - first('total')) < 1, `${lv} ${name}: the tile turns green in the same frame as total()`);
    const names = r.sfx.map(x => x[0]);
    check(!names.includes('makeTen') && !names.includes('hop') && names.filter(n => n === 'total').length === 1 && names.filter(n => n === 'bond').length === 1 && first('bond') > first('total'), `${lv} ${name}: no makeTen/hop in the lesson; total() once; bond() once, in the bond stage`);
    if (c > 10 && a % 10) { const T = Math.ceil(a / 10) * 10; if (T < c) { const hold = frames[T] - frames[T - 1]; check(hold >= 600 && hold <= 600 + (lv === 'easy' ? 300 : 150) + 120, `${lv} ${name}: the count holds on ${T} (${hold} ms to the next dot)`); } }
  }
  const countMs = frames[c - 1] - frames[0];
  const med = [...gaps].filter(x => x < 500).sort((x, y) => x - y)[Math.floor(gaps.length / 2)]; // per dot, not counting the beat between the parts
  const lessonMs = rel(end);
  out[`${lv} ${name}`] = { lessonMs, countStageMs: Math.round(frames[c - 1]) , msPerDot: Math.round(med), hooks: r.sfx.filter(x => !x[0].startsWith('count') || /count\((0|\d+)\)/.test(x[0])).map(([n, t]) => [n, rel(t)]), stages: r.stages.map(([g, t]) => [g, rel(t)]) };
  if (lv === 'easy') check(Math.abs(med - 300) <= 20, `easy ${name}: ~300 ms per dot (median ${Math.round(med)})`);
  if (lv === 'medium') check(Math.abs(med - 150) <= 12, `medium ${name}: ~150 ms per dot (median ${Math.round(med)})`);
  if (lv === 'hard') check(med <= 84 && countMs <= 3100 + 700, `hard ${name}: median ${Math.round(med)} ms per dot, count stage ${countMs} ms`);
  await tapEl('#gQuit'); await wait(200);
}
for (const lv of LV) for (const [name, [a, b, nums]] of Object.entries(SUMS)) await runOne(lv, name, a, b, nums);
// v0.3.3.1: Hard 24 + 26 (five frames) at 360 px: the source row still fits and nothing overlaps
if (!ONLY || ONLY === 'hard') { VP = { width: 360, height: 780 }; const keep = { ...out }; await runOne('hard', '24+26', ...SUMS['24+26']); Object.assign(out, keep); VP = { width: 390, height: 844 }; }
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
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V033 COUNT CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
