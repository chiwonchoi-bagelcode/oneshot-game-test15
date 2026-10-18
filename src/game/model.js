// Pure gameplay model shared by the game, the post-run analysis and the level validator (Node).
// No DOM access in this file.
import BAL from '../data/balance.json';
import ISLAND from '../data/island.json';
import ITEMS from '../data/items.json';

export const T = BAL.tile;
export const TYPES = { '~': 'sea', c: 'creek', m: 'mud', s: 'sand', b: 'bar', r: 'rock', d: 'beach', g: 'grass' };
// visual layer per type: 0 bed, 1 mud, 2 sand, 3 dry, 4 grass
export const LAYER = { sea: 0, creek: 0, mud: 1, sand: 2, bar: 2, rock: 2, beach: 3, grass: 4 };

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function hash2(x, y, s = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x, y, cell, seed) {
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- upgrades -> numbers ----------
export function stats(up = {}) {
  const bagLv = up.bag || 0;
  return {
    capacity: BAL.bag.capacity[Math.min(bagLv, BAL.bag.capacity.length - 1)],
    mud: BAL.sled.mud[Math.min(up.sled || 0, BAL.sled.mud.length - 1)],
    boardLen: BAL.boardwalk.length[Math.min(up.boardwalk || 0, BAL.boardwalk.length.length - 1)],
    light: up.light || 0,
    stilt: up.stilt || 0,
  };
}

export function bagMultiplier(weight, capacity) {
  const f = clamp(weight / capacity, 0, 1);
  return 1 - BAL.bag.penalty * Math.pow(f, BAL.bag.curve);
}

// ---------- tide ----------
export function makeTide(level, assist = 0) {
  const low = level.tide.low, high = level.tide.high ?? 100;
  const dur = level.tide.duration * (1 + assist);
  const curve = level.tide.curve ?? BAL.tide.curve;
  return {
    low, high, dur, curve,
    at(t) { return low + (high - low) * Math.pow(clamp(t / dur, 0, 1), curve); },
    timeOf(lv) { // first time the level reaches lv
      if (lv <= low) return 0;
      if (lv >= high) return lv > high ? Infinity : dur;
      return dur * Math.pow((lv - low) / (high - low), 1 / curve);
    },
    fraction(t) { return clamp(t / dur, 0, 1); },
  };
}

// ---------- terrain model ----------
export function buildModel(level, up = {}) {
  const W = BAL.worldW;
  const flats = level.terrain;
  const rows = flats.concat(ISLAND.rows);
  const H = rows.length;
  const F = flats.length;
  const N = W * H;
  const type = new Array(N);
  const elev = new Float32Array(N);
  const blocked = new Uint8Array(N);
  const safe = new Uint8Array(N);
  const board = new Uint8Array(N);
  const st = stats(up);
  const tb = BAL.terrain;
  const heights = level.heights || {};
  for (let y = 0; y < H; y++) {
    const row = rows[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = TYPES[row[x]] || 'sand';
      type[i] = t;
      if (y < F) {
        const base = lerp(tb.rowBaseTop, tb.rowBaseBottom, y / (F - 1));
        elev[i] = base + (tb.offset[t] ?? 0) + (heights[`${x},${y}`] || 0);
      } else {
        elev[i] = t === 'sea' ? -60 : (tb.safeElev[t] ?? 104);
      }
      // rocks, and open sea on the flats: you can't wade into the ocean, only the tide can catch you
      if (t === 'rock' || (t === 'sea' && y < F)) blocked[i] = 1;
      if (t === 'beach' || t === 'grass') safe[i] = 1;
      if (t === 'sea' && y >= F) blocked[i] = 0;
    }
  }
  // boardwalk overrides terrain in its column
  const col = BAL.boardwalk.column;
  const boardEl = new Float32Array(N);
  for (let k = 0; k < st.boardLen; k++) {
    const y = F - 1 - k;
    if (y < 0) break;
    const i = y * W + col;
    board[i] = 1;
    blocked[i] = 0;
    // planks sit a fixed height above the flats, so the far end floods first
    boardEl[i] = Math.min(BAL.boardwalk.elev, lerp(tb.rowBaseTop, tb.rowBaseBottom, y / (F - 1)) + BAL.boardwalk.lift);
  }
  // priority flood: water enters from the sea tiles and from every world border
  const spill = new Float32Array(N).fill(Infinity);
  const heap = new MinHeap();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (type[i] === 'sea' || x === 0 || x === W - 1 || y === 0) {
        spill[i] = elev[i];
        heap.push(spill[i], i);
      }
    }
  }
  while (heap.size) {
    const [v, i] = heap.pop();
    if (v > spill[i]) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of NB4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      const nv = Math.max(elev[j], v);
      if (nv < spill[j]) { spill[j] = nv; heap.push(nv, j); }
    }
  }
  // per-pixel elevation (bilinear between tile centres + gentle noise) and flood level
  const Wp = W * T, Hp = H * T;
  const elevPx = new Float32Array(Wp * Hp);
  const floodPx = new Float32Array(Wp * Hp);
  const amp = tb.noise;
  for (let py = 0; py < Hp; py++) {
    const fy = clamp((py + 0.5) / T - 0.5, 0, H - 1);
    const y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
    for (let px = 0; px < Wp; px++) {
      const fx = clamp((px + 0.5) / T - 0.5, 0, W - 1);
      const x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
      const e = lerp(lerp(elev[y0 * W + x0], elev[y0 * W + x1], tx), lerp(elev[y1 * W + x0], elev[y1 * W + x1], tx), ty)
        + (smoothNoise(px, py, 6, 7) - 0.5) * 2 * amp;
      const ti = ((py / T) | 0) * W + ((px / T) | 0);
      const k = py * Wp + px;
      elevPx[k] = safe[ti] ? Math.max(e, 101) : e;
      floodPx[k] = Math.max(elevPx[k], spill[ti]);
    }
  }
  const m = { W, H, F, N, Wp, Hp, type, elev, blocked, safe, board, boardEl, spill, elevPx, floodPx, st, level };
  m.tileAt = (x, y) => {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return -1;
    return ty * W + tx;
  };
  m.isSafe = (x, y) => { const i = m.tileAt(x, y); return i >= 0 && safe[i] === 1; };
  m.isBlocked = (x, y) => {
    if (x < 2 || x >= Wp - 2 || y < 0 || y >= Hp) return true;
    const i = m.tileAt(x, y);
    return i < 0 || blocked[i] === 1;
  };
  m.onBoard = (x, y) => { const i = m.tileAt(x, y); return i >= 0 && board[i] === 1; };
  // depth of water at the feet; <= 0 means dry
  m.depth = (x, y, lv) => {
    const px = clamp(x | 0, 0, Wp - 1), py = clamp(y | 0, 0, Hp - 1);
    const k = py * Wp + px;
    const i = m.tileAt(px, py);
    if (safe[i]) return -10;
    if (board[i]) return lv - boardEl[i];
    if (lv <= floodPx[k]) return lv - floodPx[k];
    return lv - elevPx[k];
  };
  m.terrainMul = (x, y) => {
    const i = m.tileAt(x, y);
    if (i < 0) return 1;
    if (board[i]) return BAL.move.board;
    if (type[i] === 'mud') return st.mud;
    return 1;
  };
  return m;
}

