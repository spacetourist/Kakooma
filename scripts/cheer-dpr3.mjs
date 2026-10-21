// v0.3.6.2: in-game cheer pose at DPR 3 (crispness): node scripts/cheer-dpr3.mjs [baseUrl] -> shots/v0362-cheer-dpr3.png
// (header crop) + a 4x nearest-neighbour zoom of Blaze, shots/v0362-cheer-dpr3-zoom.png; checks source px >= css px x 3.
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
await page.goto(BASE + '?round=90&level=medium&teach=quick&blaze=cheer'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await page.locator('#mStart').tap(); await page.waitForTimeout(1500);
const d = await page.evaluate(() => { const i = document.querySelector('#blazeBody img.pose'), b = i.getBoundingClientRect(); return { src: i.getAttribute('src').split('/').pop(), hidden: i.hidden, cssW: b.width, nat: i.naturalWidth, dpr: devicePixelRatio }; });
const hb = await page.locator('header.top').boundingBox(), bb = await page.locator('#blaze').boundingBox();
await page.screenshot({ path: `${SHOTS}v0362-cheer-dpr3.png`, clip: { x: 0, y: hb.y, width: 390, height: hb.height + 30 } });
await page.screenshot({ path: `${SHOTS}v0362-cheer-dpr3-blaze.png`, clip: { x: bb.x - 6, y: bb.y, width: bb.width + 12, height: bb.height } });
const ok = d.src === 'cheer.webp' && !d.hidden && d.nat >= d.cssW * d.dpr - 1;
console.log(JSON.stringify(d)); console.log(ok ? `ok   in-game cheer sharp at DPR 3: ${d.nat} px source for ${d.cssW} css px (needs ${Math.round(d.cssW * 3)})` : 'FAIL in-game cheer not sharp at DPR 3');
await browser.close(); server.close(); process.exit(ok ? 0 : 1);
