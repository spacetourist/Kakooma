// v2 pose alignment: each GD v2 pose vs idle blaze.png, in the rendered game (reduced motion: no bob, no swap motion).
// Box = the <img> layout rect; ink = the image's alpha>16 bbox mapped onto that rect (CSS px). Shots -> shots/v2-*.png
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const DIST = path.resolve('dist');
const server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, ''); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream';
  r.writeHead(200, { 'content-type': t }); fs.createReadStream(f).pipe(r); }).listen(0);
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const POSES = ['cheer', 'thumbs', 'oops', 'clap', 'think', 'whoa'];
fs.mkdirSync('shots', { recursive: true });
const fails = []; const rows = [];
async function measure(pose) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.goto(BASE + '?round=90&level=medium&teach=quick' + (pose ? `&blaze=${pose}` : ''));
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.locator('#mStart').tap(); await page.waitForFunction(() => window.__kk?.phase === 'play' || document.querySelector('#gQuit')?.offsetParent, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const m = await page.evaluate(async () => {
    const body = document.querySelector('#blazeBody'); const pose = body.querySelector('img.pose'); const base = body.querySelector('img');
    const el = pose && !pose.hidden ? pose : base; const r = el.getBoundingClientRect();
    const img = new Image(); img.src = el.currentSrc || el.src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let l = 1e9, t = 1e9, rr = -1, b = -1;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 16) { if (i < l) l = i; if (i > rr) rr = i; if (y < t) t = y; if (y > b) b = y; }
    const sx = r.width / c.width, sy = r.height / c.height;
    const ink = { left: r.left + l * sx, right: r.left + (rr + 1) * sx, top: r.top + t * sy, bottom: r.top + (b + 1) * sy };
    return { src: (el.currentSrc || el.src).split('/').pop(), nat: [c.width, c.height], box: { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom }, ink, cx: (ink.left + ink.right) / 2,
      bodyT: getComputedStyle(body).transform, poseShown: el === pose, transform: getComputedStyle(el).transform };
  });
  const bb = await page.locator('#blaze').boundingBox();
  const name = `shots/v2-${pose || 'idle'}.png`;
  await page.screenshot({ path: name, clip: { x: Math.max(0, bb.x - 150), y: Math.max(0, bb.y - 30), width: 300, height: bb.height + 70 } });
  if (pose) await page.screenshot({ path: `shots/v2-${pose}-full.png` });
  await page.close(); return { pose: pose || 'idle', ...m, shot: name };
}
const idle = await measure(null);
const f1 = v => Math.round(v * 10) / 10;
for (const p of POSES) {
  const m = await measure(p);
  const d = { box: [m.box.left - idle.box.left, m.box.top - idle.box.top, m.box.width - idle.box.width, m.box.height - idle.box.height].map(f1),
    inkBottom: f1(m.ink.bottom - idle.ink.bottom), inkTop: f1(m.ink.top - idle.ink.top), inkH: f1((m.ink.bottom - m.ink.top) - (idle.ink.bottom - idle.ink.top)), cx: f1(m.cx - idle.cx) };
  rows.push({ ...m, d });
  if (!m.poseShown) fails.push(`${p}: pose not shown`);
  if (d.box.some(v => Math.abs(v) > 0.5)) fails.push(`${p}: layout box moved ${d.box}`);
  if (Math.abs(d.inkBottom) > 1) fails.push(`${p}: feet moved ${d.inkBottom}px`);
  if (d.inkH < -2) fails.push(`${p}: shrinks ${d.inkH}px`);
}
console.log(`idle ${idle.src} nat ${idle.nat} box ${f1(idle.box.left)},${f1(idle.box.top)} ${f1(idle.box.width)}x${f1(idle.box.height)} ink top ${f1(idle.ink.top)} bottom ${f1(idle.ink.bottom)} L ${f1(idle.ink.left)} R ${f1(idle.ink.right)} cx ${f1(idle.cx)} -> ${idle.shot}`);
for (const r of rows) console.log(`${r.pose.padEnd(6)} ${r.src} nat ${r.nat} box Δ(x,y,w,h) ${r.d.box} | ink top ${f1(r.ink.top)} (Δ${r.d.inkTop}) bottom ${f1(r.ink.bottom)} (Δ${r.d.inkBottom}) height Δ${r.d.inkH} L ${f1(r.ink.left)} R ${f1(r.ink.right)} cx Δ${r.d.cx} transform ${r.transform} -> ${r.shot}`);
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ALIGNMENT OK: no pose shrinks or drops vs idle');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
