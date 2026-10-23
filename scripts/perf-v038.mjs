// v0.3.8 before/after perf: node scripts/perf-v038.mjs [distDir] [label]
// 4x CPU (CDP), 390x844, Easy pentagon, Show counting OFF and ON: for each solve, from the tap to the next playable
// board: long tasks, frame gaps (p95 / worst / > 50 ms), and whether the round clock ran before the board was ready.
// Works on any build with window.__kk (v0.3.7 for "before", dist for "after").
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = process.argv[2] || new URL('../dist', import.meta.url).pathname, LABEL = process.argv[3] || ROOT;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, ''); if (!p || p === '/') p = '/index.html';
  const f = join(ROOT, p); if (!existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${server.address().port}/Kakooma/?level=easy&round=600`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const P = [{ nums: [3, 7, 10, 2, 9], a: 3, b: 7, answer: 10 }, { nums: [4, 8, 1, 12, 6], a: 4, b: 8, answer: 12 }];
const out = {};
for (const lesson of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(on => { localStorage.setItem('kk.lesson', on ? '1' : '0'); localStorage.setItem('kk.lv', 'easy'); localStorage.setItem('kk.n', '5');
    window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {} }, lesson);
  await page.goto(URL0); await page.waitForFunction(() => document.fonts.status === 'loaded'); await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(p => { window.__kkNext = [p]; }, P[0]);
  const bb = await page.locator('#mStart').boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach && !window.__kk.resetStage, null, { timeout: 30000 }); await page.waitForTimeout(800);
  const runs = [];
  for (let k = 1; k <= (lesson ? 2 : 4); k++) {
    await page.evaluate(p => { window.__kkNext = [p]; }, P[k % 2]);
    const i = await page.evaluate(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
    await page.evaluate(() => { window.__lt = []; window.__fr = []; window.__t0 = performance.now(); window.__done = false; let left = false, readyAt = 0, n = 0;
      const f = () => { const now = performance.now(), s = window.__kk; window.__fr.push([now, s.running, s.phase]);
        if (s.phase !== 'play') left = true;
        if (left && s.phase === 'play' && !s.teach && !s.resetStage && !readyAt) { readyAt = now; window.__ready = now; }
        if (readyAt && ++n > 10) { window.__done = true; return; } requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const tb = await page.locator(`.tile[data-i="${i}"]`).boundingBox(); await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.waitForFunction(() => window.__done, null, { timeout: 30000, polling: 100 }); await page.waitForTimeout(300);
    runs.push(await page.evaluate(() => { const fr = window.__fr, rd = window.__ready, tap = fr[0][0];
      const gaps = fr.slice(1).map((e, j) => e[0] - fr[j][0]).sort((a, b) => a - b);
      return { nextBoardMs: Math.round(rd - tap), frames: fr.length, p95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1), worst: +gaps.at(-1).toFixed(1), over50: gaps.filter(g => g > 50).length,
        longTasks: window.__lt.filter(e => e[0] >= tap - 5).map(e => Math.round(e[1])), clockBeforeReady: (() => { const p0 = fr.findIndex(e => !e[1]); return p0 >= 0 && fr.slice(p0).some(e => e[0] < rd - 1 && e[1]); })(), clockStartVsReadyMs: (() => { const p0 = fr.findIndex(e => !e[1]); const r = fr.slice(p0).find(e => e[1]); return r ? Math.round(r[0] - rd) : null; })() }; }));
  }
  out[lesson ? 'ON' : 'OFF'] = runs; await ctx.close();
}
await browser.close(); server.close();
console.log(LABEL + ' ' + JSON.stringify(out));
for (const [m, rs] of Object.entries(out)) console.log(`${LABEL} ${m}: long tasks ${rs.flatMap(r => r.longTasks).length} (${rs.flatMap(r => r.longTasks).join(',') || '-'}), frame p95 max ${Math.max(...rs.map(r => r.p95))} ms, worst ${Math.max(...rs.map(r => r.worst))} ms, >50 ms frames ${rs.reduce((a, r) => a + r.over50, 0)}, clock before ready ${rs.some(r => r.clockBeforeReady)} (timer restarts at ready +${rs.map(r => r.clockStartVsReadyMs).join("/")} ms), next board ${rs.map(r => r.nextBoardMs).join('/')} ms`);
