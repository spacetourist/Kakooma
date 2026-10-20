// e2e v0.2.1+ (default expects v0.3, shots v030r021-*; boots on ?level=hard; EXPECT_VER / SHOT_TAG override): node scripts/e2e-v021.mjs [baseUrl]. GD review fixes: ~3 s solve, full-size ten-frames in rows, hoppers leave + keep colour, wrong caption in the sum strip, Bond Lab slider/ten-frames/quiz label. Plus all v0.2 checks. Teaching solve stages, timer pause, skip, chip replay, wrong caption, Bond Lab, reduced motion, FPS @4x CPU.
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
let page = await browser.newPage(ctxOpts);
const errs = [], fails = [], log = [], perf = {};
const watch = pg => { pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); };
watch(page);
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
const TAG = process.env.SHOT_TAG || 'v030r021', VER = process.env.EXPECT_VER || 'v0.3';
const shot = n => page.screenshot({ path: `${SHOTS}${TAG}-${n}.png` });
const kk = (f, a) => page.evaluate(f, a);
const wait = ms => page.waitForTimeout(ms);
async function tapEl(sel) { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
const tapTile = i => tapEl(`.tile[data-i="${i}"]`);
const answerIdx = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
const wrongIdx = () => kk(() => { const p = window.__kk.puzzle, a = p.nums.indexOf(p.answer); return a === 0 ? 1 : 0; });
const waitPlay = (t = 9000) => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: t });
const stage = (g, t = 6000) => page.waitForFunction(g => window.__kk.teachStage === g, g, { timeout: t });
const queue = list => kk(l => { window.__kkNext = l; }, list);
const P = (nums, a, b) => ({ nums, a, b, answer: a + b });
const clock = () => kk(() => ({ rem: window.__kk.left - (window.__kk.running ? performance.now() - window.__kk.since : 0), left: window.__kk.left, running: window.__kk.running, phase: window.__kk.phase, stage: window.__kk.teachStage }));
const caps = () => kk(() => [...document.querySelectorAll('#fx .tcap')].map(e => e.textContent));
const tapAnywhere = () => page.touchscreen.tap(206, 640);
// where every counter sits now: index of the ten-frame whose rect holds its centre (-1 = none)
const frameCounts = () => kk(() => { const fs = [...document.querySelectorAll('#fx .tf')].map(f => f.getBoundingClientRect()); const n = fs.map(() => ({ p0: 0, p1: 0 }));
  for (const c of document.querySelectorAll('#fx .ctr')) { const r = c.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2; const i = fs.findIndex(f => x >= f.left && x <= f.right && y >= f.top && y <= f.bottom); if (i >= 0) n[i][c.classList.contains('p0') ? 'p0' : 'p1']++; }
  return { n, w: fs.map(f => Math.round(f.width)), top: fs.map(f => Math.round(f.top)), mini: document.querySelectorAll('#fx .tf.mini').length }; });