export function wadeMul(depth) {
  if (depth <= 0) return 1;
  const f = clamp(depth / BAL.move.sweptDepth, 0, 1);
  return lerp(BAL.move.wadeFast, BAL.move.wadeSlow, f);
}

export function speedAt(m, x, y, lv, weight) {
  const d = m.depth(x, y, lv);
  return BAL.player.speed * m.terrainMul(x, y) * wadeMul(d) * bagMultiplier(weight, m.st.capacity);
}

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NB8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const topK = k[0], topV = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let l = 2 * i + 1, r = l + 1, s = i;
        let sk = lk;
        if (l < n && k[l] < sk) { s = l; sk = k[l]; }
        if (r < n && k[r] < sk) { s = r; sk = k[r]; }
        if (s === i) break;
        k[i] = k[s]; v[i] = v[s]; i = s;
      }
      k[i] = lk; v[i] = lv;
    }
    return [topK, topV];
  }
}

// ---------- coarse navigation grid (8px cells) for planning ----------
export const CELL = 8;
export function buildNav(m) {
  const cw = m.Wp / CELL, ch = m.Hp / CELL;
  const n = cw * ch;
  const flood = new Float32Array(n), walk = new Float32Array(n), mul = new Float32Array(n);
  const block = new Uint8Array(n), safe = new Uint8Array(n);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const c = cy * cw + cx;
      const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
      const ti = m.tileAt(x, y);
      // conservative: the lowest point of the cell decides when it floods
      let fl = Infinity, we = Infinity;
      for (const [ox, oy] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]]) {
        const k = ((y + oy) | 0) * m.Wp + ((x + ox) | 0);
        fl = Math.min(fl, m.floodPx[k]);
        we = Math.min(we, m.elevPx[k]);
      }
      if (m.board[ti]) { fl = Math.max(fl, m.boardEl[ti]); we = m.boardEl[ti]; }
      if (m.safe[ti]) { fl = 1e9; we = 1e9; safe[c] = 1; }
      flood[c] = fl; walk[c] = we;
      block[c] = m.isBlocked(x, y) ? 1 : 0;
      mul[c] = m.terrainMul(x, y);
    }
  }
  return { cw, ch, n, flood, walk, mul, block, safe };
}

