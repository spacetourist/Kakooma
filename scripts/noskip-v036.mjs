// v0.3.6 no tap-to-skip (+ v0.3.7 double-tap checks, section F): node scripts/noskip-v036.mjs [baseUrl]. Taps during the connect beat, the counting lesson and a
// chip replay do nothing (nothing queued and replayed as a pick on the next board), the board is live again the moment
// the next board is ready (never stays locked: after a lesson, a quick beat, a replay, a quit mid-lesson), and mute works
// mid-lesson (no source starts after it, the lesson carries on).
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const fails = [], log = []; const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => { window.__sfxLog = []; window.__au = []; const S = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function () { if (this.buffer && this.buffer.length > 1) window.__au.push(performance.now()); return S.apply(this, arguments); }; });
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const tapEl = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const waitPlay = (t = 20000) => page.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach, null, { timeout: t });
const ansI = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
const S = () => kk(() => ({ score: window.__kk.score, miss: window.__kk.miss, phase: window.__kk.phase, teach: !!window.__kk.teach, stage: window.__kk.teachStage, picks: window.__sfxLog.filter(e => ['correct', 'wrong'].includes(e[0])).length }));
const P1 = { nums: [3, 7, 10, 2, 9], a: 3, b: 7, answer: 10 }, P2 = { nums: [4, 8, 1, 12, 6], a: 4, b: 8, answer: 12 };
/** the live board is P1; P2 (answer at index 3) comes next. Tap P1's answer, then hammer the board, including the
 *  slot where P2's answer will appear, through `ms`; return the state on the next board after 600 ms */
