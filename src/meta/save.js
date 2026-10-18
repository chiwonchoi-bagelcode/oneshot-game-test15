// Local save (versioned). Written on every meaningful change and when the app goes to background.
import { cloud } from '../platform/account.js';

const KEY = 'lowtide.save.v1';
export const SAVE_VERSION = 1;

export function dayKey(offsetDays = 0, now = Date.now()) {
  const d = new Date(now + offsetDays * 86400000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function daysBetween(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]), tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86400000);
}

function uuid() {
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
}

export function freshSave() {
  return {
    v: SAVE_VERSION,
    installId: uuid(),
    firstOpen: Date.now(),
    newInstall: true,
    settings: { music: 0.7, sfx: 0.9, vibrate: true, lang: 'auto', quality: 'high' },
    mats: { shell: 2, wood: 1, glass: 0, rope: 0, pearl: 0 },
    buildings: { boardwalk: 0, cottage: 0, haenyeo: 0, shed: 0, lighthouse: 0, stilt: 0 },
    plots: {},
    decor: [],
    levels: {},
    current: 1,
    unlocked: 1,
    stats: { runs: 0, sweeps: 0, arrivals: 0, closeCalls: 0, furthest: 0, picks: 0, chests: 0, playSeconds: 0 },
    collection: { treasures: {}, letters: {} },
    daily: { day: null, gift: [], giftTaken: false, tideDone: false, requests: [], requestDay: null },
    streak: { count: 0, lastDay: null, days: 0 },
    tutorial: { done: false, firstBuild: false, seen: {} },
    fails: {},
    debugDayOffset: 0,
  };
}

function migrate(s) {
  const f = freshSave();
  // fill any missing keys from the fresh template (forward compatible)
  const fill = (dst, src) => {
    for (const k of Object.keys(src)) {
      if (dst[k] === undefined) dst[k] = src[k];
      else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof dst[k] === 'object') fill(dst[k], src[k]);
    }
  };
  fill(s, f);
  s.v = SAVE_VERSION;
  return s;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') { s.newInstall = false; return migrate(s); }
    }
  } catch (_) { /* corrupted or blocked storage: start fresh */ }
  return freshSave();
}

let timer = 0;
export function writeSave(s, immediate = false) {
  const doWrite = () => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* storage blocked */ }
    cloud.push(s);
  };
  clearTimeout(timer);
  if (immediate) doWrite(); else timer = setTimeout(doWrite, 250);
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}
