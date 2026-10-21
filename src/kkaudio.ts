// kkaudio.ts: Kakooma sound pack v02c (v0.3.2 counting + total()). Plain Web Audio, no dependencies. See AUDIO.md.
// RULES: audio never drives game timing; every call is synchronous, cheap and never throws.
// If anything fails (no Web Audio, fetch/decode error, locked context) the game simply stays silent.

export type Bus = 'master' | 'sfx' | 'ui';
export interface InitOptions {
  /** folder holding kk_sfx.json/.ogg/.m4a, e.g. import.meta.env.BASE_URL + 'audio/' */
  base?: string;
  /** force a format (tests). Default: Opus if canPlayType says so, else AAC; Opus decode failure falls back to AAC */
  format?: 'ogg' | 'm4a';
  /** use an existing context (e.g. OfflineAudioContext in tests) */
  context?: BaseAudioContext;
  /** count(i) pitch: 'wrap' (default since v02b; i % 10 -> C5..A6, restarting every ten) or 'plateau' (min(i, 9): stays on A6) */
  countMode?: 'wrap' | 'plateau';
  /** arm the first-gesture unlock on document (default true) */
  autoUnlock?: boolean;
}
export interface Diagnostics {
  ok: boolean; error?: string; format?: string; opusFallback?: string; sampleRate?: number; state?: string;
  markerFound?: boolean; markerScore?: number; markerOffsetSamples?: number; initMs?: number; sprites?: number; muted?: boolean;
  volumes?: Record<Bus, number>;
}
/** when: absolute AudioContext time; delay: seconds from now (ignored if when is set); gainDb: extra trim */
export interface PlayOpts { when?: number; delay?: number; gainDb?: number }
interface Sprite { off: number; dur: number }
interface Voice { src: AudioBufferSourceNode; g: GainNode; start: number; end: number; group?: string; name: string }
interface Meta { sampleRate: number; files: { ogg: string; m4a: string }; marker: { start: number; length: number; freq: number; amp: number; sampleRate: number }; sprites: Record<string, { start: number; length: number }> }

const BUS_DEFAULTS: Record<Bus, number> = { master: 1, sfx: 1, ui: 0.8 };
/** per-sound runtime trims (dB) on top of the baked levels; tune here without rebuilding the sprite */
export const TRIM_DB: Record<string, number> = {};
const UI_SOUNDS = new Set(['uiTap', 'slide']);
/** one voice at a time per group: a newer call fades the older one out (8 ms) */
const GROUP_OF: Record<string, string> = {
  wrong: 'wrong', penalty: 'penalty', cheer: 'cheer', star: 'cheer', streak: 'cue', newBest: 'cue', timeUp: 'cue', lowTime: 'cue', roundStart: 'cue',
  replay: 'replay', bond: 'bond', clear: 'bond', quizStart: 'cue2',
};
/** minimum spacing per family (s); calls inside the window are dropped (rapid-fire hooks) */
const MIN_GAP: Record<string, number> = { slide: 0.035, count: 0.024, tick: 0.2, uiTap: 0.03, tap: 0.025 };
/** polyphony cap per family (oldest is faded out) */
const MAX_POLY: Record<string, number> = { count: 4, slide: 3, tap: 3 };
const MAX_VOICES = 24;
/** count(i) pacing (v02b). Dots closer together than fastGap (110 ms) are "fast": every dot still plays (so the last one
 *  always sounds), but each is shortened to lenFrac of the gap (never below minLen) with a short fade, ducked by up to duckDb
 *  (reached at minGapRef), and alternate dots (odd i, except 10ths) become ghost notes ghostDb quieter. That halves the
 *  number of strong hits per second (14/s -> 9/s at 60 ms) so a Hard run reads as a fast climb, not a buzz. Every 10th dot
 *  (i % 10 == 9) also plays the 'countTen' accent. Measured choice: see CHANGES.md. Tunable at runtime. */
export const COUNT_PACE = {
  fastGap: 0.11, lenFrac: 0.8, minLen: 0.045, fade: 0.012, duckDb: -3, minGapRef: 0.06,
  /** 'ghost' (default) | 'shorten' (no ghosting) | 'skip' (alternate dots silent; the last dot may be skipped) | 'none' */
  thin: 'ghost' as 'shorten' | 'ghost' | 'skip' | 'none', ghostDb: -8,
  tenAccent: true, tenAccentFast: true,
};
const db2 = (d: number) => Math.pow(10, d / 20);

/** v0.2.3 bond timing (seconds after the answer reaches the top). Configurable; used by scheduleBond(). */
export const BOND_TIMING = { partPop: [0.34, 0.58], cheer: 0.8, pulse: [1.0, 1.6, 2.2], clear: 3.3, playClear: false };

