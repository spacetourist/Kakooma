// v0.1.3 live check: play rounds with many solves and assert the tray has no duplicate sums.
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const BASE = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = []; page.on('pageerror', e => errs.push(e.message));
const kk = f => page.evaluate(f), wait = ms => page.waitForTimeout(ms);
const tap = async sel => { const bb = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
await page.goto(BASE + '?level=hard&teach=quick&round=120'); await kk(() => localStorage.clear()); await page.reload();
console.log('version', await page.textContent('#verLabel'));
let ok = true;
for (const n of [4, 7]) {
  await tap(`#picker [data-n="${n}"]`); await wait(350); await tap('#mStart');
  for (let k = 0; k < 60; k++) { await page.waitForFunction(() => window.__kk.phase === 'play'); await wait(30); await tap(`.tile[data-i="${await kk(() => window.__kk.puzzle.nums.indexOf(window.__kk.puzzle.answer))}"]`); }
  await wait(100);
  const chips = await kk(() => [...document.querySelectorAll('#tray .chip')].map(c => c.textContent));
  const keys = chips.map(c => { const [a, b] = c.split('=')[0].split('+').map(Number); return `${Math.min(a, b)}+${Math.max(a, b)}`; });
  const dup = keys.length - new Set(keys).size;
  console.log(`N=${n}: ${chips.length} chips, ${dup} duplicates; seen=${await kk(() => window.__kk.seen.size)}`);
  if (dup || chips.length !== 60) ok = false;
  if (n === 4) await page.screenshot({ path: new URL('../shots/v013-tray-n4.png', import.meta.url).pathname });
  await tap('#gQuit'); await wait(150);
}
console.log(ok && !errs.length ? 'NO DUPLICATES - PASS' : 'FAIL', errs);
await b.close(); process.exit(ok && !errs.length ? 0 : 1);
