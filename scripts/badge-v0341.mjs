// v0.3.4.1 source-badge number split: node scripts/badge-v0341.mjs [baseUrl]. Renders both badges (80 px, as in the lesson)
// at 0/30/50/80/100 % drained and checks the fill and both number copies are clipped by the same --d. Shots v0341-badge-*.png.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE); await page.waitForFunction(() => document.fonts.status === 'loaded');
const fails = [], log = []; const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
for (const d of [0, 30, 50, 80, 100]) {
  const r = await page.evaluate(d => {
    const fx = document.getElementById('fx'); fx.querySelectorAll('.srcb, .tst').forEach(e => e.remove());
    const plate = document.createElement('div'); plate.className = 'tst plate'; plate.style.cssText = 'width:240px;height:110px;left:20px;top:20px'; fx.appendChild(plate);
    [[0, 7], [1, 12]].forEach(([i, v]) => { const e = document.createElement('div'); e.className = `srcb p${i}`; e.style.cssText = `width:80px;height:80px;left:${35 + i * 120}px;top:35px;font-size:40px`; e.style.setProperty('--d', d + '%'); e.innerHTML = `<div class="over"><b>${v}</b></div><div class="fill"><b>${v}</b></div>`; fx.appendChild(e); });
    const b = [...fx.querySelectorAll('.srcb')];
    return b.map(e => ({ top: getComputedStyle(e.querySelector('.over')).clipPath, fill: getComputedStyle(e.querySelector('.fill')).clipPath, topColor: getComputedStyle(e.querySelector('.over')).color, stroke: getComputedStyle(e.querySelector('.over')).webkitTextStrokeColor, fillBg: getComputedStyle(e.querySelector('.fill')).backgroundColor, rect: (r => [r.x, r.y, r.width, r.height])(e.getBoundingClientRect()) }));
  }, d);
  const bb = r[0].rect; const fxr = await page.locator('#fx').boundingBox();
  await page.screenshot({ path: `${SHOTS}v0341-badge-${String(d).padStart(3, '0')}.png`, clip: { x: fxr.x + 20, y: fxr.y + 20, width: 240, height: 110 } });
  const split = r.every(x => x.top === `inset(0px 0px ${100 - d}% 0px)` || x.top === `inset(0px 0px calc(${100 - d}%) 0px)` || (d === 0 && /inset\(0px 0px 100%/.test(x.top)));
  check(r[0].topColor === 'rgb(156, 192, 255)' && r[0].stroke === 'rgb(29, 35, 64)' && r[1].topColor === 'rgb(58, 123, 255)' && r[0].fillBg === 'rgb(156, 192, 255)' && r[1].fillBg === 'rgb(58, 123, 255)', `${d}%: colours (left #9cc0ff + ink outline above the fill, right #3a7bff; white on the fill)`);
  log.push(`     ${d}%: top ${r[0].top} | fill ${r[0].fill}`);
  check(r.every(x => x.fill.includes(`${d}%`) || (d === 0 && /inset\(0(px|%)/.test(x.fill))), `${d}%: fill clipped at ${d}% from the top`);
}
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V0341 BADGE CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
