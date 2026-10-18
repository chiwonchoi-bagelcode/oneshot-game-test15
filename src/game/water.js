// Per-pixel tide water for the visible window. Pixel-art bands with ordered dithering,
// a lapping foam edge, and a darkening wet-sand band just before the water arrives.
import BAL from '../data/balance.json';

function rgba(r, g, b, a) { return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; }
function hex(h, a) {
  const n = parseInt(h.slice(1), 16);
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

const BANDS = [
  hex('#bff0e6', 150),
  hex('#9fe2dc', 170),
  hex('#62bccb', 190),
  hex('#4aa3c0', 210),
  hex('#3f8db0', 228),
  hex('#2c638e', 244),
];
const FOAM = hex('#f4fffb', 240);
const FOAM2 = hex('#d8f6f0', 200);
const GLINT = hex('#e8fbff', 230);
const STROKE = hex('#7cc9d6', 230);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const WET = [];
for (let i = 0; i <= 8; i++) WET.push(rgba(46, 42, 50, Math.round(i / 8 * 78)));

const NOISE = new Float32Array(64 * 64);
(function () {
  let s = 1234567;
  for (let i = 0; i < NOISE.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; NOISE[i] = s / 0x7fffffff; }
})();

export class Water {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.w = 0; this.h = 0;
    this.lapRow = null;
    this.frame = 0;
  }
  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.img = this.ctx.createImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.lapRow = new Float32Array(h);
    this.lapCol = new Float32Array(w);
  }
  // m: model, level: water level, t: seconds, camX/camY: world px of the view's top-left
  render(m, level, t, camX, camY) {
    const { w, h, buf } = this;
    const Wp = m.Wp, Hp = m.Hp, flood = m.floodPx, elev = m.elevPx;
    const wetBand = BAL.move.wetBand;
    for (let y = 0; y < h; y++) this.lapRow[y] = Math.sin(t * 1.6 + (y + camY) * 0.19) * 0.45 + Math.sin(t * 0.7 + (y + camY) * 0.05) * 0.35;
    for (let x = 0; x < w; x++) this.lapCol[x] = Math.sin(t * 1.1 + (x + camX) * 0.11) * 0.3;
    const tStroke = (t * 5) | 0;
    const tGl = (t * 3) | 0;
    let o = 0;
    for (let y = 0; y < h; y++) {
      const wy = y + camY;
      const lr = this.lapRow[y];
      const inY = wy >= 0 && wy < Hp;
      const rowBase = wy * Wp;
      const by = (wy & 3) * 4;
      for (let x = 0; x < w; x++, o++) {
        const wx = x + camX;
        let fl, e;
        if (inY && wx >= 0 && wx < Wp) {
          const k = rowBase + wx;
          fl = flood[k]; e = elev[k];
        } else {
          fl = -60; e = -60;
        }
        const L = level + lr + this.lapCol[x];
        if (L <= fl) {
          const gap = fl - L;
          if (gap < wetBand && fl < 100) {
            const q = Math.min(8, Math.floor((1 - gap / wetBand) * 8 + BAYER[by + (wx & 3)] - 0.5));
            buf[o] = q > 0 ? WET[q] : 0;
          } else buf[o] = 0;
          continue;
        }
        const d = L - e;
        const bay = BAYER[by + (wx & 3)];
        if (d < 0.7 + bay * 0.5) { buf[o] = (((wx + wy + tGl) & 3) === 0) ? FOAM2 : FOAM; continue; }
        let bi = Math.floor(Math.sqrt(d) * 1.15 + bay - 0.6);
        if (bi < 0) bi = 0; else if (bi > 5) bi = 5;
        let c = BANDS[bi];
        if (d > 4) {
          // drifting wave strokes, sparse so deep water stays calm to the eye
          const nx = ((wx + tStroke) >> 1) & 63, ny = (wy >> 2) & 63;
          const n = NOISE[ny * 64 + nx];
          if (((wy + (tStroke >> 3)) % 10) === 0 && n > 0.7) c = STROKE;
          else if (n > 0.996 && ((wx + wy) & 1)) c = GLINT;
        }
        buf[o] = c;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.frame++;
    return this.canvas;
  }
}