interface State {
  ctx: BaseAudioContext; own: boolean; buses: Record<Bus, GainNode>; vols: Record<Bus, number>; muted: boolean; paused: boolean;
  limiter: WaveShaperNode; buf?: AudioBuffer; sprites: Record<string, Sprite>; voices: Voice[]; last: Record<string, number>;
  diag: Diagnostics; countMode: 'wrap' | 'plateau'; countSeq: number; offUnlock?: () => void;
  cPrev: number; cT: number;   // last count(i) index + its start time (pace detection)
}
let S: State | null = null;

export function pickFormat(): 'ogg' | 'm4a' {
  try { const a = document.createElement('audio'); return a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a'; } catch { return 'm4a'; }
}

// zero-latency soft ceiling: linear to -3 dBFS, tanh knee to a -1 dBFS ceiling (no look-ahead, nothing added to the tap path)
function makeLimiter(ctx: BaseAudioContext): WaveShaperNode {
  const ws = ctx.createWaveShaper(), n = 8193, curve = new Float32Array(n);
  const T = db2(-3), C = db2(-1), K = C - T;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
    curve[i] = Math.sign(x) * (ax <= T ? ax : T + K * Math.tanh((ax - T) / K));
  }
  ws.curve = curve; ws.oversample = 'none';
  return ws;
}

// sync marker (2 ms Hann-windowed 2 kHz burst before the first sprite): cross-correlate to correct decoder offsets
function findMarker(buf: AudioBuffer, mk: Meta['marker']): { offsetSec: number; score: number; ok: boolean } {
  const sr = buf.sampleRate, ratio = sr / mk.sampleRate, d = buf.getChannelData(0);
  const n = Math.max(8, Math.round(mk.length * ratio)), tpl = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    tpl[i] = mk.amp * 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1))) * Math.sin(2 * Math.PI * mk.freq * (i / ratio - (mk.length - 1) / 2) / mk.sampleRate);
  }
  let e = 0; for (let i = 0; i < n; i++) e += tpl[i] * tpl[i];
  const expect = Math.round(mk.start * ratio), R = Math.round(240 * ratio), sc: Record<number, number> = {};
  let best = -Infinity, bi = expect;
  for (let s = Math.max(0, expect - R); s <= Math.min(d.length - n, expect + R); s++) {
    let c = 0; for (let i = 0; i < n; i++) c += d[s + i] * tpl[i];
    sc[s] = c; if (c > best) { best = c; bi = s; }
  }
  let frac = 0; const a = sc[bi - 1], b = sc[bi], c = sc[bi + 1];
  if (a !== undefined && c !== undefined) { const den = a - 2 * b + c; if (den) frac = 0.5 * (a - c) / den; }
  const score = e ? best / e : 0;
  return score < 0.5 ? { offsetSec: 0, score, ok: false } : { offsetSec: (bi + frac - expect) / sr, score, ok: true };
}

async function loadBuf(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  const ab = await r.arrayBuffer();
  // callback form too: older iOS Safari has no promise-returning decodeAudioData
  return await new Promise<AudioBuffer>((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && typeof p.then === 'function') p.then(res, rej); });
}

/** Fetch + decode the sprite once at startup. Resolves with diagnostics; never rejects. */
export async function init(opts: InitOptions = {}): Promise<Diagnostics> {
  let st: State | null = null;
  try {
    if (S) dispose();
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let ctx = opts.context;
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return { ok: false, error: 'no Web Audio' };
      try { ctx = new AC({ latencyHint: 'interactive' }) as AudioContext; } catch { ctx = new AC() as AudioContext; }
    }
    const limiter = makeLimiter(ctx); limiter.connect(ctx.destination);
    const master = ctx.createGain(); master.connect(limiter);
    const sfxB = ctx.createGain(), uiB = ctx.createGain(); sfxB.connect(master); uiB.connect(master);
    st = { ctx, own: !opts.context, buses: { master, sfx: sfxB, ui: uiB }, vols: { ...BUS_DEFAULTS }, muted: false, paused: false, limiter,
      sprites: {}, voices: [], last: {}, diag: { ok: false }, countMode: opts.countMode || 'wrap', countSeq: 0, cPrev: -1, cT: -1 };
    master.gain.value = st.vols.master; sfxB.gain.value = st.vols.sfx; uiB.gain.value = st.vols.ui;
    S = st;
    if (st.own && opts.autoUnlock !== false) st.offUnlock = armUnlock();
    let base = opts.base ?? './audio/'; if (!base.endsWith('/')) base += '/';
    const meta = (await (await fetch(base + 'kk_sfx.json')).json()) as Meta;
    let fmt = opts.format || pickFormat(), buf: AudioBuffer;
    try { buf = await loadBuf(ctx, base + meta.files[fmt]); }
    catch (e) { if (fmt !== 'ogg') throw e; st.diag.opusFallback = String(e); fmt = 'm4a'; buf = await loadBuf(ctx, base + meta.files.m4a); }
    if (S !== st) return st.diag; // disposed meanwhile
    const m = findMarker(buf, meta.marker), msr = meta.sampleRate;
    for (const [k, v] of Object.entries(meta.sprites)) st.sprites[k] = { off: Math.max(0, v.start / msr + m.offsetSec), dur: v.length / msr };
    st.buf = buf;
    Object.assign(st.diag, { ok: true, format: fmt, sampleRate: ctx.sampleRate, markerFound: m.ok, markerScore: m.score,
      markerOffsetSamples: m.offsetSec * msr, sprites: Object.keys(st.sprites).length,
      initMs: typeof performance !== 'undefined' ? performance.now() - t0 : undefined });
  } catch (e) {
    if (st) st.diag = Object.assign(st.diag, { ok: false, error: String(e) });
    else return { ok: false, error: String(e) };
  }
  return st.diag;
}

