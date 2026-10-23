// v0.3.7 "Show counting": node scripts/v037.mjs [baseUrl]. Menu switch (default ON, 'kk.lesson', >= 44 px, persists),
// ON = beat + full lesson every solve, OFF = beat + confetti then the next board (held-board shower on 3/5), sounds:
// link/correct/streak/blaze fire, partPop/count/total never do. Shots: shots/v037-*.png
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const LIVE = !!process.argv[2], BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`, TAG = LIVE ? 'live-' : '';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const fails = [], log = []; const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => { window.__sfxLog = []; window.__taps = []; document.addEventListener('pointerdown', () => window.__taps.push(performance.now()), true); });
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const tapEl = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const waitPlay = (t = 30000) => page.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach, null, { timeout: t });
const ansI = () => kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
const P1 = { nums: [3, 7, 10, 2, 9], a: 3, b: 7, answer: 10 }, P2 = { nums: [4, 8, 1, 12, 6], a: 4, b: 8, answer: 12 };
const ver = (await (await fetch(BASE + 'index.html').catch(() => null))?.text?.()) ?? '';

// 1. menu: switch present, ON by default, kid-sized, persists
await page.goto(BASE + '?level=easy'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(() => { localStorage.clear(); }); await page.reload(); await page.waitForFunction(() => document.fonts.status === 'loaded'); await wait(400);
const m = await kk(() => { const b = document.getElementById('mLesson'), r = b.getBoundingClientRect(), pk = document.getElementById('picker').getBoundingClientRect(), st = document.getElementById('mStart').getBoundingClientRect();
  return { txt: b.textContent.trim(), role: b.getAttribute('role'), aria: b.getAttribute('aria-checked'), on: window.__kk.lesson, h: r.height, w: r.width, below: r.top - pk.bottom, fs: parseFloat(getComputedStyle(b.querySelector('.lt')).fontSize), startVis: st.bottom <= innerHeight, lbVis: document.getElementById('mBoards').getBoundingClientRect().bottom <= innerHeight + 1, vp: innerWidth + 'x' + innerHeight, ver: document.getElementById('verLabel').textContent }; });
check(m.txt === 'Show counting' && m.role === 'switch' && m.aria === 'true' && m.on === true, `menu: "${m.txt}" switch, ON by default (aria-checked ${m.aria}), ${m.ver}`);
check(m.h >= 44 && m.w >= 44 && m.fs >= 16 && m.below >= 0 && m.below < 30 && m.startVis && m.lbVis, `menu ${m.vp}: tap target ${Math.round(m.w)}x${Math.round(m.h)} px, label ${m.fs}px, right under the shape picker (+${Math.round(m.below)} px), Start to Leaderboard all on screen`);
await page.screenshot({ path: `${SHOTS}/${TAG}v037-menu.png` });
await tapEl('#mLesson'); await wait(250);
const off1 = await kk(() => ({ ls: localStorage.getItem('kk.lesson'), aria: document.getElementById('mLesson').getAttribute('aria-checked'), on: window.__kk.lesson }));
await page.screenshot({ path: `${SHOTS}/${TAG}v037-menu-off.png` });
await page.reload(); await page.waitForFunction(() => document.fonts.status === 'loaded');
const off2 = await kk(() => ({ aria: document.getElementById('mLesson').getAttribute('aria-checked'), on: window.__kk.lesson }));
check(off1.ls === '0' && off1.aria === 'false' && off1.on === false && off2.aria === 'false' && off2.on === false, `tap turns it OFF, saved ('kk.lesson' = '${off1.ls}') and still OFF after a reload`);
// small phone: everything still fits
await page.setViewportSize({ width: 375, height: 667 }); await wait(300);
const sm = await kk(() => { const s = document.getElementById('mStart').getBoundingClientRect(), b = document.getElementById('mLesson').getBoundingClientRect(); return { fit: s.bottom <= innerHeight + 1, h: b.height }; });
await page.screenshot({ path: `${SHOTS}/${TAG}v037-menu-375x667.png` });
check(sm.fit && sm.h >= 44, `375x667: switch (${sm.h} px) and Start on screen (Leaderboard was already below the fold here in v0.3.6.2)`);
await page.setViewportSize({ width: 390, height: 844 }); await wait(200);

// 2. OFF: 5 solves (streak 3 and 5 get the held-board shower)
async function solves(n, shots) {
  const out = [];
  for (let k = 1; k <= n; k++) {
    await kk(p => { window.__kkNext = [p]; }, k % 2 ? P2 : P1);
    const i = await ansI(); const t0 = await kk(() => { window.__rdy = 0; window.__c0 = window.__kkConfetti.length; window.__l0 = window.__sfxLog.length; window.__stg = [];
      const f = () => { const g = window.__kk.teachStage; if (g && window.__stg.at(-1) !== g) window.__stg.push(g); if (window.__kk.phase === 'play' && !window.__kk.teach && window.__tp && performance.now() > window.__tp + 50) window.__rdy = performance.now(); else requestAnimationFrame(f); };
      window.__tp = 0; requestAnimationFrame(f); return window.__kk.score; });
    await tapEl(`.tile[data-i="${i}"]`); await kk(() => { window.__tp = window.__taps.at(-1); });
    if (shots?.[k]) for (const [ms, name] of shots[k]) { await page.waitForFunction(ms => performance.now() - window.__tp >= ms, ms); await page.screenshot({ path: `${SHOTS}/${TAG}${name}` }); }
    await waitPlay(); await page.waitForFunction(() => window.__rdy > 0);
    const r = await kk(() => { const tp = window.__tp, L = window.__sfxLog.slice(window.__l0);
      const at = n => L.filter(e => e[0] === n).map(e => Math.round(e[2] - tp));
      return { score: window.__kk.score, streak: window.__kk.streak, next: Math.round(window.__rdy - tp), stg: window.__stg, names: [...new Set(L.map(e => e[0]))],
        link: at('link'), correct: at('correct'), streakAt: at('streak'), blaze: L.filter(e => e[0] === 'blaze').map(e => e[3] + '@' + Math.round(e[2] - tp)),
        conf: window.__kkConfetti.slice(window.__c0).map(e => e[0] + '@' + Math.round(e[1] - tp)), tc: window.__kk.teachCount }; });
    out.push(r); await wait(250);
  }
  return out;
}
await kk(p => { window.__kkNext = [p]; }, P1);
await page.goto(BASE + '?level=easy&round=600'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(p => { window.__kkNext = [p]; }, P1); await tapEl('#mStart'); await waitPlay(); await wait(400);
const OFF = await solves(5, { 1: [[300, 'v037-off-beat-0300.png'], [600, 'v037-off-beat-0600.png'], [1200, 'v037-off-next-board.png']], 3: [[600, 'v037-off-streak3-0600.png'], [1300, 'v037-off-streak3-shower-1300.png']] });
for (const r of OFF) console.log(`OFF #${r.score} streak ${r.streak}: next board ${r.next} ms | link ${r.link} correct ${r.correct} streak ${r.streakAt} blaze ${r.blaze} | confetti ${r.conf.slice(0, 3)}${r.conf.length > 3 ? '…' + r.conf.length : ''} | ${r.stg}`);
const bad = ['partPop', 'count', 'total', 'bond', 'caption'];
check(OFF.every(r => r.tc === 0 && !r.stg.some(g => g !== 'connect') && bad.every(b => !r.names.includes(b))), `OFF: no lesson on any of 5 solves (teachCount 0, only the connect stage); partPop/count/total never fire (sounds: ${[...new Set(OFF.flatMap(r => r.names))].join(',')})`);
check(OFF.every(r => r.link.length === 1 && r.correct.length === 1 && r.link[0] >= 95 && r.link[0] <= 140), `OFF: link + correct on every solve (link ${OFF.map(r => r.link[0]).join('/')} ms after the tap)`);
const quick = OFF.filter(r => ![3, 5].includes(r.streak)), held = OFF.filter(r => [3, 5].includes(r.streak));
check(quick.every(r => r.next >= 980 && r.next <= 1250 && r.conf.some(c => c.startsWith('burst@'))), `OFF: plain solves: connect beat + one confetti burst, next board at ${quick.map(r => r.next).join('/')} ms`);
const cheerAt = r => +(r.blaze.find(b => b.startsWith('cheer')) ?? '@NaN').split('@')[1], showerAt = r => +(r.conf.find(c => c.startsWith('shower')) ?? '@NaN').split('@')[1];
check(held.every(r => r.next >= 1900 && r.next <= 2300 && Math.abs(cheerAt(r) - showerAt(r)) <= 5 && r.conf.filter(c => c.startsWith('shower')).length >= 3), `OFF: streak 3 and 5: star shower held on the board, cheer on its first burst (${held.map(r => `cheer ${cheerAt(r)} / shower ${showerAt(r)} ms`).join(', ')}), next board at ${held.map(r => r.next).join('/')} ms`);
const h5 = held.find(r => r.streak === 5);
check(h5 && h5.streakAt.length === 1 && Math.abs(h5.streakAt[0] - cheerAt(h5)) <= 3 && held.find(r => r.streak === 3).streakAt.length === 0, `OFF: streak(5) with the cheer on the first burst (${h5?.streakAt[0]} vs ${cheerAt(h5)} ms); streak 3 has no streak() tier sound (as before)`);
// 3. ON (menu tap back on, in the same session): every solve plays the beat + the full lesson; shower inside the lesson at streak 3
await tapEl('#gQuit'); await page.waitForFunction(() => document.getElementById('play').dataset.mode === 'menu');
await tapEl('#mLesson'); await wait(200);
check(await kk(() => window.__kk.lesson && localStorage.getItem('kk.lesson') === '1'), 'tap again: ON, saved as "1"');
await kk(p => { window.__kkNext = [p]; }, P1); await tapEl('#mStart'); await waitPlay(); await wait(400);
const ON = await solves(5);
for (const r of ON) console.log(`ON  #${r.score} streak ${r.streak}: next board ${r.next} ms | link ${r.link} correct ${r.correct} streak ${r.streakAt} blaze ${r.blaze} | ${r.stg.join('>')}`);
check(ON.every(r => r.tc >= 1 && ['connect', 'fly', 'counted', 'bond', 'clear'].every(g => r.stg.includes(g)) && r.names.includes('count') && r.names.includes('total') && r.link.length === 1 && r.correct.length === 1), `ON: beat + full lesson on all 5 solves (incl. #4, which v0.3.6.2 skipped), count/total fire; next board at ${ON.map(r => (r.next / 1000).toFixed(1)).join('/')} s`);
const s5 = ON.find(r => r.streak === 5), s3 = ON.find(r => r.streak === 3);
check(s5 && s5.streakAt.length === 1 && s5.streakAt[0] > 3000 && Math.abs(s5.streakAt[0] - cheerAt(s5)) <= 3 && Math.abs(showerAt(s3) - cheerAt(s3)) <= 5 && showerAt(s3) > 3000, `ON: streak 3/5 shower inside the lesson at the bond (streak 3: shower + cheer at ${showerAt(s3)} ms; streak 5: streak(5) + cheer at ${s5?.streakAt[0]} ms)`);
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log([...log, ...fails].join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V037 CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