async function boot(url) {
  await page.goto(url); await kk(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
}
await boot(BASE + '?level=hard&round=60');
check((await page.textContent('#verLabel')) === VER, 'menu shows ' + await page.textContent('#verLabel'));
check(await page.isVisible('#mLab'), 'menu has Bond Lab button');
const mfoot = await kk(() => document.getElementById('mBoards').getBoundingClientRect().bottom);
check(mfoot <= 915, `menu buttons fit on screen (bottom ${Math.round(mfoot)})`);
await tapEl('#picker [data-n="5"]'); await wait(400); await shot('01-menu');

// ---------- full solve: 7 + 12 = 19 (crosses ten) ----------
await queue([P([7, 9, 12, 19, 4], 7, 12), P([2, 5, 7, 13, 16], 2, 5), P([6, 14, 20, 3, 33], 6, 14)]);
await tapEl('#mStart'); await waitPlay(); await wait(350);
const before = await clock();
const tapLat = await kk(() => new Promise(res => { // tap handler cost (pointerdown -> state + classes)
  const t = document.querySelector('.tile[data-i="3"]'), r = t.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: r.x + 40, clientY: r.y + 40 };
  const t0 = performance.now(); t.dispatchEvent(new PointerEvent('pointerdown', o)); const ms = performance.now() - t0;
  res({ ms, ok: t.classList.contains('ok'), phase: window.__kk.phase });
}));
check(tapLat.ok && tapLat.phase === 'feedback' && tapLat.ms < 16, `correct registers synchronously on pointerdown (${tapLat.ms.toFixed(2)} ms incl. teaching setup)`);
const tapAt = Date.now() - 5;
await wait(60); await shot('02-solve-1-tap');
const samples = [];
const sampler = setInterval(async () => { try { samples.push(await clock()); } catch {} }, 120);
await stage('fly'); await wait(380); await shot('03-solve-2-fly');
check((await kk(() => document.querySelectorAll('#fx .ctr').length)) === 19, '19 counters burst out (7 light + 12 blue)');
check((await kk(() => [document.querySelectorAll('#fx .ctr.p0').length, document.querySelectorAll('#fx .ctr.p1').length].join())) === '7,12', 'two shades: 7 light, 12 blue');
await stage('ten'); await wait(200); await shot('04-solve-3-maketen');
await stage('ten2'); await wait(300); await shot('05-solve-3b-maketen-captions');
const c1 = await caps(); check(c1.join('|') === '7 + 3 = 10|10 + 9 = 19', 'make-ten captions ' + c1.join(' / '));
const fc = await frameCounts();
check(fc.mini === 0 && fc.w.length === 3 && new Set(fc.w).size === 1 && new Set(fc.top).size === 1, `7 + 12: three full-size ten-frames in one row ${JSON.stringify({ w: fc.w, top: fc.top })}`);
check(JSON.stringify(fc.n) === JSON.stringify([{ p0: 7, p1: 3 }, { p0: 0, p1: 7 }, { p0: 0, p1: 2 }]), `hoppers left their frame and keep their colour: new ten = 7 light + 3 blue, source 7 blue, ones 2 blue ${JSON.stringify(fc.n)}`);
await stage('absorb');
const ansTop = () => kk(() => Math.round(document.querySelector('#fx > .bnode.whole').getBoundingClientRect().top));
const top0 = await ansTop(); await wait(100);
const mid = await kk(() => ({ op: Math.max(...[...document.querySelectorAll('#fx .tf, #fx .tcap:not(.bondcap)')].map(e => +getComputedStyle(e).opacity)) }));
const top1 = await ansTop();
check(mid.op > 0 && Math.abs(top1 - top0) <= 1, `handover: answer waits while the make-ten fades (opacity ${mid.op.toFixed(2)}, answer moved ${top1 - top0}px)`);
await stage('bond');
const fb = await kk(() => ({ op: Math.max(...[...document.querySelectorAll('#fx .tf, #fx .tcap:not(.bondcap), #fx .ctr')].map(e => +getComputedStyle(e).opacity)), lines: document.querySelectorAll('#fx .bondlines').length }));
check(fb.op < 0.01 && fb.lines === 1, 'frames, captions and counters fully faded (opacity 0) before the answer rises into the bond ' + JSON.stringify(fb));
await wait(150); await shot('06-solve-4-handover');
await stage('cheer');
const overBond = await kk(() => ({ confetti: document.querySelectorAll('#fx .confetti').length,
  lines: [...document.querySelectorAll('#fx .bondlines line')].map(l => Math.round(parseFloat(getComputedStyle(l).strokeDashoffset))),
  parts: [...document.querySelectorAll('#fx .bnode.p0, #fx .bnode.p1')].map(e => +(+getComputedStyle(e).opacity).toFixed(2)),
  cap: +(+getComputedStyle(document.querySelector('#fx .bondcap')).opacity).toFixed(2),
  hop: document.getElementById('blaze').getAnimations().length + document.getElementById('blazeBody').getAnimations().length }));
