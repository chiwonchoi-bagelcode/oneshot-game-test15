// Capture every screen with a seeded save: home, popups, results (success and swept), both languages.
// node tools/qa/screens.mjs [--w 390 --h 844 --dpr 3] [--lang ko-KR|en-US] [--out dir]
import path from 'node:path';
import fs from 'node:fs';
import { openGame } from './shot.mjs';
import { audit } from './audit.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +arg('w', 390), H = +arg('h', 844), DPR = +arg('dpr', 3);
const lang = arg('lang', 'ko-KR');
const out = arg('out', `/tmp/claude-0/screens_${lang}_${W}x${H}`);
fs.mkdirSync(out, { recursive: true });

function seededSave(extra = {}) {
  const today = new Date();
  const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today.getTime() - 86400000);
  const levels = {};
  for (let i = 1; i <= 12; i++) levels['L' + String(i).padStart(2, '0')] = { stars: i % 3 === 0 ? 3 : i % 2 ? 7 : 1, attempts: 2, clears: 1, best: 0 };
  return {
    v: 1, installId: 'qa-seed', firstOpen: Date.now() - 86400000 * 3, newInstall: false,
    settings: { music: 0.7, sfx: 0.9, vibrate: true, lang: 'auto', quality: 'high' },
    mats: { shell: 38, wood: 21, glass: 14, rope: 6, pearl: 2 },
    buildings: { boardwalk: 2, cottage: 2, haenyeo: 1, shed: 1, lighthouse: 0, stilt: 0 },
    plots: {}, decor: ['flowerbed', 'lantern', 'bench'], levels, current: 13, unlocked: 13,
    stats: { runs: 30, sweeps: 6, arrivals: 24, closeCalls: 5, furthest: 34, picks: 300, chests: 3, playSeconds: 1500 },
    collection: { treasures: { compass: 1, spoon: 1, bell: 1 }, letters: { l1: 1 } },
    daily: { day: dk(yesterday), gift: [], giftTaken: true, tideDone: false, requests: [], requestDay: null },
    streak: { count: 2, lastDay: dk(yesterday), days: 3 },
    tutorial: { done: true, firstBuild: true, seen: { move: 1 } }, fails: {}, debugDayOffset: 0, ...extra,
  };
}

