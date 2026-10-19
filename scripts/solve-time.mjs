// Teaching-solve length: node scripts/solve-time.mjs [baseUrl]. Tap on the answer -> next board live (phase play), in-page clock.
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
const cases = [['7 + 12', 5, P([7, 9, 12, 19, 4], 7, 12)], ['2 + 5', 5, P([2, 5, 7, 13, 16], 2, 5)], ['28 + 29', 7, P([28, 29, 57, 2, 5, 13, 40], 28, 29)]];
const out = {};
for (const reduced of [false, true]) for (const [name, n, p] of cases) {
  const page = await browser.newPage(ctxOpts);
  await page.goto(BASE + '?round=60&teach=full' + (reduced ? '&reduced' : ''));
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(() => localStorage.clear());
  const tap = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  await tap(`#picker [data-n="${n}"]`); await page.waitForTimeout(200);
  await page.evaluate(q => { window.__kkNext = [q]; }, p);
  await tap('#mStart'); await page.waitForFunction(() => window.__kk.phase === 'play'); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__t0 = 0; document.getElementById('board').addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { capture: true, once: true }); });
  const i = await page.evaluate(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
  await tap(`.tile[data-i="${i}"]`);
  const ms = await page.evaluate(() => new Promise(res => { const f = () => (window.__kk.phase === 'play' && window.__t0 ? res(performance.now() - window.__t0) : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  out[(reduced ? 'reduced ' : 'full ') + name] = Math.round(ms);
  await page.close();
}
console.log(JSON.stringify(out));
await browser.close(); server.close();
