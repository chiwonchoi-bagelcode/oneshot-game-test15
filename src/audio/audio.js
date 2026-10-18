// WebAudio manager: music layers with crossfades, pooled one-shot SFX, ambience.
// Audio data arrives lazily (assets/audio-*.js define window.__AUDIO_PACK__ chunks) so the first screen never waits for it.

const A = {
  ctx: null, master: null, music: null, sfx: null, amb: null,
  buffers: {}, pending: {}, loaded: false, loops: {},
  musicVol: 0.7, sfxVol: 0.9,
  tracks: {}, // name -> { src, gain }
  current: [],
  unlocked: false,
  lastPlay: {},
};

export const audio = A;

function ensureCtx() {
  if (A.ctx) return A.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    A.ctx = new AC({ latencyHint: 'interactive' });
  } catch (_) {
    try { A.ctx = new AC(); } catch (e) { return null; }
  }
  A.master = A.ctx.createGain();
  A.master.gain.value = 1;
  const comp = A.ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.2;
  A.master.connect(comp).connect(A.ctx.destination);
  A.music = A.ctx.createGain(); A.music.gain.value = A.musicVol * 0.55; A.music.connect(A.master);
  A.sfx = A.ctx.createGain(); A.sfx.gain.value = A.sfxVol; A.sfx.connect(A.master);
  A.amb = A.ctx.createGain(); A.amb.gain.value = A.sfxVol * 0.6; A.amb.connect(A.master);
  return A.ctx;
}

// call from a user gesture
export function unlockAudio() {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  if (!A.unlocked) {
    // play a silent buffer: required on older iOS
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
    A.unlocked = true;
  }
  decodePending();
}

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// MP3 decoders may keep the encoder's leading silence: find where the sound really starts
function onsetOf(buf) {
  const d = buf.getChannelData(0);
  const lim = Math.min(d.length, buf.sampleRate * 0.2);
  for (let i = 0; i < lim; i++) if (Math.abs(d[i]) > 0.0015) return Math.max(0, i - 32);
  return 0;
}

function trimmed(ctx, buf, start) {
  if (start <= 0) return buf;
  const n = buf.length - start;
  const out = ctx.createBuffer(buf.numberOfChannels, n, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(start));
  return out;
}

function decodeOne(name, b64) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const ab = b64ToArrayBuffer(b64);
  const done = (buf) => {
    const meta = (window.__AUDIO_META__ || {})[name];
    const on = onsetOf(buf);
    if (meta && meta.loop) {
      A.loops[name] = { start: on / buf.sampleRate, end: on / buf.sampleRate + meta.loop };
      A.buffers[name] = buf;
    } else {
      A.buffers[name] = trimmed(ctx, buf, on);
    }
    if (A.wantMusic && A.wantMusic.includes(name)) setMusic(A.wantMusic, 0.6);
  };
  try {
    const p = ctx.decodeAudioData(ab, done, () => {});
    if (p && p.catch) p.catch(() => {});
  } catch (_) { /* ignore */ }
}

function decodePending() {
  if (!A.ctx) return;
  for (const [k, v] of Object.entries(A.pending)) {
    decodeOne(k, v);
    delete A.pending[k];
  }
}

// load a pack script (works from file:// and http)
export function loadPack(src) {
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      const pack = window.__AUDIO_PACK__ || {};
      for (const [k, v] of Object.entries(pack)) A.pending[k] = v;
      window.__AUDIO_PACK__ = {};
      if (A.ctx) decodePending();
      res(true);
    };
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}

export function setVolumes(music, sfx) {
  A.musicVol = music; A.sfxVol = sfx;
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  A.music.gain.setTargetAtTime(music * 0.55, t, 0.05);
  A.sfx.gain.setTargetAtTime(sfx, t, 0.05);
  A.amb.gain.setTargetAtTime(sfx * 0.6, t, 0.05);
}

