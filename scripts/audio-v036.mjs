// v0.3.6 sound pack v03 wiring: node scripts/audio-v036.mjs [baseUrl]. Real playback (AudioBufferSourceNode.start is
// instrumented and each source is matched to its sprite via kk_sfx.json): link() starts with the connect-beat lines
// (lineAt 0.1 s), blaze(pose) is called on the pose-swap frame and sounds BLAZE_OFFSET later (100 ms; think 0), every
// blaze_* / link sprite key exists, and mute silences everything (no real source starts while muted).
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const ROOT = new URL('../dist', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kakooma/, '') || '/'; if (p === '/') p = '/index.html'; const f = join(ROOT, p); if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = process.argv[2] || `http://127.0.0.1:${server.address().port}/Kakooma/`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const fails = [], log = [], rows = [];
const check = (c, m) => (c ? log : fails).push((c ? 'ok   ' : 'FAIL ') + m);
const INSTR = () => {
  window.__au = []; window.__sfxLog = [];
  const S = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, off = 0, dur) { const now = this.context.currentTime, perf = performance.now();
    window.__au.push({ off, len: this.buffer ? this.buffer.length : 0, at: perf + (Math.max(when, now) - now) * 1000 }); return S.apply(this, arguments); };
};
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(INSTR);
const json = await (await fetch(BASE + 'audio/kk_sfx.json')).json();
const SR = json.sampleRate, SP = json.sprites;
for (const k of ['link', 'blaze_cheer', 'blaze_thumbs', 'blaze_oops', 'blaze_clap', 'blaze_think', 'blaze_whoa']) check(SP[k] && SP[k].length > 0, `sprite key ${k} in kk_sfx.json (${SP[k] ? (SP[k].length / SR * 1000).toFixed(0) + ' ms' : 'missing'})`);
const name = off => { let best = null, d = 1e9; for (const [k, v] of Object.entries(SP)) { const dd = Math.abs(off * SR - v.start); if (dd < d) { d = dd; best = k; } } return d < 0.01 * SR ? best : '?'; };
const kk = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const tapEl = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const waitPlay = () => page.waitForFunction(() => window.__kk.phase === 'play', null, { timeout: 15000 });
const right = async () => { await waitPlay(); const i = await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer)); await tapEl(`.tile[data-i="${i}"]`); return kk(() => performance.now()); };
const wrong = async () => { await waitPlay(); const i = await kk(() => { const p = window.__kk.puzzle; return p.nums.findIndex((v, j) => v !== p.answer && !window.__kk.badTiles.has(j)); }); await tapEl(`.tile[data-i="${i}"]`); };
// the line-draw moment of the current connect beat: each line's animation start + lineAt (its keyframes are opacity 0 until then)
const lineAt = () => kk(() => { const a = document.getAnimations().filter(x => x.effect?.target?.tagName === 'line'); return a.length ? a[0].startTime + 100 : null; });

await page.goto(BASE + '?round=600&teach=quick&level=medium'); await page.waitForFunction(() => document.fonts.status === 'loaded');
await kk(() => localStorage.removeItem('kk.mute'));
const diag = await kk(async () => window.__kkAudio.ready);
check(diag.ok && diag.sprites === Object.keys(SP).length, `pack decoded: ${diag.format}, ${diag.sprites} sprites (json ${json.version}, ${Object.keys(SP).length})`);
await tapEl('#levels [data-lv="medium"]'); await wait(300);
await tapEl('#mStart'); await waitPlay(); await wait(500);
const links = [];
// round 1: wrong -> oops; comeback -> thumbs; two more -> streak 3 cheer on the shower's first burst; one more; idle -> think.
// round 2 (speedy threshold back to the game's 2 s): solves 1-3 build the 1-in-3 budget back up (3 = streak cheer), 4 -> whoa.
// Round 1 runs with the threshold off (window.__kkSpeedyMs = 0) so the scripted fast taps don't spend the budget on whoa.
const R1 = async () => { await right(); await wait(150); links.push(await lineAt()); };
await kk(() => { window.__kkSpeedyMs = 0; });
await wrong(); await wait(1300);
await R1(); await wait(1300); await R1(); await wait(1300); await R1(); await wait(2600); await R1(); await wait(1300);
await waitPlay(); await wait(9000);
await tapEl('#gQuit'); await page.waitForFunction(() => document.getElementById('play').dataset.mode === 'menu'); await wait(500);
await kk(() => { delete window.__kkSpeedyMs; });
await tapEl('#mStart'); await waitPlay(); await wait(500);
await R1(); await wait(1300); await R1(); await wait(1300); await R1(); await wait(2600); await R1(); await wait(1500);
const R = await kk(() => ({ au: window.__au.filter(x => x.len > 1), log: window.__sfxLog, bz: window.__kkBlaze }));
const au = R.au.map(x => ({ ...x, k: null }));
const audio = R.au.map(x => ({ at: x.at, k: null, off: x.off })); audio.forEach(x => x.k = name(x.off));
const f1 = v => v == null ? '-' : Math.round(v * 10) / 10;
// link: logged call (rAF after the tap, delay 0.1) vs the lines' draw start vs the real source start
const linkLog = R.log.filter(e => e[0] === 'link'), linkAu = audio.filter(x => x.k === 'link');
check(linkLog.length === 8 && linkAu.length === 8, `link once per correct tap: ${linkLog.length} calls, ${linkAu.length} link sources`);
linkLog.forEach((e, i) => { const a = linkAu[i], L = links[i], c = R.log.filter(x => x[0] === 'correct')[i];
  rows.push(['link', i + 1, f1(c?.[2]), f1(L), f1(e[2]), f1(a?.at), f1(a && L ? a.at - L : null)]);
  check(a && L && Math.abs(a.at - L) <= 20, `link #${i + 1} sounds with the lines (sound - lines ${f1(a?.at - L)} ms, sound - correct ${f1(a?.at - c?.[2])} ms)`); });