/** Resume the context and play one silent frame (iOS needs a sound started inside a gesture). Call from a gesture. */
export function unlock(): void {
  try {
    if (!S || S.paused) return;
    const ctx = S.ctx as AudioContext;
    const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => {});
  } catch { /* ignore */ }
}
/** Unlock on every pointerdown/touchend/keydown until the context runs (and again after iOS 'interrupted'). Returns an off(). */
export function armUnlock(target: EventTarget | null = typeof document !== 'undefined' ? document : null): () => void {
  if (!target) return () => {};
  const evs = ['pointerdown', 'touchend', 'keydown', 'click'];
  const h = () => unlock(); // cheap; stays armed so iOS 'interrupted' (calls, Siri) recovers on the next tap
  evs.forEach(e => target.addEventListener(e, h, { capture: true, passive: true } as AddEventListenerOptions));
  return () => evs.forEach(e => target.removeEventListener(e, h, { capture: true } as EventListenerOptions));
}

/** Low-level: play a sprite by its exact name (see kk_sfx.json). Returns the source node or null. */
export function play(name: string, o: PlayOpts = {}): AudioBufferSourceNode | null { return playX(name, o); }
/** play() with an optional shortened length (s) that ends in a fade */
function playX(name: string, o: PlayOpts = {}, len?: number, fade = 0.012): AudioBufferSourceNode | null {
  try {
    const st = S; if (!st || !st.buf || st.paused) return null;
    const ctx = st.ctx; if ((ctx.state as string) === 'closed' || (st.own && ctx.state !== 'running')) return null;
    const sp = st.sprites[name]; if (!sp) return null;
    const fam = name.replace(/_\d+$/, ''), now = ctx.currentTime, t = Math.max(o.when ?? now + Math.max(0, o.delay ?? 0), now);
    const gap = MIN_GAP[fam];
    if (gap !== undefined) { const l = st.last[fam]; if (l !== undefined && t - l < gap && t >= l) return null; st.last[fam] = t; }
    st.voices = st.voices.filter(v => v.end > now);
    const kill = (v: Voice) => { try { v.g.gain.setTargetAtTime(0, t, 0.003); v.src.stop(t + 0.03); } catch { /* */ } v.end = 0; };
    const group = GROUP_OF[fam];
    // only voices that are actually sounding at t count (v02b: sounds scheduled ahead with delay/when are not cut early,
    // and stay tracked so stopAll() can still cancel them)
    const live = (v: Voice) => v.start <= t && v.end > t;
    if (group) st.voices.filter(v => v.group === group && v.start <= t).forEach(kill);
    const cap = MAX_POLY[fam];
    if (cap) { const same = st.voices.filter(v => live(v) && v.name.replace(/_\d+$/, '') === fam); for (let i = 0; i <= same.length - cap; i++) kill(same[i]); }
    st.voices = st.voices.filter(v => v.end > 0);
    const sounding = st.voices.filter(live);
    if (sounding.length >= MAX_VOICES) { kill(sounding[0]); st.voices = st.voices.filter(v => v.end > 0); }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = st.buf; g.gain.value = db2((TRIM_DB[fam] ?? 0) + (o.gainDb ?? 0));
    src.connect(g); g.connect(st.buses[UI_SOUNDS.has(fam) ? 'ui' : 'sfx']);
    const d = len !== undefined && len < sp.dur ? Math.max(0.01, len) : sp.dur;
    if (d < sp.dur) { const f = Math.min(fade, d / 2); g.gain.setValueAtTime(g.gain.value, t + d - f); g.gain.linearRampToValueAtTime(0, t + d); }
    src.start(t, sp.off, d);
    const v: Voice = { src, g, start: t, end: t + d, group, name }; st.voices.push(v);
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch { /* */ } };
    return src;
  } catch { return null; }
}