await wait(280); await shot('07-solve-5-bond-cheer');
check(overBond.confetti > 10 && overBond.lines.every(x => x === 0) && overBond.parts.every(x => x === 1) && overBond.cap >= 0.98 && overBond.hop > 0, 'confetti + Blaze hop fire once the bond and caption are complete ' + JSON.stringify(overBond));
await wait(1500);
const hold = await kk(() => ({ stage: window.__kk.teachStage, phase: window.__kk.phase, cap: +getComputedStyle(document.querySelector('#fx .bondcap')).opacity, newConfetti: document.querySelectorAll('#fx .confetti').length }));
check(hold.stage === 'cheer' && hold.phase === 'feedback' && hold.cap === 1, 'bond + caption still held 1.5 s after the caption lands ' + JSON.stringify(hold));
await stage('clear', 4000);
check((await kk(() => document.getElementById('sum').textContent)) === '?+?=?', 'clear: the bond fades and "? + ? = ?" comes back');
check((await kk(() => [...document.querySelectorAll('#fx .bnode')].map(e => e.textContent).join())) === '19,7,12', 'bond: whole 19 on top, parts 7 and 12');
check((await kk(() => document.querySelector('#fx .bondcap')?.textContent)) === '7 and 12 make 19', 'bond caption "7 and 12 make 19"');
const capCol = await kk(() => ({ p0: getComputedStyle(document.querySelector('#fx .bondcap .p0')).color, p1: getComputedStyle(document.querySelector('#fx .bondcap .p1')).color, ctr: getComputedStyle(document.documentElement).getPropertyValue('--lblue').trim() }));
check(capCol.p0 === 'rgb(82, 135, 234)' && capCol.p1 === 'rgb(58, 123, 255)' && capCol.ctr.toLowerCase() === '#9cc0ff', 'v0.2.3.2: caption smaller-part word is #5287ea, larger-part word stays #3a7bff, counters/tiles token stays #9cc0ff ' + JSON.stringify(capCol));
await waitPlay(); const teachTotal = Date.now() - tapAt; perf.fullSolveMs = teachTotal;
check(teachTotal > 7000 && teachTotal < 9500, `full lesson (v0.3.2 counting, Hard pace) is ~7.5-9 s (${teachTotal} ms incl. test round-trips)`);
clearInterval(sampler); await wait(150);
const during = samples.filter(s => s.phase === 'feedback');
check(during.length > 15 && during.every(s => !s.running && s.left === during[0].left) && Math.abs(during[0].left - before.rem) < 600, `timer paused for the whole teaching solve (${during.length} samples over ${teachTotal} ms, stayed at ${Math.round(during[0]?.left)} ms)`);
const after = await clock(); check(after.running && after.phase === 'play', 'timer resumes on the next board');

// ---------- full solve under ten: 2 + 5 = 7 ----------
await wait(300); await tapTile(await answerIdx());
await stage('sum'); await wait(250); await shot('08-under10-frame');
const c2 = await caps(); check(c2.join('|') === '2 + 5 = 7' && (await kk(() => document.querySelectorAll('#fx .tf').length)) === 1, 'under ten: one frame, caption "2 + 5 = 7"');
await stage('cheer'); await wait(250); await shot('09-under10-bond');
await waitPlay();

// ---------- skip ----------
await wait(300); await tapTile(await answerIdx()); await stage('fly'); await wait(300);
const sk = await clock(); check(sk.phase === 'feedback' && !sk.running, 'third solve is a full teaching solve');
await shot('10-skip-before');
await kk(() => { window.__sfxLog = []; });
const t0 = Date.now(); await tapAnywhere();
await waitPlay(2000); const skipMs = Date.now() - t0;
const sk2 = await kk(() => ({ fx: document.querySelectorAll('#fx .ctr, #fx .tf, #fx .bnode').length, dim: document.querySelectorAll('.tile.dim').length, skipper: document.getElementById('skipper').classList.contains('hidden'), running: window.__kk.running }));
check(skipMs < 400 && sk2.fx === 0 && sk2.dim === 0 && sk2.skipper && sk2.running, `tap to skip: next board live in ${skipMs} ms (incl. test round-trip), overlay cleared, timer running`);
check((await kk(() => window.__kk.score)) === 3, 'skip tap did not land on the new board');
check(await kk(() => window.__sfxLog.some(([n]) => n === 'stopAll')), 'tap-to-skip calls stopAll() (scheduled lesson sounds cut)');
await kk(() => { window.__sfxLog = null; });
await shot('11-skip-after');

// ---------- quick solve (4th) ----------
const tc = await kk(() => window.__kk.teachCount);
await wait(200); await tapTile(await answerIdx()); await wait(80);
const q = await kk(() => ({ tc: window.__kk.teachCount, phase: window.__kk.phase, sum: document.getElementById('sum').textContent, fx: document.querySelectorAll('#fx .ctr').length }));
check(q.tc === tc && q.phase === 'feedback' && /^\d+\+\d+=\d+$/.test(q.sum) && q.fx === 0, 'solve 4: quick bounce + sum strip (no teaching)');
await shot('12-quick-solve');
const qs = Date.now(); await waitPlay(); check(Date.now() - qs < 700, 'quick feedback stays ~500 ms');