// blaze: pose frame (__kkBlaze) = logged call; sound = frame + BLAZE_OFFSET
const OFF = { cheer: 100, thumbs: 100, oops: 100, clap: 100, think: 0, whoa: 100 };
const bzLog = R.log.filter(e => e[0] === 'blaze');
check(['whoa', 'oops', 'thumbs', 'cheer', 'think'].every(p => bzLog.some(e => e[3] === p)), `blaze fired for whoa, oops, thumbs, cheer, think (${bzLog.map(e => e[3])})`);
for (const e of bzLog) { const p = e[3], frame = R.bz.find(b => b[0] === p && Math.abs(b[1] - e[2]) < 20)?.[1], a = audio.find(x => x.k === 'blaze_' + p && x.at >= e[2] - 5 && x.at <= e[2] + 300);
  const cue = p === 'cheer' ? R.log.find(x => x[0] === 'streak' && Math.abs(x[2] - e[2]) < 20) ?? R.log.filter(x => x[0] === 'correct' && x[2] < e[2]).at(-1) : R.log.filter(x => x[0] === (p === 'oops' ? 'wrong' : 'correct') && x[2] <= e[2]).at(-1);
  rows.push(['blaze ' + p, '', f1(cue?.[2]), f1(frame), f1(e[2]), f1(a?.at), f1(a ? a.at - e[2] : null)]);
  check(frame != null && Math.abs(frame - e[2]) <= 1, `blaze(${p}) called on the pose-swap frame (call - swap ${f1(e[2] - frame)} ms)`);
  check(a && Math.abs(a.at - e[2] - OFF[p]) <= 12, `blaze_${p} sounds ${f1(a?.at - e[2])} ms after the swap (offset ${OFF[p]} ms, added once by the pack)`); }
// mute: no real source starts at all while muted, through a correct, a wrong, a comeback and a reaction
await tapEl('#gQuit'); await page.waitForFunction(() => document.getElementById('play').dataset.mode === 'menu'); await wait(500);
await tapEl('#mMute'); await wait(300);
const m0 = await kk(() => ({ n: window.__au.filter(x => x.len > 1).length, l: window.__sfxLog.length, ls: localStorage.getItem('kk.mute') }));
await tapEl('#mStart'); await waitPlay(); await wait(400);
await right(); await wait(1300); await wrong(); await wait(1300); await right(); await wait(1500);
const m1 = await kk(() => ({ n: window.__au.filter(x => x.len > 1).length, calls: window.__sfxLog.slice(0).map(e => e[0]) }));
const mutedCalls = m1.calls.slice(m0.l);
check(m0.ls === '1' && m1.n === m0.n && mutedCalls.includes('link') && mutedCalls.includes('blaze'), `muted: ${mutedCalls.length} hook calls (incl. link, blaze ${mutedCalls.filter(x => x === 'blaze').length}x) and 0 sources started (${m1.n - m0.n})`);
await tapEl('#gQuit'); await wait(500); await tapEl('#mMute'); await wait(300); await kk(() => localStorage.removeItem('kk.mute'));
check(errs.length === 0, 'no console errors ' + JSON.stringify(errs));
console.log('event | # | cue (correct/wrong/streak) ms | lines draw / pose swap ms | hook call (logged) ms | sound starts ms | sound - lines/swap ms');
for (const r of rows) console.log(r.join(' | '));
console.log([...log, ...fails].join('\n'));
console.log(fails.length ? `${fails.length} FAILED` : 'ALL V036 AUDIO CHECKS PASSED');
await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
