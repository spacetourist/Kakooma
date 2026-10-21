// v0.3.4 sound pack wiring: node scripts/audio-v034.mjs [baseUrl]. Unlock on first gesture (nothing before), Opus in Chromium,
// AAC fallback (corrupt .ogg) and the AAC path (no Opus support), kk_sfx.* fetched with 200, stopAll on skip cancels sounds
// scheduled ahead, mute toggle (saved, silences everything, uiTap only on unmute), console errors. Shots v034-mute-on/off.png.
// Chrome runs with --autoplay-policy=user-gesture-required, i.e. the real-browser rule (headless otherwise allows autoplay).
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname, SHOTS = new URL('../shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const TAG = process.env.SHOT_TAG || 'v034';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=user-gesture-required'] });
const fails = [], log = [], info = {};
const check = (c, msg) => { (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + msg); };
const INSTR = () => {
  window.__au = { starts: [] };
  const S = AudioBufferSourceNode.prototype.start, P = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (when = 0, off, dur) { this.__id = window.__au.starts.length; window.__au.starts.push({ when, off, dur, now: this.context.currentTime, len: this.buffer ? this.buffer.length : 0, perf: performance.now(), stop: null }); return S.apply(this, arguments); };
  AudioBufferSourceNode.prototype.stop = function (when = 0) { if (this.__id != null && !window.__au.starts[this.__id].stop) window.__au.starts[this.__id].stop = { when, now: this.context.currentTime }; return P.apply(this, arguments); };
};
async function newPage(url, { init = [], route } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const con = [], net = [];
  page.on('console', m => con.push([m.type(), m.text()])); page.on('pageerror', e => con.push(['pageerror', e.message]));
  page.on('response', r => { if (/kk_sfx/.test(r.url())) net.push([r.url().split('/').pop().split('?')[0], r.status()]); });
  await page.addInitScript(INSTR); for (const f of init) await page.addInitScript(f);
  if (route) await page.route(route[0], route[1]);
  await page.goto(url); await page.waitForFunction(() => document.fonts.status === 'loaded');
  return { ctx, page, con, net };
}
const real = s => s.filter(x => x.len > 1); // the unlock plays a 1-sample silent buffer
// ---------- A. normal load: unlock, Opus, network, skip, mute ----------
// headless Chromium on this box does not enforce the autoplay policy (a new AudioContext starts 'running' even with
// --autoplay-policy=user-gesture-required), so emulate the real-browser rule: every new context starts suspended and only
// a resume() (the pack's first-gesture unlock) starts it
const POLICY = () => { const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(o) { super(o); this.suspend(); } }; };
let { ctx, page, con, net } = await newPage(BASE + '?round=600&teach=full&level=medium', { init: [POLICY] });
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const tapEl = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
await kk(() => localStorage.removeItem('kk.mute'));
const d0 = await kk(async () => { const d = await window.__kkAudio.ready; return { ...d, state: window.__kkAudio.state() }; });
await wait(1200);
const pre = await kk(() => ({ state: window.__kkAudio.state(), starts: window.__au.starts.length }));
info.diag = d0;
check(d0.ok && d0.format === 'ogg' && !d0.opusFallback && d0.sprites > 50, `Opus sprite decoded in Chromium (format ${d0.format}, ${d0.sprites} sprites, marker offset ${d0.markerOffsetSamples?.toFixed(3)} samples, init ${Math.round(d0.initMs)} ms)`);
check(d0.state === 'suspended' && pre.state === 'suspended' && pre.starts === 0, `nothing plays before the first gesture (context ${pre.state} under the emulated autoplay policy, ${pre.starts} sources started)`);
await tapEl('#levels [data-lv="hard"]'); await wait(300);
const u1 = await kk(() => ({ state: window.__kkAudio.state(), s: window.__au.starts.map(x => x.len) }));
check(u1.state === 'running' && u1.s[0] === 1, `first gesture unlocks: context ${u1.state}, first source = the 1-sample silent buffer (${JSON.stringify(u1.s)})`);
await tapEl('#levels [data-lv="medium"]'); await wait(200);
const u2 = await kk(() => window.__au.starts.filter(x => x.len > 1).length);
check(u2 >= 1, `after the unlock a level tap plays uiTap (${u2} real sound(s) so far)`);
// skip during the bond stage: pulses/partPops are scheduled ahead with { delay }; stopAll must cancel them all
await kk(() => { const p = { nums: [7, 12, 19, 4, 2], a: 7, b: 12, answer: 19 }; window.__kkNext = [p, p]; });
await tapEl('#mStart'); await page.waitForFunction(() => window.__kk.phase === 'play'); await wait(400);
const nStart = await kk(() => window.__au.starts.length);
const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer));
await tapEl(`.tile[data-i="${i}"]`);
await page.waitForFunction(() => window.__kk.teachStage === 'bond', null, { timeout: 15000 }); await wait(150);
const atSkip = await kk(() => window.__kkAudio.diag && (window.__au.ctxNow = null, null));
const before = await kk(() => { const c = window.__au.starts; return { n: c.length }; });
await page.touchscreen.tap(195, 600);
await page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 2000 }); await wait(150);
const sk = await kk(n0 => { const s = window.__au.starts.slice(n0), log = window.__sfxLog || [];
  const stopAt = s.map(x => x.stop).filter(Boolean).map(x => x.now); const tSkip = Math.min(...(stopAt.length ? stopAt : [Infinity]));
  const ahead = s.filter(x => x.when > tSkip + 0.01), playing = s.filter(x => x.when <= tSkip && x.when + (x.dur ?? 0) > tSkip);
  return { lesson: s.filter(x => x.len > 1).length, tSkip, ahead: ahead.length, aheadStopped: ahead.filter(x => x.stop && x.stop.when <= tSkip + 0.1).length, playing: playing.length, playingStopped: playing.filter(x => x.stop && x.stop.when <= tSkip + 0.1).length }; }, nStart);
