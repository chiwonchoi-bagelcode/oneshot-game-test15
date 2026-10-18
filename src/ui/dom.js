// Small DOM helpers: element builder, pixel icons from the UI atlas, guarded taps.
import UI from '../data/atlas_ui.json';
import { audioUi } from './sfxhook.js';

const ATLAS_W = 256, ATLAS_H = 128;

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

// pixel icon sized `size` css px; sprite is scaled by an integer-ish factor and centred
export function icon(name, size = 32, extra = '') {
  const f = UI['i_' + name] || UI[name];
  const el = document.createElement('i');
  el.className = 'ic ' + extra;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  if (!f) return el;
  const [x, y, w, hh] = f;
  const s = size / 16;
  el.style.backgroundSize = `${ATLAS_W * s}px ${ATLAS_H * s}px`;
  const ox = (size - w * s) / 2, oy = (size - hh * s) / 2;
  el.style.backgroundPosition = `${-x * s + ox}px ${-y * s + oy}px`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function iconStyle(el, name, size) {
  const f = UI['i_' + name] || UI[name];
  if (!f) return;
  const [x, y, w, hh] = f;
  const s = size / 16;
  el.style.backgroundSize = `${ATLAS_W * s}px ${ATLAS_H * s}px`;
  el.style.backgroundPosition = `${-x * s + (size - w * s) / 2}px ${-y * s + (size - hh * s) / 2}px`;
}

// One guard for all buttons: ignores repeats within 350ms and taps while a transition is running.
export const ui = { busyUntil: 0 };
export function busy(ms) { ui.busyUntil = Math.max(ui.busyUntil, performance.now() + ms); }

export function onTap(el, fn, opts = {}) {
  let last = 0;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = performance.now();
    if (now - last < 350) return;
    if (!opts.always && now < ui.busyUntil) return;
    if (el.disabled || el.classList.contains('disabled')) { if (opts.onDisabled) opts.onDisabled(); return; }
    last = now;
    audioUi(opts.sound || 'tap');
    fn(e);
  });
  // stop the joystick layer from seeing UI touches
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  return el;
}

export function btn(label, cls, fn, opts) {
  const kids = [];
  if (opts && opts.icon) kids.push(icon(opts.icon, opts.iconSize || 28));
  if (label) kids.push(h('span', { class: 'lbl' }, label));
  const b = h('button', { class: 'btn ' + (cls || ''), type: 'button', 'aria-label': opts && opts.aria ? opts.aria : undefined }, ...kids);
  if (fn) onTap(b, fn, opts);
  return b;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
