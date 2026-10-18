// Bakes the static terrain of a level into one canvas using dual-grid autotiles.
import { T, LAYER, hash2, clamp } from './model.js';
import { assets, spr, frame } from '../core/assets.js';

const LAYER_NAMES = ['bed', 'mud', 'sand', 'dry', 'grass'];

export function bakeTerrain(m) {
  const cv = document.createElement('canvas');
  cv.width = m.Wp;
  cv.height = m.Hp;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const L = (x, y) => {
    x = clamp(x, 0, m.W - 1); y = clamp(y, 0, m.H - 1);
    return LAYER[m.type[y * m.W + x]];
  };
  for (let dy = 0; dy <= m.H; dy++) {
    for (let dx = 0; dx <= m.W; dx++) {
      const X = dx * T - 8, Y = dy * T - 8;
      const c0 = L(dx - 1, dy - 1), c1 = L(dx, dy - 1), c2 = L(dx - 1, dy), c3 = L(dx, dy);
      spr(ctx, `t_bed_full${(hash2(dx, dy, 3) * 3) | 0}`, X, Y);
      for (let li = 1; li < 5; li++) {
        const mask = (c0 >= li ? 1 : 0) | (c1 >= li ? 2 : 0) | (c2 >= li ? 4 : 0) | (c3 >= li ? 8 : 0);
        if (!mask) continue;
        const name = mask === 15 ? `t_${LAYER_NAMES[li]}_full${(hash2(dx, dy, 11 + li) * 3) | 0}` : `t_${LAYER_NAMES[li]}_${mask}`;
        spr(ctx, name, X, Y);
      }
    }
  }
  // wetness shading: lower ground is darker and glossier (also hints where water comes first)
  const sh = document.createElement('canvas');
  sh.width = m.Wp; sh.height = m.Hp;
  const sctx = sh.getContext('2d');
  const img = sctx.createImageData(m.Wp, m.Hp);
  const d = img.data;
  const fy = m.F * T;
  for (let y = 0; y < fy; y++) {
    for (let x = 0; x < m.Wp; x++) {
      const k = y * m.Wp + x;
      const e = m.elevPx[k];
      const a = clamp((76 - e) / 34, 0, 1);
      if (a <= 0) continue;
      // ordered dither keeps the pixel-art look
      const bayer = ((x & 1) * 2 + (y & 1) * 3 + ((x >> 1) & 1)) / 6;
      const q = Math.floor(a * 4 + bayer) / 4;
      const o = k * 4;
      d[o] = 52; d[o + 1] = 46; d[o + 2] = 44; d[o + 3] = Math.round(q * 70);
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.drawImage(sh, 0, 0);
  // scattered props
  for (let y = 0; y < m.H; y++) {
    for (let x = 0; x < m.W; x++) {
      const t = m.type[y * m.W + x];
      const r = hash2(x, y, 77);
      const px = x * T + ((hash2(x, y, 5) * 10) | 0) + 1;
      const py = y * T + ((hash2(x, y, 6) * 10) | 0) + 2;
      if (t === 'rock') {
        spr(ctx, `rock${(hash2(x, y, 9) * 3) | 0}`, x * T, y * T - 2);
      } else if (t === 'sand' || t === 'bar') {
        if (r < 0.12) spr(ctx, 'tinyshell', px, py);
        else if (r < 0.2) spr(ctx, 'pebble0', px, py);
      } else if (t === 'mud') {
        if (r < 0.25) spr(ctx, 'crabhole', px, py);
      } else if (t === 'creek' || t === 'sea') {
        if (r < 0.12) spr(ctx, 'seaweed', px, py);
      } else if (t === 'beach') {
        if (r < 0.1) spr(ctx, 'pebble1', px, py);
      }
    }
  }
  // high-tide wrack line along the island shore: where the water stops
  for (let x = 0; x < m.W; x++) {
    for (let y = m.F - 2; y < m.F + 2; y++) {
      const i = y * m.W + x;
      const up = (y - 1) * m.W + x;
      if (y > 0 && m.safe[i] && !m.safe[up]) {
        for (let k = 0; k < 4; k++) {
          const wx = x * T + k * 4 + ((hash2(x, k, 31) * 3) | 0);
          const wy = y * T + 1 + ((hash2(x, k, 32) * 2) | 0);
          const r = hash2(x, k, 33);
          ctx.fillStyle = r < 0.5 ? '#5b9638' : r < 0.8 ? '#8f5a32' : '#d6d0c2';
          ctx.fillRect(wx, wy, 2 + ((r * 3) | 0), 1);
        }
      }
    }
  }
  return cv;
}

export function hasFrame(n) { return !!frame(n); }
export { assets };