info.skip = sk;
check(sk.lesson >= 19 && sk.ahead >= 3 && sk.aheadStopped === sk.ahead && sk.playingStopped === sk.playing, `skip in the bond stage: stopAll cancels ${sk.aheadStopped}/${sk.ahead} sounds scheduled ahead and ${sk.playingStopped}/${sk.playing} still playing, within 100 ms (${sk.lesson} lesson sounds had started)`);
// mute
await tapEl('#gQuit'); await page.waitForFunction(() => document.getElementById('play').dataset.mode === 'menu'); await wait(500);
await page.screenshot({ path: `${SHOTS}${TAG}-mute-on.png` });
const m0 = await kk(() => window.__au.starts.length);
await tapEl('#mMute'); await wait(300);
await page.screenshot({ path: `${SHOTS}${TAG}-mute-off.png` });
const m1 = await kk(() => { const b = document.getElementById('mMute'), r = b.getBoundingClientRect(), bl = document.getElementById('blaze').getBoundingClientRect(), cs = getComputedStyle(b);
  return { off: b.classList.contains('off'), ls: localStorage.getItem('kk.mute'), aria: b.getAttribute('aria-pressed'), w: r.width, h: r.height, bg: cs.backgroundColor, radius: cs.borderRadius, leftOfBlaze: r.right <= bl.left + 8, x: getComputedStyle(b.querySelector('.x')).display, wave: getComputedStyle(b.querySelector('.wave')).display, spk: getComputedStyle(b.querySelector('.spk')).fill }; });