// ---------- wrong tap caption, then correct => full ----------
await wait(200);
const wi = await wrongIdx(), wv = await kk(i => window.__kk.puzzle.nums[i], wi);
await tapTile(wi); await wait(250);
const wc = await kk(() => { const s = document.getElementById('sum'), r = s.getBoundingClientRect(); return { cap: s.classList.contains('wrong') ? s.textContent : null, old: document.querySelectorAll('.wcap').length, fits: s.scrollHeight <= s.clientHeight + 1 && Math.round(r.height) === 68, bad: document.querySelectorAll('.tile.bad').length, tilt: document.getElementById('blazeBody').getAnimations().length }; });
check(wc.cap === `${wv} can't be made from two of these` && wc.old === 0 && wc.fits && wc.bad === 1, 'wrong tap caption inside the sum strip: ' + JSON.stringify(wc));
check(wc.tilt > 0, 'Blaze tilts his head');
await shot('13-wrong-caption');
await wait(2000); const wcBack = await kk(() => document.getElementById('sum').className);
check(/\b(ph|hint)\b/.test(wcBack), 'caption clears after 2 s, strip back to ' + wcBack);
const tc2 = await kk(() => window.__kk.teachCount);
await tapTile(await answerIdx()); await wait(100);
check((await kk(() => window.__kk.teachCount)) === tc2 + 1 && (await kk(() => document.querySelectorAll('.tile.bad').length)) === 0, 'correct after a mistake plays the full solve, no coral left');
await stage('fly'); await tapAnywhere(); await waitPlay();

// ---------- streak milestone x5 => full ----------
for (let k = 0; k < 3; k++) { await wait(150); await tapTile(await answerIdx()); await waitPlay(); }
const tc3 = await kk(() => window.__kk.teachCount);
await wait(150); await tapTile(await answerIdx()); await wait(100);
const ms5 = await kk(() => ({ streak: window.__kk.streak, tc: window.__kk.teachCount }));
check(ms5.streak === 5 && ms5.tc === tc3 + 1, 'streak x5 milestone plays the full solve');
await stage('fly'); await tapAnywhere(); await waitPlay();

// ---------- chip replay ----------
await wait(300);
const live = await kk(() => window.__kk.puzzle.nums.join());
const cr = await kk(() => ({ cap: document.getElementById('trayCap').textContent, vis: getComputedStyle(document.getElementById('trayCap')).display !== 'none' }));
check(cr.cap === "Tap a bond to see how it's made" && cr.vis, 'tray caption "Tap a bond to see how it\'s made"');
const oldest = await kk(() => { const c = [...document.querySelectorAll('#tray .chip')].pop(); return c.textContent; });
check(oldest === '7 + 12 = 19', 'oldest chip is 7 + 12 = 19');
const leftBefore = (await clock()).rem;
await page.locator('#tray .chip').last().scrollIntoViewIfNeeded();
await tapEl('#tray .chip >> nth=-1'); await wait(80);
const rp = await kk(() => ({ phase: window.__kk.phase, nums: window.__kk.puzzle.nums.join(), running: window.__kk.running }));
check(rp.phase === 'replay' && rp.nums === '7,9,12,19,4' && !rp.running, 'chip replay: board shows 7 + 12 = 19, timer paused');
await stage('ten2', 8000); await wait(250); await shot('14-chip-replay');
check((await caps()).join('|') === '7 + 3 = 10|10 + 9 = 19', 'replay shows the make-ten captions');
await stage('cheer', 8000); await wait(200); await shot('15-chip-replay-bond');
await waitPlay();
const rp2 = await kk(() => ({ nums: window.__kk.puzzle.nums.join(), running: window.__kk.running, left: window.__kk.left }));
const rem2 = (await clock()).rem;
check(rp2.nums === live && rp2.running && leftBefore - rem2 < 1500, 'after replay: live board restored, timer resumes where it paused');
await tapEl('#gQuit'); await wait(150);

