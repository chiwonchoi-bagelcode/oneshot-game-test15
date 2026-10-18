// A first-time player's session through real touch input.
// The autopilot only advises a direction (advise mode); this script moves a finger with CDP touch events,
// taps the real buttons, and checks what a new player would hit in the first ~10 minutes:
// tutorial, builds, results, analytics, app switch (audio), next-day relaunch (gift, streak), language switch, save.
// node tools/qa/first-session.mjs [--w 360 --h 640 --dpr 2] [--lang ko-KR] [--runs 8] [--out dir]
import fs from 'node:fs';
import path from 'node:path';
import { openGame } from './shot.mjs';
import { audit } from './audit.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +arg('w', 360), H = +arg('h', 640), DPR = +arg('dpr', 2), lang = arg('lang', 'ko-KR'), RUNS = +arg('runs', 8);
const out = arg('out', `/tmp/claude-0/first_${lang}_${W}x${H}`);
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);
const problems = [];
let shotN = 0;

const g = await openGame({ page: 'dev.html?clean=1', w: W, h: H, dpr: DPR, lang });
const pg = g.page;
const cdp = await pg.context().newCDPSession(pg);
const shot = async (name) => { shotN++; await pg.screenshot({ path: path.join(out, `${String(shotN).padStart(2, '0')}_${name}.png`) }); problems.push(...await audit(pg, name)); };
const st = () => pg.evaluate(() => { const a = window.__app; return a ? { mode: a.mode, ws: a.world && a.world.state, lvl: a.levelN, t: a.world && a.world.runT, popups: a.ui.popupStack.length } : {}; });
const waitFor = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await st(); if (fn(s)) return s; await pg.waitForTimeout(120); } return null; };
const tap = async (sel) => {
  const ok = await pg.locator(sel).first().isVisible().catch(() => false);
  if (!ok) return false;
  await pg.locator(sel).first().tap({ force: true });
  return true;
};
const t0 = Date.now();

// ---- loading ----
const loaded = await pg.waitForFunction(() => { const l = document.getElementById('loading'); return l && l.classList.contains('done'); }, null, { timeout: 20000 }).then(() => Date.now() - t0).catch(() => -1);
log(`loading screen gone after ${loaded} ms`);
await pg.waitForTimeout(400);
await shot('first_screen');

// ---- play runs with a finger ----
async function playRun(r, greed) {
  const s0 = await waitFor((s) => s.mode === 'run' && (s.ws === 'ready' || s.ws === 'intro'), 20000);
  if (!s0) { problems.push(`run ${r}: never reached the run`); return null; }
  await waitFor((s) => s.ws === 'ready' || s.ws === 'play', 8000);
  await pg.evaluate((greed) => window.__autopilot.start({ greed, advise: true, wobble: 0.1 }), greed);
  const cx = Math.round(W * 0.5), cy = Math.round(H * 0.72), R = 40;
  let down = false;
  const t1 = Date.now();
  let shots = 0;
  while (Date.now() - t1 < 120000) {
    const s = await pg.evaluate(() => ({ ws: window.__app.world.state, mode: window.__app.mode, dir: window.__autopilot.dir || null }));
    if (s.mode !== 'run' || ['arrive', 'swept', 'boat', 'done'].includes(s.ws)) break;
    if (s.dir && (s.ws === 'play' || s.ws === 'ready')) {
      const x = cx + s.dir[0] * R * 1.1, y = cy + s.dir[1] * R * 1.1;
      if (!down) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] }); down = true; }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    } else if (down) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); down = false; }
    if (r === 1 && shots < 3 && Date.now() - t1 > 4000 * (shots + 1)) { shots++; await shot(`run${r}_play${shots}`); }
    await pg.waitForTimeout(60);
  }
  if (down) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pg.evaluate(() => window.__autopilot.stop());
  const end = await pg.evaluate(() => window.__app.world.state);
  const res = await waitFor((s) => s.mode === 'results', 15000);
  if (!res) { problems.push(`run ${r}: no results screen`); return end; }
  await pg.waitForTimeout(1600);
  await shot(`run${r}_results_${end}`);
  return end;
}

