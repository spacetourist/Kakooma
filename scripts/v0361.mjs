// v0.3.6.1 (GD + AE): node scripts/v0361.mjs [baseUrl]. A new #1 on the results screen (.rblaze.cool) shows Blaze in his
// cheer pose image (the in-game cheer asset) with the same hop loop, and plays NO blaze_* sound (visual only; newBest
// plays for the #1): checked both in the hook log and at the audio source level (sources matched to kk_sfx.json sprites)
// over several hop cycles. A non-#1 keeps the idle image. No sunglasses anywhere; x20 = biggest size only. Shots:
// shots/v0361-top1.png, shots/v0361-x20.png.
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
const fails = [], log = []; const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
const json = await (await fetch(BASE + 'audio/kk_sfx.json')).json(), SR = json.sampleRate;
const sprite = off => { let best = '?', d = 1e9; for (const [k, v] of Object.entries(json.sprites)) { const dd = Math.abs(off * SR - v.start); if (dd < d) { d = dd; best = k; } } return d < 0.01 * SR ? best : '?'; };
const DPR = +(process.env.DPR || 2); // DPR=3: crispness shots
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(() => { window.__sfxLog = []; window.__au = []; const S = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, off = 0) { if (this.buffer && this.buffer.length > 1) window.__au.push([performance.now(), off]); return S.apply(this, arguments); }; });
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const tapEl = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const waitPlay = () => page.waitForFunction(() => window.__kk.phase === 'play' && !window.__kk.teach, null, { timeout: 20000 });
async function round(solves, start = true) {
  if (start) await tapEl('#mStart'); await waitPlay();
  for (let k = 0; k < solves; k++) { await wait(400); await waitPlay(); const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); }
  await page.waitForFunction(() => window.__kk.phase === 'done', null, { timeout: 20000 });
}
const R = () => kk(() => { const b = document.getElementById('rBlaze'), img = b.querySelector('img');
  return { cool: b.classList.contains('cool'), img: img.getAttribute('src').split('/').pop(), decoded: img.complete && img.naturalWidth > 0, nat: [img.naturalWidth, img.naturalHeight], anim: getComputedStyle(b.querySelector('.blaze-body')).animationName, shades: document.querySelectorAll('.shades').length }; });
await page.goto(BASE + '?round=8&teach=quick&level=medium'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(() => { localStorage.clear(); }); await page.reload(); await page.waitForFunction(() => document.fonts.status === 'loaded'); await wait(300);
// 1. first ever score -> new #1
await round(3);
const tEnd = await kk(() => performance.now()); // (polled after phase 'done': timeUp/newBest fired up to ~1 poll earlier, hence the 1 s look-back; the round's last solve was > 1 s before)
await wait(4200); // ~3 hop cycles (1.3 s each)
let r = await R();
const s1 = await kk(t => ({ hooks: window.__sfxLog.filter(e => e[2] >= t - 1000).map(e => e[0] + (e[3] ? ':' + e[3] : '')), au: window.__au.filter(a => a[0] >= t - 1000).map(a => a[1]) }), tEnd);
const sp = s1.au.map(sprite);
if (process.env.DBG || !sp.includes('newBest')) console.log('debug', JSON.stringify(await kk(t => ({ t, au: window.__au.map(a => [Math.round(a[0]), a[1]]), log: window.__sfxLog.map(e => [e[0], Math.round(e[2])]).slice(-12), diag: window.__kkAudio?.diag?.() }), tEnd)), s1.au.length);
{ const d = await kk(() => { const i = document.querySelector('#rBlaze img'), b = i.getBoundingClientRect(); return { cssW: b.width, cssH: b.height, nat: i.naturalWidth, dpr: devicePixelRatio }; });
  check(d.nat >= d.cssW * d.dpr - 1, `results cheer pose sharp at DPR ${d.dpr}: ${d.nat} px source for ${d.cssW.toFixed(1)} css px (needs ${Math.round(d.cssW * d.dpr)})`); }
check(r.cool && r.img === 'cheer.webp' && r.decoded && r.anim === 'rhop' && r.shades === 0, `new #1: Blaze in the cheer pose (${r.img}, ${r.nat}), hop loop ${r.anim}, no sunglasses`);
check(!s1.hooks.some(h => h.startsWith('blaze')) && !sp.some(k => k.startsWith('blaze_')) && sp.includes('newBest') && sp.includes('timeUp'), `new #1 results: no blaze() call and no blaze_* sound over ~3 hops; sounds: ${sp.join(', ')} (ctx ${await kk(() => window.__kkAudio?.state())}, ${await kk(() => window.__au.length)} sources in all)`);
await page.screenshot({ path: `${SHOTS}v0361-top1.png` });
for (const c of 'KID') { await tapEl(`#nameIn`).catch(() => {}); await page.keyboard.type(c); }
await tapEl('#nameSave').catch(() => {}); await wait(300);
// 2. not a #1 (one solve < 3): idle image, bob
await tapEl('#bRetry').catch(async () => { await tapEl('#rRetry'); }); await wait(200);
await round(1, false); await wait(600);
r = await R();
check(!r.cool && r.img === 'blaze.png' && r.anim === 'bob', `not a #1: idle Blaze image (${r.img}), bobbing (${r.anim})`);
// 3. x20 in game: biggest size (tier 3, scale 1.25), no sunglasses. Shot: shots/v0361-x20.png
await page.goto(BASE + '?round=600&teach=quick&level=easy'); await page.waitForFunction(() => document.fonts.status === 'loaded'); await wait(300);
await tapEl('#mStart'); await waitPlay();
for (let k = 0; k < 20; k++) { await wait(150); await waitPlay(); const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); }
await waitPlay(); await wait(1200); // past the x20 hop and any reaction (pose reverts after 0.9 s)
const z = await kk(() => ({ streak: window.__kk.streak, tier: document.getElementById('blaze').dataset.tier, scale: getComputedStyle(document.querySelector('#blaze .blaze-scale')).transform, img: document.querySelector('#blazeBody img').getAttribute('src').split('/').pop(), shades: document.querySelectorAll('.shades, svg.shades').length, pill: document.getElementById('streakPill').textContent }));
check(z.streak === 20 && z.tier === '3' && /matrix\(1\.25,/.test(z.scale) && z.shades === 0, `x20: Blaze at his biggest size (tier ${z.tier}, ${z.scale}), no sunglasses (${z.shades}), pill ${z.pill}`);
{ const b = await page.locator('header.top').boundingBox(); await page.screenshot({ path: `${SHOTS}v0361-x20.png`, clip: { x: 0, y: b.y, width: 390, height: b.height + 30 } }); }
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log([...log, ...fails].join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V0361 CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
