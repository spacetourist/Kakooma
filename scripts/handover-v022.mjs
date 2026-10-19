// v0.2.2 handover check: node scripts/handover-v022.mjs [baseUrl]. For 6+11, 7+12, 2+5, 28+29: every animation frame 1.5-2.6 s after the tap is checked in-page (answer never overlaps a visible caption/frame; no visible counter outside its square), plus a screenshot every 100 ms.
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
const P = (nums, a, b) => ({ nums, a, b, answer: a + b });
const sums = [['6+11', 5, P([6, 11, 17, 30, 9], 6, 11)], ['7+12', 5, P([7, 9, 12, 19, 4], 7, 12)], ['2+5', 5, P([2, 5, 7, 13, 16], 2, 5)], ['28+29', 7, P([28, 29, 57, 2, 5, 13, 40], 28, 29)]];
const OFFS = Array.from({ length: 12 }, (_, i) => 1500 + i * 100);
const fails = [], summary = {};
const page = await browser.newPage(ctxOpts);
const errs = []; page.on('pageerror', e => errs.push(e.message));
const tap = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
for (const [name, n, p] of sums.filter(s => !process.env.ONLY || s[0] === process.env.ONLY)) {
  await page.goto(BASE + '?round=600&teach=full' + (process.env.REDUCED ? '&reduced' : '')); await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(() => localStorage.clear());
  await tap(`#picker [data-n="${n}"]`); await page.waitForTimeout(200);
  await page.evaluate(q => { window.__kkNext = Array.from({ length: 30 }, () => q); }, p);
  await tap('#mStart'); await page.waitForFunction(() => window.__kk.phase === 'play');
  const stats = { frames: 0, overlap: [], outside: [], total: [] };
  for (const off of OFFS) {
    await page.waitForTimeout(250);
    // in-page monitor: from the tap, check every animation frame between 1500 and 2600 ms
    await page.evaluate(() => {
      window.__mon = { t0: 0, bad: [], frames: 0 };
      const vis = e => +getComputedStyle(e).opacity > 0.01;
      const inter = (a, b, pad = 0) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
      const textRect = e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); };
      const f = () => {
        const m = window.__mon; if (!m.t0) return requestAnimationFrame(f);
        const t = performance.now() - m.t0;
        if (t >= 1500 && t <= 2600 && window.__kk.phase !== 'play') {
          m.frames++;
          const ans = document.querySelector('#fx > .bnode.whole');
          const shown = [...document.querySelectorAll('#fx .tf'), ...document.querySelectorAll('#fx .tcap:not(.bondcap)')].filter(vis);
          if (ans && vis(ans)) { const ar = ans.getBoundingClientRect(); for (const e of shown) { const r = e.classList.contains('tcap') ? textRect(e) : e.getBoundingClientRect(); if (inter(ar, r, 1)) m.bad.push(`${Math.round(t)}ms overlap answer x ${e.className} op=${getComputedStyle(e).opacity}`); } }
          const cells = [...document.querySelectorAll('#fx .tf i')].map(c => c.getBoundingClientRect());
          for (const c of document.querySelectorAll('#fx .ctr')) { if (!vis(c)) continue; const r = c.getBoundingClientRect();
            if (!cells.some(q => r.left >= q.left - 1 && r.right <= q.right + 1 && r.top >= q.top - 1 && r.bottom <= q.bottom + 1)) { m.bad.push(`${Math.round(t)}ms counter outside its square op=${getComputedStyle(c).opacity}`); break; } }
        }
        if (t < 2700 && window.__kk.phase !== 'play') requestAnimationFrame(f); else m.done = true;
      };
      requestAnimationFrame(f);
      document.getElementById('board').addEventListener('pointerdown', () => { window.__mon.t0 = performance.now(); }, { capture: true, once: true });
    });
    const i = await page.evaluate(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
    await tap(`.tile[data-i="${i}"]`);
    const now = await page.evaluate(() => performance.now() - window.__mon.t0); if (off > now) await page.waitForTimeout(off - now);
    const at = Math.round(await page.evaluate(() => performance.now() - window.__mon.t0));
    await page.screenshot({ path: `${SHOTS}v022-handover${process.env.REDUCED ? '-reduced' : ''}-${name.replace('+', '-')}-${off}.png` });
    await page.waitForFunction(() => window.__kk.phase === 'play' && window.__mon.done, null, { timeout: 8000 });
    const m = await page.evaluate(() => window.__mon);
    stats.frames += m.frames; stats.overlap.push(...m.bad.filter(b => b.includes('overlap'))); stats.outside.push(...m.bad.filter(b => b.includes('outside')));
    stats.total.push(at);
  }
  summary[name] = { checkedFrames: stats.frames, overlapFrames: stats.overlap.length, counterOutside: stats.outside.length, shotAt: stats.total.join(','), firstBad: [...stats.overlap, ...stats.outside].slice(0, 3) };
  if (stats.overlap.length || stats.outside.length || stats.frames < 100) fails.push(name);
}
console.log(JSON.stringify(summary, null, 1));
console.log(fails.length ? 'FAIL ' + fails.join(', ') : 'ALL HANDOVER CHECKS PASSED'); console.log('page errors:', errs.length ? errs : 'none');
await browser.close(); server.close(); process.exit(fails.length || errs.length ? 1 : 0);