const runs = [];
for (let r = 1; r <= RUNS; r++) {
  const lvl = (await st()).lvl;
  const end = await playRun(r, r % 3 === 0 ? 4 : 0);
  runs.push(`${lvl}:${end}`);
  // results -> build if offered, then go on
  if (await tap('.results .buildcard .btn')) {
    await pg.waitForTimeout(3500);
    if (r === 1) await shot('after_first_build');
    await waitFor((s) => s.mode === 'island', 8000);
    await pg.waitForTimeout(600);
    await pg.evaluate(() => window.__app.ui.closeAll());
    if (!await tap('.home-bottom .btn')) problems.push(`run ${r}: no head-out button after building`);
  } else if (await tap('.results .rbtns .btn.go')) {
    // next tide or try again
  } else if (await tap('.results .rbtns .btn.wood')) {
    await waitFor((s) => s.mode === 'island', 8000);
    await pg.waitForTimeout(600);
    await pg.evaluate(() => window.__app.ui.closeAll());
    await tap('.home-bottom .btn');
  } else problems.push(`run ${r}: no way forward from results`);
  await pg.waitForTimeout(800);
}
await waitFor((s) => s.mode === 'run', 8000);
await pg.evaluate(() => { if (window.__app.mode === 'run') window.__app.toIsland(); });
await waitFor((s) => s.mode === 'island', 8000);
await pg.waitForTimeout(1200);
await pg.evaluate(() => window.__app.ui.closeAll());
await shot('island_after_session');
const save1 = await pg.evaluate(() => JSON.parse(localStorage.getItem('lowtide.save.v1')));
log('runs (level:end):', runs.join(' '));
log('after session: cleared', Object.values(save1.levels).filter((l) => l.clears).length, 'buildings', JSON.stringify(save1.buildings), 'mats', JSON.stringify(save1.mats));

// ---- analytics events a new player produced ----
const q = await pg.evaluate(() => JSON.parse(localStorage.getItem('lowtide.analytics.queue') || '[]'));
const names = {};
for (const e of q) names[e.name || e.event || e.e] = (names[e.name || e.event || e.e] || 0) + 1;
log('analytics:', JSON.stringify(names));
for (const need of ['first_open', 'tutorial_complete', 'run_start', 'run_end', 'level_complete', 'building_built', 'resource_earn', 'resource_spend']) if (!names[need]) problems.push(`analytics: no ${need}`);

// ---- app switch: audio suspends while hidden and resumes on return ----
const audio = await pg.evaluate(async () => {
  const A = window.__audio;
  const before = A && A.ctx ? A.ctx.state : 'none';
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 400));
  const hidden = A && A.ctx ? A.ctx.state : 'none';
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 600));
  return { before, hidden, after: A && A.ctx ? A.ctx.state : 'none' };
});
log('audio across app switch:', JSON.stringify(audio));
if (audio.after !== 'running' && audio.before === 'running') problems.push('audio did not resume after app switch');

// ---- language switch from settings, applied at once ----
await tap('#L-home .topbar .btn');
await pg.waitForTimeout(400);
const goBefore = await pg.locator('.home-bottom .btn').first().textContent();
const other = lang.startsWith('ko') ? 'English' : '한국어';
await pg.locator('.seg .btn', { hasText: other }).first().tap();
await pg.waitForTimeout(500);
await shot('settings_after_lang');
await pg.evaluate(() => window.__app.ui.closeAll());
await pg.waitForTimeout(300);
const goAfter = await pg.locator('.home-bottom .btn').first().textContent();
log(`language switch: go button "${goBefore.trim()}" -> "${goAfter.trim()}"`);
if (goBefore === goAfter) problems.push('language switch did not change the home screen');
await shot('home_other_language');

// ---- next day: relaunch with the clock a day ahead ----
const ctx2 = pg.context();
await ctx2.addInitScript(() => {
  const off = 86400000 * 1.02;
  const RD = Date;
  // eslint-disable-next-line no-global-assign
  Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } };
});
await pg.reload();
await waitFor((s) => s.mode === 'island' || s.mode === 'run', 15000);
await pg.waitForTimeout(2500);
await shot('next_day_launch');
const save2 = await pg.evaluate(() => JSON.parse(localStorage.getItem('lowtide.save.v1')));
const popup = await pg.evaluate(() => { const p = document.querySelector('#L-popup .popup .head h2'); return p ? p.textContent : null; });
log('next day: popup', JSON.stringify(popup), 'streak', JSON.stringify(save2.streak), 'daily.day', save2.daily.day);
if (save2.streak.count < 2) problems.push('next day: streak did not advance');
// save survived the restart
// (empty level records are created lazily when a tide is shown; they carry no progress)
const norm = (v, k) => (k === 'levels' ? Object.fromEntries(Object.entries(v).filter(([, r]) => r.stars || r.attempts || r.clears || r.best)) : v);
const keep = ['buildings', 'levels', 'unlocked'].every((k) => JSON.stringify(norm(save2[k], k)) === JSON.stringify(norm(save1[k], k)));
log('save kept across restart:', keep);
if (!keep) {
  problems.push('save changed across restart');
  for (const k of ['buildings', 'levels', 'unlocked']) if (JSON.stringify(save2[k]) !== JSON.stringify(save1[k])) log('  diff', k, JSON.stringify(save1[k]), '->', JSON.stringify(save2[k]));
}

log('audit/problems:', problems.length ? '\n  ' + problems.join('\n  ') : 'none');
log('console errors:', g.errors.filter((e) => !e.includes('404')).join('\n') || 'none');
await g.close();