export function cellOf(nav, x, y) {
  const cx = clamp((x / CELL) | 0, 0, nav.cw - 1), cy = clamp((y / CELL) | 0, 0, nav.ch - 1);
  return cy * nav.cw + cx;
}

function cellDepth(nav, c, lv) {
  if (nav.safe[c]) return -10;
  if (lv <= nav.flood[c]) return lv - nav.flood[c];
  return lv - nav.walk[c];
}

// Time-dependent earliest arrival from (x,y) at time t0 carrying `weight`.
// Returns { time: arrival time at the first reachable safe cell (Infinity if none), times, prev, goal }.
export function earliest(nav, m, tide, x, y, t0, weight, speedScale = 1, stopAtSafe = true) {
  const n = nav.n;
  const times = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const s = cellOf(nav, x, y);
  times[s] = t0;
  const heap = new MinHeap();
  heap.push(t0, s);
  const base = BAL.player.speed * bagMultiplier(weight, m.st.capacity) * speedScale;
  const swept = BAL.move.sweptDepth;
  let goal = -1;
  while (heap.size) {
    const [t, c] = heap.pop();
    if (t > times[c]) continue;
    if (stopAtSafe && nav.safe[c]) { goal = c; break; }
    const cx = c % nav.cw, cy = (c / nav.cw) | 0;
    const lvNow = tide.at(t);
    const dHere = cellDepth(nav, c, lvNow);
    for (const [dx, dy, len] of NB8) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= nav.cw || ny >= nav.ch) continue;
      const j = ny * nav.cw + nx;
      if (nav.block[j]) continue;
      if (dx && dy && (nav.block[cy * nav.cw + nx] || nav.block[ny * nav.cw + cx])) continue;
      const dj = cellDepth(nav, j, lvNow);
      const sp = base * Math.min(nav.mul[c], nav.mul[j]) * Math.min(wadeMul(dHere), wadeMul(dj));
      const nt = t + (len * CELL) / sp;
      if (nt > tide.dur + 0.01 && !nav.safe[j]) continue;
      if (cellDepth(nav, j, tide.at(nt)) >= swept) continue;
      if (nt < times[j]) { times[j] = nt; prev[j] = c; heap.push(nt, j); }
    }
  }
  return { time: goal >= 0 ? times[goal] : Infinity, times, prev, goal };
}

export function pathTo(res, nav, goal) {
  const out = [];
  for (let c = goal; c >= 0; c = res.prev[c]) out.push([(c % nav.cw) * CELL + CELL / 2, ((c / nav.cw) | 0) * CELL + CELL / 2]);
  return out.reverse();
}

export function itemWeight(t) { return ITEMS[t] ? ITEMS[t].weight : 1; }

// ---------- post-run analysis: "if you had turned back here, you'd have made it" ----------
// trace: [{t, x, y, w}] sampled positions with carried weight; picks: [{t, type}]
export function turnBackAnalysis(m, nav, tide, trace, picks) {
  let lastOk = -1;
  for (let i = 0; i < trace.length; i++) {
    const p = trace[i];
    const r = earliest(nav, m, tide, p.x, p.y, p.t, p.w);
    if (r.time < Infinity) lastOk = i;
  }
  if (lastOk < 0) return { kind: 'none' };
  const tOk = trace[lastOk].t;
  const greedy = picks.filter((p) => p.t > tOk + 0.05);
  const lastSample = trace[trace.length - 1];
  const secondsLate = Math.max(0, lastSample.t - tOk);
  const r = earliest(nav, m, tide, trace[lastOk].x, trace[lastOk].y, tOk, trace[lastOk].w);
  return {
    kind: greedy.length ? 'greedy' : 'late',
    turnAt: { x: trace[lastOk].x, y: trace[lastOk].y, t: tOk },
    greedy,
    secondsLate,
    path: r.goal >= 0 ? pathTo(r, nav, r.goal) : [],
  };
}