// opts: { rate, vol, pan, when }
export function play(name, opts = {}) {
  const ctx = A.ctx;
  if (!ctx || ctx.state !== 'running') return null;
  const buf = A.buffers[name];
  if (!buf) return null;
  const now = ctx.currentTime;
  // avoid machine-gun stacking of the exact same sound
  const last = A.lastPlay[name] || 0;
  if (!opts.force && now - last < 0.03) return null;
  A.lastPlay[name] = now;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = opts.rate || 1;
  const g = ctx.createGain();
  g.gain.value = opts.vol ?? 1;
  let node = src.connect(g);
  if (opts.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, opts.pan));
    node = node.connect(p);
  }
  node.connect(opts.bus === 'amb' ? A.amb : A.sfx);
  src.start(now + (opts.when || 0));
  return src;
}

// layered music: names = ['run_base', 'run_tension'] etc. All layers start in sync.
export function setMusic(names, fade = 1.2) {
  A.wantMusic = names;
  const ctx = A.ctx;
  if (!ctx) return;
  const key = names.join('+');
  if (A.musicKey === key && A.current.length) return;
  if (!names.every((n) => A.buffers[n])) return; // will retry when decoded
  const t = ctx.currentTime;
  for (const tr of A.current) {
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
    tr.gain.gain.linearRampToValueAtTime(0, t + fade);
    try { tr.src.stop(t + fade + 0.05); } catch (_) { /* already stopped */ }
  }
  A.current = names.map((n, i) => {
    const src = ctx.createBufferSource();
    src.buffer = A.buffers[n];
    src.loop = true;
    const lp = A.loops[n];
    if (lp) { src.loopStart = lp.start; src.loopEnd = lp.end; }
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(A.music);
    src.start(t + 0.02, lp ? lp.start : 0);
    const target = i === 0 ? 1 : 0;
    g.gain.linearRampToValueAtTime(target, t + fade);
    return { name: n, src, gain: g };
  });
  A.musicKey = key;
}

// fade an extra layer (e.g. tension) in or out: level 0..1
export function setLayer(index, level, time = 0.4) {
  const tr = A.current[index];
  if (!tr || !A.ctx) return;
  tr.gain.gain.setTargetAtTime(level, A.ctx.currentTime, time / 3);
}

export function stopMusic(fade = 0.8) {
  A.wantMusic = null;
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  for (const tr of A.current) {
    tr.gain.gain.setTargetAtTime(0, t, fade / 3);
    try { tr.src.stop(t + fade + 0.1); } catch (_) { /* ignore */ }
  }
  A.current = [];
  A.musicKey = '';
}

// looping ambience (waves)
export function setAmbience(name, vol = 1) {
  const ctx = A.ctx;
  if (!ctx || !A.buffers[name]) { A.wantAmb = [name, vol]; return; }
  if (!A.ambSrc) {
    const src = ctx.createBufferSource();
    src.buffer = A.buffers[name];
    src.loop = true;
    const lp = A.loops[name];
    if (lp) { src.loopStart = lp.start; src.loopEnd = lp.end; }
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(A.amb);
    src.start(0, lp ? lp.start : 0);
    A.ambSrc = src; A.ambGain = g;
  }
  A.ambGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.3);
}

// keep the context alive across app switches; resume on return
export function initAudioLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (!A.ctx) return;
    if (document.hidden) A.ctx.suspend().catch(() => {});
    else A.ctx.resume().catch(() => {});
  });
  window.addEventListener('pageshow', () => { if (A.ctx) A.ctx.resume().catch(() => {}); });
  // iOS can leave the context "interrupted" after a call; any touch brings it back
  const kick = () => { if (A.ctx && A.ctx.state !== 'running') A.ctx.resume().catch(() => {}); };
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('focus', kick);
}

// occasional gulls on the island
let gullT = 6;
export function tickAudio(dt = 0.016, island = false) {
  if (island && A.ctx && A.ctx.state === 'running') {
    gullT -= dt;
    if (gullT <= 0) { gullT = 9 + Math.random() * 14; play(Math.random() < 0.5 ? 'gull1' : 'gull2', { vol: 0.35, pan: Math.random() * 1.4 - 0.7, bus: 'amb' }); }
  }
  if (A.wantAmb && A.buffers[A.wantAmb[0]]) { const [n, v] = A.wantAmb; A.wantAmb = null; setAmbience(n, v); }
}
