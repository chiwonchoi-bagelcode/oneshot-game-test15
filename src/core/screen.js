// Canvas setup with integer pixel scaling so pixel art stays crisp.
export const screen = {
  canvas: null, ctx: null, root: null,
  bw: 208, bh: 400, scale: 1, dpr: 1, cssW: 360, cssH: 640,
  // safe-area insets in base pixels and css pixels
  safe: { top: 0, bottom: 0, left: 0, right: 0 },
  safeCss: { top: 0, bottom: 0, left: 0, right: 0 },
  listeners: [],
};

const TARGET_W = 208;

function readSafeArea() {
  const probe = document.getElementById('safe-probe');
  if (!probe) return { top: 0, bottom: 0, left: 0, right: 0 };
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0,
  };
}

export function resize() {
  const root = screen.root;
  // a host page may pad the document by the safe-area insets (e.g. when embedded); fit inside that padding
  const rs = getComputedStyle(document.documentElement);
  const padY = (parseFloat(rs.paddingTop) || 0) + (parseFloat(rs.paddingBottom) || 0);
  const vw = window.innerWidth, vh = window.innerHeight - padY;
  // keep a portrait phone column on wide (desktop) windows
  let cssW = vw, cssH = vh;
  if (cssW > cssH * 0.62) cssW = Math.round(cssH * 0.5625);
  root.style.width = cssW + 'px';
  root.style.height = cssH + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 4);
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  let best = 1, bestErr = Infinity;
  for (let s = 1; s <= 16; s++) {
    const bw = devW / s;
    if (bw < 172) break;
    const err = Math.abs(bw - TARGET_W);
    if (err < bestErr) { best = s; bestErr = err; }
  }
  screen.scale = best;
  screen.dpr = dpr;
  screen.bw = Math.ceil(devW / best);
  screen.bh = Math.ceil(devH / best);
  screen.cssW = cssW;
  screen.cssH = cssH;
  const c = screen.canvas;
  c.width = screen.bw;
  c.height = screen.bh;
  c.style.width = (screen.bw * best / dpr) + 'px';
  c.style.height = (screen.bh * best / dpr) + 'px';
  screen.ctx.imageSmoothingEnabled = false;
  const s = readSafeArea();
  screen.safeCss = s;
  const k = screen.bw / cssW;
  screen.safe = { top: Math.ceil(s.top * k), bottom: Math.ceil(s.bottom * k), left: Math.ceil(s.left * k), right: Math.ceil(s.right * k) };
  root.style.setProperty('--px', (best / dpr) + 'px');
  for (const fn of screen.listeners) fn();
}

export function initScreen(root, canvas) {
  screen.root = root;
  screen.canvas = canvas;
  screen.ctx = canvas.getContext('2d', { alpha: false });
  resize();
  let pending = 0;
  const onResize = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(resize);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

// css px (relative to root) -> base px
export function cssToBase(x, y) {
  const k = screen.bw / screen.cssW;
  return [x * k, y * k];
}
export function baseToCss(x, y) {
  const k = screen.cssW / screen.bw;
  return [x * k, y * k];
}
