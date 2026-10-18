// Helpers for authoring level files: terrain from zone features, item shapes for chain-picking.
export const W = 12;
export const F = 52;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// opts: { sea: rowsOfSeaAtTop, creek1, creek2, channel, mud: [[cx,cy,rx,ry]], bars: [...], rocks: [[x,y]], seed, horizon }
export function makeTerrain(opts = {}) {
  const g = [];
  for (let y = 0; y < F; y++) g.push(new Array(W).fill('s'));
  const set = (x, y, t) => { if (x >= 0 && x < W && y >= 0 && y < F) g[y][x] = t; };
  const ell = (cx, cy, rx, ry, t) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, t);
  };
  for (const [cx, cy, rx, ry] of opts.mud || []) ell(cx, cy, rx, ry, 'm');
  for (const [cx, cy, rx, ry] of opts.bars || []) ell(cx, cy, rx, ry, 'b');
  const creek = (c, phase, width, amp = 1.2) => {
    for (let x = 0; x < W; x++) {
      const cy = c + Math.round(Math.sin(x * 0.62 + phase) * amp);
      for (let k = 0; k < width; k++) set(x, cy - Math.floor(width / 2) + k, 'c');
    }
  };
  if (opts.creek1 !== false) creek(opts.creek1 ?? 42, opts.phase1 ?? 0.4, opts.width1 ?? 3);
  if (opts.creek2 !== false) creek(opts.creek2 ?? 26, opts.phase2 ?? 2.1, opts.width2 ?? 3);
  const heights = {};
  if (opts.channel !== false) {
    const c0 = opts.channel ?? 10;
    for (let y = c0; y < c0 + 3; y++) for (let x = 0; x < W; x++) { set(x, y, 'c'); heights[`${x},${y}`] = -10; }
  }
  const sea = opts.sea ?? 2;
  for (let y = 0; y < sea; y++) for (let x = 0; x < W; x++) set(x, y, '~');
  for (const [x, y] of opts.rocks || []) set(x, y, 'r');
  for (const [x, y, t] of opts.paint || []) set(x, y, t);
  return { terrain: g.map((r) => r.join('')), heights };
}

export function line(t, x0, y0, x1, y1, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    out.push({ t, x: +(x0 + (x1 - x0) * k).toFixed(2), y: +(y0 + (y1 - y0) * k).toFixed(2) });
  }
  return out;
}

export function arc(t, cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (a0 + (a1 - a0) * (n === 1 ? 0 : i / (n - 1))) * Math.PI / 180;
    out.push({ t, x: +(cx + Math.cos(a) * r).toFixed(2), y: +(cy + Math.sin(a) * r * 0.8).toFixed(2) });
  }
  return out;
}

export function cluster(t, cx, cy, n, r, seed = 1) {
  const R = rng(seed);
  const out = [];
  let guard = 0;
  let rr = Math.max(r, Math.sqrt(n) * 0.55);
  while (out.length < n && guard++ < 2000) {
    if (guard % 200 === 0) rr *= 1.15;
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rr;
    const p = { t, x: +(cx + Math.cos(a) * d).toFixed(2), y: +(cy + Math.sin(a) * d * 0.8).toFixed(2) };
    if (out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 0.8)) continue;
    out.push(p);
  }
  return out;
}

export function one(t, x, y) { return [{ t, x, y }]; }

// scatter n items in a band, spaced apart, never on rock/sea/creek (resolved once terrain exists)
export function sc(t, n, y0, y1, seed = 1, x0 = 0.8, x1 = 11.2, avoid = 'rc~') {
  return (terrain) => {
    const R = rng(seed * 7919 + n);
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < 4000) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
      const ch = terrain[Math.floor(y)] && terrain[Math.floor(y)][Math.floor(x)];
      if (!ch || avoid.includes(ch)) continue;
      if (Math.abs(x - 5.5) < 0.7 && y > 9) continue; // keep the boardwalk lane clear
      if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 1.5)) continue;
      out.push({ t, x: +x.toFixed(2), y: +y.toFixed(2) });
    }
    return out;
  };
}