// ---------- Bond Lab ----------
await tapEl('#mLab'); await wait(200);
check(await page.isVisible('#lab'), 'Bond Lab opens from the menu');
await tapEl('#labWholes [data-w="19"]'); await wait(100);
// real touch-ish drag on the slider to 7
const sb = await page.locator('#labSlider').boundingBox();
const xFor = v => sb.x + 10 + (sb.width - 20) * (v - 1) / 17;
await page.mouse.move(xFor(9), sb.y + sb.height / 2); await page.mouse.down(); await page.mouse.move(xFor(7), sb.y + sb.height / 2, { steps: 6 }); await page.mouse.up();
await wait(450);
const lb = await kk(() => ({ tf: document.querySelectorAll('#labDots .tf').length, cells: document.querySelectorAll('#labDots .tf i').length, v: window.__lab.v, eq: document.getElementById('labEq').textContent, a: document.getElementById('labA').textContent, b: document.getElementById('labB').textContent, p0: document.querySelectorAll('#labDots .ctr.p0').length, p1: document.querySelectorAll('#labDots .ctr.p1').length }));
check(lb.v === 7 && lb.eq === '19 = 7 + 12' && lb.a === '7' && lb.b === '12' && lb.p0 === 7 && lb.p1 === 12 && lb.tf === 2 && lb.cells === 20, 'slider splits 19 into 7 + 12, bond + counters update live ' + JSON.stringify(lb));
// pseudo-element styles are not exposed by getComputedStyle, so read the shipped rule (and see the shot)
const rule = sel => kk(sel => { for (const sh of document.styleSheets) for (const r of sh.cssRules) if (r.selectorText === sel) return r.style.cssText; return ''; }, sel);
const thumbCss = await rule('#labSlider::-webkit-slider-thumb');
const th = await kk(() => { const sl = document.getElementById('labSlider'); return { outline: getComputedStyle(sl).outlineStyle, focused: document.activeElement === sl }; });
const tw = +(thumbCss.match(/width: (\d+)px/) || [])[1], thh = +(thumbCss.match(/height: (\d+)px/) || [])[1];
Object.assign(th, { w: tw, h: thh, radius: (thumbCss.match(/border-radius: ([^;]+)/) || [])[1] });
check(th.w >= 32 && th.h >= 32 && th.radius === '50%' && th.outline === 'none', 'fat round slider handle, no black focus box after a touch ' + JSON.stringify(th));
await shot('16-lab-slider');
// keyboard users still get a visible focus style on the handle
await kk(() => document.getElementById('labSlider').blur()); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
await kk(() => { const sl = document.getElementById('labSlider'); if (document.activeElement !== sl) { sl.focus({ focusVisible: true }); } });
const kf = await kk(() => { const sl = document.getElementById('labSlider'); return { fv: sl.matches(':focus-visible'), outline: getComputedStyle(sl).outlineStyle }; });
kf.ring = await rule('#labSlider:focus-visible::-webkit-slider-thumb');
await page.keyboard.press('ArrowRight'); await wait(60);
const kv = await kk(() => window.__lab.v);
check(kf.fv && /rgba\(58, 123, 255, 0\.32\)/.test(kf.ring) && kf.outline === 'none' && kv === 8, 'keyboard focus: subtle ring on the handle, arrows move it ' + JSON.stringify({ ...kf, v: kv }));
await shot('16b-lab-slider-keyboard-focus');
await tapEl('#labWholes [data-w="6"]'); await wait(100);
for (const v of [1, 2, 3]) { await page.locator('#labSlider').fill(String(v)); await page.locator('#labSlider').dispatchEvent('change'); await wait(120); }
await wait(350);
const star = await kk(() => ({ stars: window.__lab.data.stars, count: document.getElementById('labCount').textContent, on: document.getElementById('labStar').classList.contains('on'), quiz: document.getElementById('labQuizBtn').disabled }));
check(star.stars.includes(6) && star.count === '3 / 3' && star.on && !star.quiz, 'all bonds of 6 found: star earned, quiz unlocked ' + JSON.stringify(star));
await shot('17-lab-star');
check((await kk(() => JSON.parse(localStorage.getItem('kk.lab.v1')).stars)).includes(6), 'star saved locally');
await tapEl('#labQuizBtn'); await wait(150);
check(/^6 = \d \+ \?$/.test(await page.textContent('#labQ')), 'quiz question: ' + await page.textContent('#labQ'));
await shot('18-lab-quiz');
let firstWrong = true;
for (let k = 0; k < 5; k++) {
  const qq = await kk(() => { const q = window.__lab.quiz; return { ans: window.__lab.w - q.qs[q.i] }; });
  if (firstWrong) { const wrongOpt = await kk(a => [...document.querySelectorAll('#labOpts .opt')].map(b => +b.dataset.o).find(o => o !== a), qq.ans); await tapEl(`#labOpts [data-o="${wrongOpt}"]`); await wait(150); if (k === 0) await shot('19-lab-quiz-wrong'); firstWrong = false; }
  await tapEl(`#labOpts [data-o="${qq.ans}"]`); await wait(750);
}
const qd = await page.textContent('#labQ');
check(qd === '4 / 5', 'quiz finished: 4 / 5 first try (one deliberate miss)');
await shot('20-lab-quiz-done');
await tapEl('#labOpts [data-act="close"]'); await wait(100);
await page.reload(); await page.waitForFunction(() => window.__kk);
await tapEl('#mLab'); await wait(150);
check((await kk(() => document.querySelector('#labWholes [data-w="6"]').classList.contains('star'))), 'star persists after reload');
await tapEl('#labMenu'); await wait(150);
check(await kk(() => window.__kk.phase === 'menu' && !document.getElementById('play').classList.contains('hidden')), 'Bond Lab Menu returns to the menu');

