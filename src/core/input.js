// One-thumb floating joystick + tap detection on the game layer.
import BAL from '../data/balance.json';
import { screen } from './screen.js';

export const input = {
  active: false,
  ox: 0, oy: 0,      // origin (css px, root-relative)
  px: 0, py: 0,      // current finger (css px)
  vx: 0, vy: 0,      // normalised direction * magnitude (0..1)
  mag: 0,
  enabled: true,
  onTap: null,       // (cssX, cssY) => void
  onFirstMove: null,
  moved: false,
  _id: null, _downT: 0, _travel: 0,
};

function radiusCss() {
  return Math.max(36, Math.min(64, screen.cssW * 0.13));
}

function rel(e) {
  const r = screen.root.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

export function initInput(layer) {
  layer.addEventListener('pointerdown', (e) => {
    if (input._id !== null) return;
    input._id = e.pointerId;
    try { layer.setPointerCapture(e.pointerId); } catch (_) { /* old browsers */ }
    const [x, y] = rel(e);
    input.ox = input.px = x;
    input.oy = input.py = y;
    input._downT = performance.now();
    input._travel = 0;
    input.active = input.enabled;
    input.vx = input.vy = input.mag = 0;
    e.preventDefault();
  }, { passive: false });
  layer.addEventListener('pointermove', (e) => {
    if (e.pointerId !== input._id) return;
    const [x, y] = rel(e);
    input._travel += Math.hypot(x - input.px, y - input.py);
    input.px = x;
    input.py = y;
    if (!input.active) return;
    let dx = x - input.ox, dy = y - input.oy;
    const R = radiusCss();
    let d = Math.hypot(dx, dy);
    // drag the origin along when the thumb goes past the ring so direction changes stay instant
    if (d > R * 1.25) {
      const k = (d - R * 1.25) / d;
      input.ox += dx * k;
      input.oy += dy * k;
      dx = x - input.ox; dy = y - input.oy;
      d = Math.hypot(dx, dy);
    }
    const m = d / R;
    const dz = BAL.player.deadZone;
    if (m < dz) { input.vx = input.vy = input.mag = 0; return; }
    const mag = Math.min(1, (m - dz) / (BAL.player.fullSpeedAt - dz));
    input.vx = dx / d * mag;
    input.vy = dy / d * mag;
    input.mag = mag;
    if (!input.moved && mag > 0.2) {
      input.moved = true;
      if (input.onFirstMove) input.onFirstMove();
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    if (e.pointerId !== input._id) return;
    const dt = performance.now() - input._downT;
    if (dt < 350 && input._travel < 12 && input.onTap) input.onTap(input.px, input.py);
    input._id = null;
    input.active = false;
    input.vx = input.vy = input.mag = 0;
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);
  layer.addEventListener('lostpointercapture', (e) => { if (e.pointerId === input._id) end(e); });
  window.addEventListener('blur', () => { input._id = null; input.active = false; input.vx = input.vy = input.mag = 0; });
}

export function joystickRadiusCss() { return radiusCss(); }
