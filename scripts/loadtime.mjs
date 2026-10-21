// First-load timing: node scripts/loadtime.mjs <url> [runs=7]. Fresh context per run (cold cache), 390x844 DPR 2 mobile,
// two network profiles: unthrottled and "4G-ish" (9 Mb/s down, 1.5 Mb/s up, 60 ms RTT). Prints medians as JSON.
const { chromium } = await import('/tmp/pw/node_modules/playwright-core/index.mjs');
const URL_ = process.argv[2], RUNS = +(process.argv[3] || 7);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=user-gesture-required'] });
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = {};
for (const [prof, net] of [['fast', null], ['4g', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }]]) {
  const rs = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (net) await cdp.send('Network.emulateNetworkConditions', net);
    let bytes = 0, audioBytes = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
    const audioReq = new Set(); cdp.on('Network.requestWillBeSent', e => { if (/kk_sfx/.test(e.request.url)) audioReq.add(e.requestId); });
    cdp.on('Network.loadingFinished', e => { if (audioReq.has(e.requestId)) audioBytes += e.encodedDataLength; });
    await page.goto(URL_ + '?cb=' + Date.now() + i, { waitUntil: 'load' });
    // "menu ready" = fonts loaded and the preview board laid out, measured in-page from navigation start
    const t = await page.evaluate(async () => {
      await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const n = performance.getEntriesByType('navigation')[0], fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd || performance.now(), fcp: fcp ? fcp.startTime : null, ready: performance.now() };
    });
    await page.waitForTimeout(net ? 2500 : 1200); // let any deferred (post-load) fetches finish, for the byte count
    t.audioReady = await page.evaluate(async () => { const a = window.__kkAudio; if (!a) return null; const d = await a.ready; return d.ok ? Math.round(performance.getEntriesByType('resource').filter(r => /kk_sfx\.(ogg|m4a)/.test(r.name)).map(r => r.responseEnd)[0] || 0) : -1; });
    t.kb = Math.round(bytes / 1024); t.audioKb = Math.round(audioBytes / 1024);
    rs.push(t); await ctx.close();
  }
  out[prof] = Object.fromEntries(Object.keys(rs[0]).map(k => [k, rs[0][k] == null ? null : Math.round(med(rs.map(r => r[k])))]));
}
console.log(JSON.stringify({ url: URL_, runs: RUNS, ...out }));
await browser.close();