// ---------- Bond Lab at 390 px and 360 px: slider + quiz button label on one line ----------
for (const vw of [390, 360]) {
  await page.setViewportSize({ width: vw, height: 844 }); await tapEl('#mLab'); await wait(200);
  await tapEl('#labWholes [data-w="20"]'); await wait(150);
  const qb = await kk(() => { const b = document.getElementById('labQuizBtn'), r = document.createRange(); r.selectNodeContents(b); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))).size;
    return { text: b.textContent, lines, over: b.scrollWidth > b.clientWidth, w: Math.round(b.getBoundingClientRect().width) }; });
  check(/^Quiz: find \d+ more$/.test(qb.text) && qb.lines === 1 && !qb.over, `${vw}px: quiz button label on one line ${JSON.stringify(qb)}`);
  const sb2 = await page.locator('#labSlider').boundingBox();
  await page.touchscreen.tap(sb2.x + sb2.width * 0.3, sb2.y + sb2.height / 2); await wait(450);
  if (vw === 390) await shot('24-lab-slider-390');
  if (vw === 360) await shot('25-lab-quiz-label-360');
  await tapEl('#labWholes [data-w="6"]'); await wait(100);
  const qb2 = await kk(() => { const b = document.getElementById('labQuizBtn'), r = document.createRange(); r.selectNodeContents(b); return { text: b.textContent, lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, over: b.scrollWidth > b.clientWidth }; });
  check(qb2.text === 'Quiz: missing part' && qb2.lines === 1 && !qb2.over, `${vw}px: unlocked quiz label on one line ${JSON.stringify(qb2)}`);
  if (vw === 390) await shot('26-lab-quiz-unlocked-390');
  await tapEl('#labMenu'); await wait(150);
}
await page.setViewportSize({ width: 412, height: 915 }); await wait(200);

// ---------- big sum on N=7: more than 3 tens stack into rows of full-size frames ----------
await tapEl('#picker [data-n="7"]'); await wait(400);
await queue([P([28, 29, 57, 2, 5, 13, 40], 28, 29)]);
await tapEl('#mStart'); await waitPlay(); await wait(300);
await tapTile(await answerIdx());
await stage('ten2'); await wait(200); await shot('21-big-sum-n7');
const bf = await frameCounts();
const bg = await kk(() => ({ caps: [...document.querySelectorAll('#fx .tcap:not(.bondcap)')].map(e => e.textContent), frames: document.querySelectorAll('#fx .tf').length, minis: document.querySelectorAll('#fx .tf.mini').length, ctr: document.querySelectorAll('#fx .ctr').length,
  inside: [...document.querySelectorAll('#fx .tf')].every(e => { const r = e.getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1; }) }));