const clampI = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(+x || 0)));
const p = (name: string, o?: PlayOpts) => { play(name, o); };

/** The game hooks (drop-in for src/sfx.ts). Optional last arg { when, gainDb } for scheduling/tests. */
export const sfx = {
  // board + round
  tap(o?: PlayOpts): void { p('tap', o); },
  correct(o?: PlayOpts): void { p('correct', o); },              // also Bond Lab quiz right
  wrong(o?: PlayOpts): void { p('wrong', o); },                  // also Bond Lab quiz wrong
  penalty(o?: PlayOpts): void { p('penalty', o); },              // the -3 s; call ~120-200 ms after wrong()
  roundStart(o?: PlayOpts): void { p('roundStart', o); },
  lowTime(o?: PlayOpts): void { p('lowTime', o); },              // once at 10 s left
  tick(s: number, o?: PlayOpts): void { p('tick_' + clampI(s, 1, 5), o); }, // s = 5..1, rises toward 1
  timeUp(o?: PlayOpts): void { p('timeUp', o); },
  streak(level: number, o?: PlayOpts): void { p('streak_' + (level >= 20 ? 20 : level >= 10 ? 10 : 5), o); },
  newBest(o?: PlayOpts): void { p('newBest', o); },
  uiTap(o?: PlayOpts): void { p('uiTap', o); },
  replay(o?: PlayOpts): void { p('replay', o); },
  // teaching solve
  count(i: number, o?: PlayOpts): void {
    // v0.3.2: one call per dot landing, i = running total from 0 (first dot = count(0)). Pitch = i % 10 on C5 D5 E5 G5 A5
    // C6 D6 E6 G6 A6, so it climbs inside each ten-frame and restarts per ten; every 10th dot adds the countTen accent.
    // Fast pace (< COUNT_PACE.fastGap between dots): dots are shortened + slightly ducked so the run doesn't buzz.
    try {
      const st = S; if (!st || !st.buf) return;
      const n = Math.min(1e6, Math.max(0, Math.floor(+i || 0))), P = COUNT_PACE, now = st.ctx.currentTime;
      const t = Math.max(o?.when ?? now + Math.max(0, o?.delay ?? 0), now);
      const fresh = n === 0 || n <= st.cPrev || st.cT < 0 || t < st.cT || t - st.cT > 1.5;
      const gap = fresh ? Infinity : (t - st.cT) / Math.max(1, n - st.cPrev);
      st.cPrev = n; st.cT = t;
      const idx = st.countMode === 'plateau' ? Math.min(n, 9) : n % 10, ten = n % 10 === 9;
      const fast = gap < P.fastGap && P.thin !== 'none';
      const oo: PlayOpts = { when: t, gainDb: o?.gainDb };
      let len: number | undefined;
      if (fast) {
        if (P.thin === 'skip' && n % 2 === 1 && !ten) return;
        len = Math.max(P.minLen, gap * P.lenFrac);
        const k = Math.min(1, Math.max(0, (P.fastGap - gap) / Math.max(1e-3, P.fastGap - P.minGapRef)));
        oo.gainDb = (oo.gainDb ?? 0) + P.duckDb * k + (P.thin === 'ghost' && n % 2 === 1 && !ten ? P.ghostDb : 0);
      }
      playX('count_' + idx, oo, len, P.fade);
      if (ten && P.tenAccent && (!fast || P.tenAccentFast)) playX('countTen', { when: t, gainDb: o?.gainDb }, fast ? Math.max(0.09, len ?? 0) : undefined, 0.02);
    } catch { /* never throws */ }
  },
  hop(o?: PlayOpts): void { p('hop', o); },
  makeTen(o?: PlayOpts): void { p('makeTen', o); },
  total(o?: PlayOpts): void { p('total', o); },                // v02c: counter tile turns green on the final count (~150 ms after partPop(1))
  bond(o?: PlayOpts): void { p('bond', o); },
  partPop(i: number, o?: PlayOpts): void { p('partPop_' + clampI(i, 0, 1), o); },   // 0 = smaller part, 1 = larger
  cheer(o?: PlayOpts): void { p('cheer', o); },                  // with the confetti, as the caption lands
  caption(_o?: PlayOpts): void { /* silent by design: cheer() already marks the caption landing */ },
  pulse(i: number, o?: PlayOpts): void { p('pulse_' + clampI(i, 0, 2), o); },       // 0 part 1 (low), 1 part 2 (mid), 2 whole (high)
  clear(o?: PlayOpts): void { p('clear', o); },                  // optional, very soft
  // Bond Lab
  slide(n: number, o?: PlayOpts): void { p('slide_' + clampI(n - 1, 0, 9), o); },  // every slider step; rate-limited to 1 per 35 ms
  labPair(a: number, o?: PlayOpts): void { p('labPair_' + ((Math.max(1, Math.floor(+a || 1)) - 1) % 5), o); },
  star(o?: PlayOpts): void { p('star', o); },
  quizStart(o?: PlayOpts): void { p('quizStart', o); },
};

