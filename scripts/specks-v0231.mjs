// v0.2.3.1 speck check: node scripts/specks-v0231.mjs [baseUrl]. Frames every 50 ms from 2.0 to 2.8 s after the tap on 7+12, 11+16, 28+29; writes shots + shots/<tag>-specks.json for the pixel check (scripts/specks-pixels.py).
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
const TAG = process.env.SHOT_TAG || 'v0231';
const P = (nums, a, b) => ({ nums, a, b, answer: a + b });
const sums = [['7+12', 5, P([7, 9, 12, 19, 4], 7, 12)], ['11+16', 5, P([11, 16, 27, 4, 30], 11, 16)], ['28+29', 7, P([28, 29, 57, 2, 5, 13, 40], 28, 29)]].filter(s => !process.env.ONLY || s[0] === process.env.ONLY);
const OFFS = (process.env.OFFS ? process.env.OFFS.split(',').map(Number) : Array.from({ length: 17 }, (_, i) => 2000 + i * 50));
const page = await browser.newPage(ctxOpts); const errs = []; page.on('pageerror', e => errs.push(e.message));
const tap = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const out = [];
for (const [name, n, p] of sums) {
  await page.goto(BASE + '?level=hard&round=600&teach=full'); await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(() => localStorage.clear());
  await tap(`#picker [data-n="${n}"]`); await page.waitForTimeout(200);
  await page.evaluate(q => { window.__kkNext = Array.from({ length: 40 }, () => q); }, p);
  await tap('#mStart'); await page.waitForFunction(() => window.__kk.phase === 'play');
  for (const off of OFFS) {
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.__t0 = 0; window.__stg = {};
      document.getElementById('board').addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true, once: true });
      let last = ''; const f = () => { const g = window.__kk.phase === 'play' && window.__t0 ? 'next' : window.__kk.teachStage; if (window.__t0 && g !== last) { last = g; window.__stg[g] = performance.now() - window.__t0; } if (g !== 'next') requestAnimationFrame(f); }; requestAnimationFrame(f);
    });
    const i = await page.evaluate(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
    await tap(`.tile[data-i="${i}"]`);
    const now = await page.evaluate(() => performance.now() - window.__t0); if (off > now) await page.waitForTimeout(off - now);
    const at = await page.evaluate(() => performance.now() - window.__t0);
    const file = `${TAG}-specks-${name.replace('+', '-')}-${off}.png`;
    await page.screenshot({ path: SHOTS + file });
    await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 9000 });
    const g = await page.evaluate(() => { const fx = document.getElementById('fx').getBoundingClientRect(); return { stg: window.__stg, fx: { x: fx.x, y: fx.y, w: fx.width, h: fx.height } }; });
    out.push({ sum: name, off, at: Math.round(at), file, top: Math.round(g.stg.bond), absorb: Math.round(g.stg.absorb), fx: g.fx });
  }
}
writeFileSync(`${SHOTS}${TAG}-specks.json`, JSON.stringify(out, null, 1));
console.log(`${out.length} frames written; page errors:`, errs.length ? errs : 'none');
await browser.close(); server.close();