async function hammer(ms) {
  await kk(p => { window.__kkNext = [p]; }, P2);
  await kk(() => { window.__taps = []; window.__h0 = performance.now() + 30; window.__readyAt = Infinity; if (!window.__tapL) { window.__tapL = 1; document.addEventListener('pointerdown', () => window.__taps.push(performance.now()), true); }
    const f = () => { if (window.__kk.phase === 'play' && !window.__kk.teach && performance.now() > window.__h0 + 100) window.__readyAt = performance.now(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await tapEl(`.tile[data-i="${await ansI()}"]`); const t0 = Date.now(), s0 = await S();
  const seen = new Set(); let n = 0;
  while (Date.now() - t0 < ms) { const st = await S(); seen.add(st.stage || st.phase); if (st.phase === 'play' && !st.teach) break;
    await tapEl(['.tile[data-i="3"]', '.tile[data-i="0"]', '#board', '.tile[data-i="1"]'][n++ % 4]); await wait(120); }
  await waitPlay(); const ready = Date.now() - t0; await wait(600);
  // a tap the test issued just as the board came back may land on it legitimately; what must never happen is a pick
  // with no tap after the board was ready (a queued tap replayed). Page-side: every pick after s0 needs a pointerdown
  // after the next board's ready moment, within 50 ms before it
  const q = await kk(() => { const r = window.__readyAt, picks = window.__sfxLog.filter(e => ['correct', 'wrong'].includes(e[0]) && e[2] > window.__h0).map(e => e[2]);
    return { late: picks.filter(p => !window.__taps.some(t => t >= r && t <= p && p - t < 50)).length, picks: picks.length, tapsAfter: window.__taps.filter(t => t >= r).length }; });
  const s1 = await S(); s1.unmatched = q.late; s1.lateTaps = q.tapsAfter; s1.latePicks = q.picks; const r = { s0, s1, n, ready, seen: [...seen], board: await kk(() => window.__kk.puzzle.answer) }; if (process.env.DBG) console.log(JSON.stringify(r)); return r;
}
// A: quick (no lesson): taps through the ~1 s connect beat
await page.goto(BASE + '?round=600&level=easy&teach=quick'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(() => localStorage.removeItem('kk.mute'));
await kk(p => { window.__kkNext = [p]; }, P1); await tapEl('#mStart'); await waitPlay(); await wait(300);
let h = await hammer(3000);
check(h.n >= 5 && h.s1.unmatched === 0 && h.board === 12 && h.ready > 950 && (h.s1.score - h.s0.score) + h.s1.miss <= h.s1.lateTaps, `connect beat: ${h.n} taps (incl. the next board's answer slot) did nothing; next board ready at ${h.ready} ms, 0 picks without a fresh tap after it (${h.s1.latePicks} pick(s) from ${h.s1.lateTaps} tap(s) the test sent just after the board was back) (${h.seen})`);
await tapEl(`.tile[data-i="${await ansI()}"]`); await wait(50);
check((await S()).score === h.s1.score + 1, 'input live on the next board at once (a real tap scores)');
await waitPlay(); await wait(200);
// B: full lessons: taps through the beat + the whole counting lesson, three lessons in a row
await page.goto(BASE + '?round=600&level=easy&teach=full'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(p => { window.__kkNext = [p]; }, P1); await tapEl('#mStart'); await waitPlay(); await wait(300);
for (let k = 1; k <= 3; k++) {
  h = await hammer(20000);
  check(h.n >= 20 && ['connect', 'fly'].every(g => h.seen.includes(g)) && h.s1.unmatched === 0 && h.s1.score - h.s0.score + h.s1.miss <= h.s1.lateTaps && h.board === 12, `lesson ${k}: ${h.n} taps through the beat + counting (${h.seen.join(' > ')}) did nothing: played in full (${h.ready} ms), no replayed pick on the next board (${h.s1.latePicks} from ${h.s1.lateTaps} fresh tap(s))`);
  const t = Date.now(); await tapEl(`.tile[data-i="${await ansI()}"]`); const s = await S();
  check(s.score === h.s1.score + 1, `lesson ${k}: board input live again at once after the lesson (${Date.now() - t} ms tap-to-score)`);
  await waitPlay(); await wait(300); await kk(p => { window.__kkNext = [p]; }, P1); await tapEl(`.tile[data-i="${await ansI()}"]`); await waitPlay(); await wait(300);
}
check(!(await kk(() => window.__sfxLog.some(e => e[0] === 'stopAll'))), 'no lesson was cut (no stopAll from a tap)');
// C: mute mid-lesson (the menu's sound button handler; in game it is reached via the same setMuted path)
await kk(p => { window.__kkNext = [p]; }, P2); await tapEl(`.tile[data-i="${await ansI()}"]`);
await page.waitForFunction(() => window.__kk.teachStage === 'fly', null, { timeout: 5000 }); await wait(600);
const m0 = await kk(() => { const a = window.__au.length; document.getElementById('mMute').click(); return { a, t: performance.now(), muted: localStorage.getItem('kk.mute'), stop: window.__sfxLog.filter(e => e[0] === 'stopAll').length, mute: window.__sfxLog.some(e => e[0] === 'mute') }; });
await waitPlay();
const m1 = await kk(t => ({ after: window.__au.filter(x => x > t + 5).length, hooks: window.__sfxLog.filter(e => e[2] > t && !['mute', 'stopAll'].includes(e[0])).map(e => e[0]) }), m0.t);
check(m0.a > 0 && m0.muted === '1' && m0.mute && m1.after === 0 && m1.hooks.length >= 5, `mute mid-lesson: ${m0.a} sounds before, 0 sources started after the mute while ${m1.hooks.length} hooks still fired (${[...new Set(m1.hooks)].join(',')}); lesson ran to its end`);
await kk(() => document.getElementById('mMute').click()); await wait(200);
await tapEl(`.tile[data-i="${await ansI()}"]`); await wait(300);
check((await kk(() => window.__au.length)) > m0.a, 'unmuted: sound comes back on the next pick');
await waitPlay();
// D: chip replay: taps do nothing, input live after it
await tapEl('#tray .chip >> nth=0'); await wait(200);
const r0 = await S(); for (let k = 0; k < 6; k++) { await page.touchscreen.tap(195, 600); await wait(300); }
const r1 = await S(); await waitPlay();
await tapEl(`.tile[data-i="${await ansI()}"]`); const r2 = await S();
check(r0.phase === 'replay' && r1.phase === 'replay' && r2.score === r0.score + 1, `chip replay: 6 taps did nothing (still ${r1.phase}), board live straight after (score ${r0.score} -> ${r2.score})`);
await waitPlay();
// E: quit mid-lesson, then a new round: input works
await kk(p => { window.__kkNext = [p]; }, P2); await tapEl(`.tile[data-i="${await ansI()}"]`);
await page.waitForFunction(() => window.__kk.teachStage === 'fly', null, { timeout: 5000 });
await tapEl('#gQuit'); await page.waitForFunction(() => document.getElementById('play').dataset.mode === 'menu', null, { timeout: 2000 });
const q = await kk(() => ({ teach: window.__kk.teach, fx: document.querySelectorAll('#fx > *').length }));
await tapEl('#mStart'); await waitPlay(); await wait(300); await tapEl(`.tile[data-i="${await ansI()}"]`);
check(q.teach === null && q.fx === 0 && (await S()).score === 1, 'Quit mid-lesson works (lesson gone at once); the next round takes taps straight away');
// F (v0.3.7): Callum's double tap. Default settings (no ?teach, "Show counting" ON by default): every solve gets the beat and
// the full lesson. Two taps on the correct answer 10-80 ms apart (CDP touch, and mouse), at 1x and 4x CPU: the second tap
// does nothing (one pick, no miss, no stopAll, nothing replayed on the next board) and the beat + full lesson always play
for (const cpu of [1, 4]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); const cdp = await ctx.newCDPSession(pg);
  await pg.addInitScript(() => { window.__sfxLog = []; });
  await pg.goto(BASE + '?round=600&level=easy'); await pg.waitForFunction(() => document.fonts.status === 'loaded');
  await pg.evaluate(() => { localStorage.removeItem('kk.lesson'); window.__stg = []; const f = () => { const g = window.__kk.teachStage; if (g && window.__stg.at(-1) !== g) window.__stg.push(g); requestAnimationFrame(f); }; requestAnimationFrame(f); });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const on = await pg.evaluate(() => ({ st: window.__kk.lesson, aria: document.getElementById('mLesson').getAttribute('aria-checked') }));
  const sb = await pg.locator('#mStart').boundingBox(); await pg.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
  const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
  const rows = []; let ok = on.st === true && on.aria === 'true';
  for (const [gap, how] of [[10, 'touch'], [25, 'touch'], [40, 'touch'], [60, 'touch'], [80, 'touch'], [10, 'mouse'], [50, 'mouse']]) {
    await pg.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach, null, { timeout: 40000 }); await pg.waitForTimeout(300);
    const i = await pg.evaluate(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
    const bb = await pg.locator(`.tile[data-i="${i}"]`).boundingBox(), x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    const s0 = await pg.evaluate(() => { window.__stg = []; return { score: window.__kk.score, miss: window.__kk.miss, tc: window.__kk.teachCount, picks: window.__sfxLog.filter(e => ['correct', 'wrong'].includes(e[0])).length }; });
    const tA = Date.now();
    if (how === 'touch') { await T('touchStart', x, y); await T('touchEnd', x, y); await pg.waitForTimeout(gap); await T('touchStart', x, y); await T('touchEnd', x, y); }
    else { await pg.mouse.click(x, y); await pg.waitForTimeout(gap); await pg.mouse.click(x, y); }
    await pg.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach, null, { timeout: 40000 }); const dur = Date.now() - tA; await pg.waitForTimeout(600);
    const s1 = await pg.evaluate(() => ({ score: window.__kk.score, miss: window.__kk.miss, tc: window.__kk.teachCount, stg: window.__stg.slice(), picks: window.__sfxLog.filter(e => ['correct', 'wrong'].includes(e[0])).length, stop: window.__sfxLog.some(e => e[0] === 'stopAll') }));
    const good = s1.score === s0.score + 1 && s1.miss === 0 && s1.picks === s0.picks + 1 && s1.tc === s0.tc + 1 && ['connect', 'fly', 'counted', 'bond', 'clear'].every(g => s1.stg.includes(g)) && !s1.stop && dur > 5000;
    ok = ok && good; rows.push(`${how} ${gap}ms: ${good ? 'full' : 'BAD ' + JSON.stringify(s1)} ${(dur / 1000).toFixed(1)}s`);
  }
  check(ok, `double tap on the answer @${cpu}x CPU (Show counting ON by default): 1 pick each, beat + full lesson every solve, nothing queued: ${rows.join('; ')}`);
  await ctx.close();
}
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log([...log, ...fails].join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V036 NO-SKIP CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