/** Optional helper: schedule the v0.2.3 bond sounds on the audio clock, t0 = the answer reaching the top (now if omitted).
 *  Returns cancel(). Use either this OR the individual partPop/cheer/pulse calls, not both. */
export function scheduleBond(timing: Partial<typeof BOND_TIMING> = {}, delaySec = 0): () => void {
  const T = { ...BOND_TIMING, ...timing }, srcs: (AudioBufferSourceNode | null)[] = [];
  try {
    if (!S) return () => {};
    const t0 = S.ctx.currentTime + Math.max(0, delaySec);
    T.partPop.forEach((t, i) => srcs.push(play('partPop_' + i, { when: t0 + t })));
    srcs.push(play('cheer', { when: t0 + T.cheer }));
    T.pulse.forEach((t, i) => srcs.push(play('pulse_' + i, { when: t0 + t })));
    if (T.playClear) srcs.push(play('clear', { when: t0 + T.clear }));
  } catch { /* */ }
  return () => srcs.forEach(s => { try { s && s.stop(); } catch { /* */ } });
}

/** Fade out everything playing or scheduled (e.g. when the kid taps to skip a teaching solve). */
export function stopAll(fadeSec = 0.06): void {
  try {
    if (!S) return; const t = S.ctx.currentTime;
    for (const v of S.voices) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, Math.max(0.002, fadeSec / 3)); v.src.stop(t + fadeSec + 0.02); } catch { /* */ } }
    S.voices = []; S.cPrev = -1; S.cT = -1;   // a skipped count run never leaks its pace into the next one
  } catch { /* */ }
}

function applyGain(bus: Bus, when?: number) {
  if (!S) return;
  const node = S.buses[bus], t = Math.max(when ?? S.ctx.currentTime, S.ctx.currentTime);
  const v = bus === 'master' && S.muted ? 0 : S.vols[bus];
  node.gain.cancelScheduledValues(t); node.gain.setTargetAtTime(v, t, 0.005);
}
export function setVolume(bus: Bus, v: number, when?: number): void {
  try { if (!S || !(bus in S.vols)) return; S.vols[bus] = Math.min(1, Math.max(0, +v || 0)); applyGain(bus, when); } catch { /* */ }
}
export function getVolume(bus: Bus): number { return S ? S.vols[bus] : BUS_DEFAULTS[bus]; }
export function setMuted(m: boolean): void { try { if (!S) return; S.muted = !!m; applyGain('master'); } catch { /* */ } }
export function isMuted(): boolean { return !!S && S.muted; }
/** Suspend while hidden: document.addEventListener('visibilitychange', () => setPaused(document.hidden)) */
export function setPaused(paused: boolean): Promise<void> {
  try {
    if (!S) return Promise.resolve();
    S.paused = !!paused;
    const ctx = S.ctx as AudioContext; if (!S.own || !ctx.suspend) return Promise.resolve();
    return (paused ? ctx.suspend() : ctx.resume()).catch(() => {});
  } catch { return Promise.resolve(); }
}
export function diagnostics(): Diagnostics {
  return S ? { ...S.diag, state: S.ctx.state, muted: S.muted, volumes: { ...S.vols } } : { ok: false, error: 'not initialised' };
}
export function context(): BaseAudioContext | null { return S ? S.ctx : null; }
export function dispose(): void {
  const st = S; S = null; if (!st) return;
  try { st.offUnlock && st.offUnlock(); } catch { /* */ }
  for (const v of st.voices) { try { v.src.stop(); } catch { /* */ } }
  try { st.limiter.disconnect(); } catch { /* */ }
  try { if (st.own && (st.ctx as AudioContext).close) (st.ctx as AudioContext).close().catch(() => {}); } catch { /* */ }
}