check(bg.caps.join('|') === '28 + 2 = 30|30 + 27 = 57' && bg.frames === 6 && bg.minis === 0 && bg.ctr === 57 && bg.inside, 'big sum 28 + 29: ' + JSON.stringify(bg));
check(new Set(bf.w).size === 1 && new Set(bf.top).size === 2 && bf.top.filter(t => t === bf.top[0]).length === 3, `28 + 29: 6 full-size frames (${bf.w[0]} px wide), 2 rows of 3 ${JSON.stringify(bf.top)}`);
check(JSON.stringify(bf.n.map(x => x.p0 + '/' + x.p1)) === JSON.stringify(['10/0', '10/0', '8/2', '0/8', '0/10', '0/9']), 'big sum: each part keeps its colour, hoppers left the source ' + JSON.stringify(bf.n.map(x => x.p0 + '/' + x.p1)));
await tapAnywhere(); await waitPlay(); await tapEl('#gQuit'); await wait(100);

// ---------- FPS with 4x CPU throttling ----------
async function fpsRun(label, puzzle, n) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await tapEl(`#picker [data-n="${n}"]`); await wait(500);
  await queue([puzzle]); await tapEl('#mStart'); await waitPlay(); await wait(500);
  await kk(() => { window.__fr = []; let last = 0; const f = t => { if (last) window.__fr.push(t - last); last = t; if (window.__kk.phase !== 'play' || window.__fr.length < 5) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const lat = await kk(() => new Promise(res => { const p = window.__kk.puzzle, i = p.nums.indexOf(p.answer), t = document.querySelector(`.tile[data-i="${i}"]`), r = t.getBoundingClientRect();
    const t0 = performance.now(); t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3, isPrimary: true, pointerType: 'touch', clientX: r.x + 30, clientY: r.y + 30 })); res(performance.now() - t0); }));
  await waitPlay(15000);
  const fr = await kk(() => window.__fr);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  const s = [...fr].sort((a, b) => a - b), avg = fr.reduce((x, y) => x + y, 0) / fr.length;
  const r = { frames: fr.length, avgFps: +(1000 / avg).toFixed(1), p95ms: +s[Math.floor(s.length * 0.95)].toFixed(1), maxMs: +s[s.length - 1].toFixed(1), over20ms: fr.filter(x => x > 20).length, tapHandlerMs: +lat.toFixed(2) };
  perf[label] = r;
  await tapEl('#gQuit'); await wait(150);
  return r;
}
const f1 = await fpsRun('cpu4x_7+12_N5', P([7, 9, 12, 19, 4], 7, 12), 5);
const f2 = await fpsRun('cpu4x_28+29_N7', P([28, 29, 57, 2, 5, 13, 40], 28, 29), 7);
check(f1.avgFps >= 55 && f2.avgFps >= 55, `FPS @4x CPU: ${JSON.stringify(perf)}`);