const m1s = await kk(n => window.__au.starts.slice(n).filter(x => x.len > 1).length, m0);
check(m1.off && m1.ls === '1' && m1.aria === 'true' && m1s === 0, `mute: saved (kk.mute=${m1.ls}), no uiTap on muting (${m1s} sounds)`);
check(m1.w === 40 && m1.h === 40 && m1.bg === 'rgb(255, 255, 255)' && m1.radius === '50%' && m1.leftOfBlaze && m1.x !== 'none' && m1.wave === 'none' && m1.spk === 'rgb(138, 144, 168)', `mute button: 40 px white round, left of Blaze; off = grey speaker crossed out ${JSON.stringify(m1)}`);
await kk(() => { const p = { nums: [7, 12, 19, 4, 2], a: 7, b: 12, answer: 19 }; window.__kkNext = [p, p]; });
const m2a = await kk(() => window.__au.starts.length);
await tapEl('#mStart'); await page.waitForFunction(() => window.__kk.phase === 'play'); await wait(300);
await tapEl(`.tile[data-i="${await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer))}"]`);
await page.waitForFunction(() => window.__kk.teachStage === 'counted', null, { timeout: 15000 });
const m2 = await kk(n => ({ snd: window.__au.starts.slice(n).filter(x => x.len > 1).length, hooks: (window.__sfxLog || []).length }), m2a);
check(m2.snd === 0, `while muted a round start, taps and a whole count play nothing (${m2.snd} sounds)`);
await page.touchscreen.tap(195, 600); await wait(300); await tapEl('#gQuit'); await wait(400);
// reload: still muted; unmute as the very first gesture of the session -> uiTap once the context runs
await page.reload(); await page.waitForFunction(() => document.fonts.status === 'loaded'); await kk(async () => { await window.__kkAudio.ready; });
const r0 = await kk(() => ({ off: document.getElementById('mMute').classList.contains('off'), diagMuted: window.__kkAudio.diag().muted }));
await tapEl('#mMute'); await wait(400);
const r1 = await kk(() => ({ off: document.getElementById('mMute').classList.contains('off'), ls: localStorage.getItem('kk.mute'), snd: window.__au.starts.filter(x => x.len > 1).length, state: window.__kkAudio.state() }));
check(r0.off && r0.diagMuted && !r1.off && r1.ls === '0' && r1.snd === 1, `reload keeps it muted; unmuting (first gesture) plays exactly one uiTap (${r1.snd}, context ${r1.state})`);
info.netA = net;
check(net.some(([f, s]) => f === 'kk_sfx.json' && s === 200) && net.some(([f, s]) => f === 'kk_sfx.ogg' && s === 200) && !net.some(([f]) => f === 'kk_sfx.m4a'), 'kk_sfx.json + kk_sfx.ogg fetched with 200 (no .m4a in Chromium) ' + JSON.stringify(net));
const errsA = con.filter(([t]) => t === 'error' || t === 'pageerror'); info.warningsA = con.filter(([t]) => t === 'warning').map(x => x[1]);
check(errsA.length === 0, 'no console errors ' + JSON.stringify(errsA.slice(0, 3)));
await ctx.close();
// ---------- B. Opus decode fails (corrupt .ogg) -> AAC fallback ----------
({ ctx, page, con, net } = await newPage(BASE, { route: ['**/kk_sfx.ogg', r => r.fulfill({ status: 200, contentType: 'audio/ogg', body: Buffer.from('OggS' + 'x'.repeat(4000)) })] }));
let d = await page.evaluate(async () => await window.__kkAudio.ready);
await page.locator('#levels [data-lv="hard"]').tap(); await page.waitForTimeout(300); await page.locator('#levels [data-lv="medium"]').tap(); await page.waitForTimeout(200);
let snd = await page.evaluate(() => window.__au.starts.filter(x => x.len > 1).length);
check(d.ok && d.format === 'm4a' && /Error/.test(d.opusFallback || '') && net.some(([f, s]) => f === 'kk_sfx.m4a' && s === 200) && snd >= 1, `corrupt Opus -> AAC fallback: format ${d.format}, opusFallback "${(d.opusFallback || '').slice(0, 40)}", m4a 200, sound plays (${snd})`);
info.errorsB = con.filter(([t]) => t === 'error' || t === 'pageerror').map(x => x[1]);
await ctx.close();
// ---------- C. no Opus support (Safari/iOS path) -> AAC directly ----------
({ ctx, page, con, net } = await newPage(BASE, { init: [() => { const o = HTMLMediaElement.prototype.canPlayType; HTMLMediaElement.prototype.canPlayType = function (t) { return /ogg|opus/.test(t) ? '' : o.call(this, t); }; }] }));
d = await page.evaluate(async () => await window.__kkAudio.ready);
await page.locator('#levels [data-lv="hard"]').tap(); await page.waitForTimeout(300); await page.locator('#levels [data-lv="medium"]').tap(); await page.waitForTimeout(200);
snd = await page.evaluate(() => window.__au.starts.filter(x => x.len > 1).length);
check(d.ok && d.format === 'm4a' && !d.opusFallback && !net.some(([f]) => f === 'kk_sfx.ogg') && snd >= 1 && !con.some(([t]) => t === 'error' || t === 'pageerror'), `no Opus support -> AAC directly (format ${d.format}, no .ogg request, sound plays: ${snd}, marker offset ${d.markerOffsetSamples?.toFixed(3)})`);
await ctx.close();
console.log(log.join('\n')); if (fails.length) console.log(fails.join('\n'));
console.log('INFO ' + JSON.stringify(info));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V034 AUDIO CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