const NOTCH = args.includes('--notch'); // simulate a notch / dynamic island (59px) and a home indicator (34px)
const g = await openGame({ page: 'dev.html', w: W, h: H, dpr: DPR, lang, storage: { 'lowtide.save.v1': JSON.stringify(seededSave()) } });
const pg = g.page;
if (NOTCH) {
  await pg.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = ':root{--sat:59px!important;--sab:34px!important}#safe-probe{padding:59px 0 34px 0!important}';
    document.head.appendChild(st);
  }));
  await pg.reload();
}
let n = 0;
const problems = [];
const shot = async (name) => {
  n++;
  await pg.screenshot({ path: path.join(out, `${String(n).padStart(2, '0')}_${name}.png`) });
  problems.push(...await audit(pg, name));
  if (NOTCH) {
    // nothing tappable may sit under the notch or the home indicator
    problems.push(...(await pg.evaluate(() => [...document.querySelectorAll('#L-hud .btn, #L-home .btn, #L-results .btn, #L-popup .btn')].filter((b) => {
      const r = b.getBoundingClientRect();
      if (!r.width || getComputedStyle(b).visibility === 'hidden' || b.closest('.hidden')) return false;
      let p = b.parentElement; while (p) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return false; p = p.parentElement; }
      return r.top < 59 || r.bottom > innerHeight - 34;
    }).map((b) => `[${'notch'}] button in unsafe area: ${b.className} "${b.textContent.trim().slice(0, 20)}"`))).map((x) => `[${name}] ${x}`));
  }
};
const click = (sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
const closePop = () => pg.evaluate(() => { const x = document.querySelector('.popup .x'); if (x) x.click(); });
await pg.waitForTimeout(2600);
await shot('home');
// popups
for (const [sel, name] of [['.home-side.left .side-btn:nth-child(1) .btn', 'calendar'], ['.home-side.left .side-btn:nth-child(2) .btn', 'daily'], ['.home-side.right .side-btn:nth-child(1) .btn', 'book'], ['.home-side.right .side-btn:nth-child(2) .btn', 'requests'], ['.home-side.right .side-btn:nth-child(3) .btn', 'decor'], ['#L-home .topbar .btn', 'settings']]) {
  const ok = await click(sel);
  await pg.waitForTimeout(500);
  if (ok) await shot('pop_' + name);
  await closePop();
  await pg.waitForTimeout(400);
}
// building popup: tap the lighthouse plot via the app
await pg.evaluate(() => window.__app.ui.openBuilding('lighthouse'));
await pg.waitForTimeout(400);
await shot('pop_building_lighthouse');
await closePop();
await pg.evaluate(() => window.__app.ui.openBuilding('cottage'));
await pg.waitForTimeout(400);
await shot('pop_building_cottage');
await closePop();
// a run with a greedy, slow player to get swept
await pg.evaluate(() => { window.__app.selectLevel(11); window.__app.onGo(); });
await pg.waitForTimeout(2200);
await pg.evaluate(() => window.__autopilot.start({ greed: 60, speed: 0.55, planScale: 0.6 }));
let st = {};
for (let i = 0; i < 60; i++) {
  await pg.waitForTimeout(1000);
  st = await pg.evaluate(() => ({ ws: window.__app.world.state, mode: window.__app.mode, t: window.__app.world.runT }));
  if (i === 12) await shot('run_mid');
  if (st.ws === 'swept' || st.ws === 'arrive' || st.mode === 'results') break;
}
await pg.waitForTimeout(600);
await shot('run_end_' + st.ws);
for (let i = 0; i < 15; i++) { await pg.waitForTimeout(500); st = await pg.evaluate(() => ({ mode: window.__app.mode })); if (st.mode === 'results') break; }
await pg.waitForTimeout(1500);
await shot('results');
await pg.evaluate(() => window.__autopilot.stop());
// pause popup during a run
await pg.evaluate(() => window.__app.retry(false));
await pg.waitForTimeout(2500);
await pg.evaluate(() => window.__autopilot.start({}));
await pg.waitForTimeout(3000);
await pg.evaluate(() => window.__app.pause());
await pg.waitForTimeout(400);
await shot('pause');
// popup scrolling: the title bar and close button must stay put while the body scrolls
await pg.evaluate(() => { window.__app.ui.closeAll(); window.__autopilot.stop(); window.__app.toIsland(); });
await pg.waitForTimeout(1500);
const scrollCheck = await pg.evaluate(async () => {
  const res = [];
  const ui = window.__app.ui;
  for (const open of ['openCalendar', 'openBook', 'openDecor']) {
    ui.closeAll && ui.closeAll();
    ui[open]();
    await new Promise((r) => setTimeout(r, 350));
    const pop = document.querySelector('#L-popup .popup');
    if (!pop) { res.push(open + ': no popup'); continue; }
    const body = [...pop.querySelectorAll('*')].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight);
    const x = pop.querySelector('.x');
    const before = x && x.getBoundingClientRect().top;
    if (body) { body.scrollTop = body.scrollHeight; await new Promise((r) => setTimeout(r, 100)); }
    const after = x && x.getBoundingClientRect().top;
    res.push(`${open}: scrolls=${!!body} closeMoved=${before !== after}`);
  }
  ui.closeAll && ui.closeAll();
  return res;
});
console.log('popup scroll:', scrollCheck.join(' | '));
console.log('audit:', problems.length ? '\n  ' + problems.join('\n  ') : 'no problems');
console.log('errors:', g.errors.filter((e) => !e.includes('404')).join('\n') || 'none');
await g.close();