// ---------- bond-stage timeline (every 300 ms) + sound-hook timing, 7 + 12 ----------
async function lessonRun(onTap) {
  await page.close(); page = await browser.newPage(ctxOpts); watch(page);
  await boot(BASE + '?level=hard&round=60&teach=full'); await tapEl('#picker [data-n="5"]'); await wait(300);
  await queue([P([7, 9, 12, 19, 4], 7, 12)]); await tapEl('#mStart'); await waitPlay(); await wait(400);
  await kk(() => {
    window.__t0 = 0; window.__sfxLog = []; window.__stg = {};
    document.getElementById('board').addEventListener('pointerdown', () => { window.__t0 = performance.now(); window.__sfxLog = []; }, { capture: true, once: true });
    let last = ''; const f = () => { const g = window.__kk.phase === 'play' && window.__t0 ? 'next board' : window.__kk.teachStage; if (window.__t0 && g !== last) { last = g; window.__stg[g] = Math.round(performance.now() - window.__t0); } if (g !== 'next board') requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  await tapTile(await answerIdx());
  await onTap();
  await waitPlay();
  return kk(() => ({ stg: window.__stg, sfx: window.__sfxLog.map(([n, a, t]) => [n + (a.length ? `(${a.join(',')})` : ''), Math.round(t - window.__t0)]) }));
}
{
  const tl = [];
  const r1 = await lessonRun(async () => {
    await stage('absorb'); const ta = await kk(() => performance.now() - window.__t0);
    for (let t = Math.round(ta + 220); ; t += 300) { // from the moment the answer starts to rise
      const now = await kk(() => performance.now() - window.__t0); if (t > now) await wait(t - now);
      const ph = await kk(() => window.__kk.phase); if (ph === 'play') { await page.screenshot({ path: `${SHOTS}${TAG}-bond-t${t}-next-board.png` }); tl.push(`${t}:next board`); break; }
      const stg = await kk(() => window.__kk.teachStage);
      await page.screenshot({ path: `${SHOTS}${TAG}-bond-t${t}.png` }); tl.push(`${t}:${stg}`);
    }
  });
  perf.bondTimeline = tl; perf.stages = r1.stg; perf.sfx = r1.sfx;
  check(tl.length >= 12, 'bond-stage timeline frames every 300 ms: ' + tl.join(' '));
  const sx = Object.fromEntries(r1.sfx.map(([n, t]) => [n, t]));
  const counts = r1.sfx.filter(([n]) => n.startsWith('count('));
  check(counts.length === 19 && counts.every(([n], i) => n === `count(${i})`), `count(i) fires once per counter as it lands: ${counts.length}x, ${counts[0]?.[1]}-${counts.at(-1)?.[1]} ms`);
  // GD spec, from the answer reaching the top (stage 'bond'): partPop 0.34 / 0.58, caption = cheer 0.8, pulses 1.0 / 1.6 / 2.2, clear 3.3, done 3.6
  const top = r1.stg.bond, rel = n => sx[n] == null ? null : sx[n] - top;
  const spec = { 'partPop(0)': 340, 'partPop(1)': 580, caption: 800, cheer: 800, 'pulse(0)': 1000, 'pulse(1)': 1600, 'pulse(2)': 2200 };
  const got = Object.fromEntries(Object.keys(spec).map(n => [n, rel(n)]));
  check(Object.entries(spec).every(([n, t]) => got[n] != null && Math.abs(got[n] - t) <= 40), 'bond hooks on the GD spec (ms after the answer reaches the top) ' + JSON.stringify(got));
  const clr = r1.stg.clear - top, end = r1.stg['next board'] - top;
  check(Math.abs(clr - 3300) <= 50 && Math.abs(end - 3600) <= 70, `hold to ${clr} ms (3.3 s), clear to ${end} ms (3.6 s)`);
  check(!r1.sfx.some(([n]) => n === 'stopAll'), 'stopAll not called when the lesson plays to the end');
  const ans1 = { bond: sx.bond, top };
  check(Math.abs(sx.bond - (r1.stg.absorb + 220)) <= 40, 'bond() fires as the answer starts to rise ' + JSON.stringify(ans1));
  // confetti peak: one burst, widest spread ~450 ms after it fires
  await lessonRun(async () => {
    await stage('cheer'); await wait(430); await shot('confetti-peak');
    const c = await kk(() => document.querySelectorAll('#fx .confetti').length); await wait(800);
    const c2 = await kk(() => document.querySelectorAll('#fx .confetti').length);
    check(c === 30 && c2 <= 30, `single confetti burst of 30 (no second burst): ${c} then ${c2}`);
  });
}

// ---------- reduced motion ----------
await page.close(); page = await browser.newPage({ ...ctxOpts, reducedMotion: 'reduce' }); watch(page);
await boot(BASE + '?level=hard&round=60');
await queue([P([7, 9, 12, 19, 4], 7, 12)]);
await tapEl('#mStart'); await waitPlay(); await wait(300);
const rs = Date.now(); await tapTile(await answerIdx()); await wait(60);
check((await kk(() => document.querySelectorAll('#fx .ring').length)) === 0, 'reduced motion: no ripple rings');
await stage('ten2'); await wait(150); await shot('22-reduced-maketen');
await stage('cheer'); await wait(200);
check((await kk(() => document.querySelectorAll('#fx .confetti').length)) === 0, 'reduced motion: no confetti');
await shot('23-reduced-bond');
await waitPlay(); const rms = Date.now() - rs;
perf.reducedSolveMs = rms;
check(rms < teachTotal, `reduced-motion solve is simpler and shorter (${rms} ms vs full ${teachTotal} ms)`);

console.log(log.join('\n'));
console.log(fails.length ? fails.join('\n') : 'ALL CHECKS PASSED');
console.log('perf', JSON.stringify(perf, null, 1));
console.log('page errors:', errs.length ? errs : 'none');
writeFileSync(new URL(`../shots/${TAG}-perf.json`, import.meta.url).pathname, JSON.stringify(perf, null, 1));
await browser.close(); server.close();
process.exit(fails.length || errs.length ? 1 : 0);
