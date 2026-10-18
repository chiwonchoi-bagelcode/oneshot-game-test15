// Secondary flows by real taps on a mid-game save: overnight gift, grandma's request, decorating, today's tide,
// give up from pause (twice -> slow-tide assist offer), and Start Over. Screens are audited as it goes.
// node tools/qa/flows.mjs [--lang ko-KR] [--w 360 --h 640]
import fs from 'node:fs';
import path from 'node:path';
import { openGame } from './shot.mjs';
import { audit } from './audit.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +arg('w', 360), H = +arg('h', 640), lang = arg('lang', 'ko-KR');
const out = arg('out', `/tmp/claude-0/flows_${lang}`);
fs.mkdirSync(out, { recursive: true });

const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterday = dk(new Date(Date.now() - 86400000));
const levels = {};
for (let i = 1; i <= 8; i++) levels['L' + String(i).padStart(2, '0')] = { stars: 3, attempts: 1, clears: 1, best: 0 };
const seed = {
  v: 1, installId: 'flows', firstOpen: Date.now() - 86400000 * 2, newInstall: false,
  settings: { music: 0.7, sfx: 0.9, vibrate: true, lang: 'auto', quality: 'high' },
  mats: { shell: 60, wood: 30, glass: 25, rope: 8, pearl: 3 },
  buildings: { boardwalk: 1, cottage: 1, haenyeo: 1, shed: 0, lighthouse: 0, stilt: 0 }, plots: {}, decor: [],
  levels, current: 9, unlocked: 9,
  stats: { runs: 12, sweeps: 2, arrivals: 10, closeCalls: 2, furthest: 30, picks: 120, chests: 1, playSeconds: 600 },
  collection: { treasures: {}, letters: {} },
  daily: { day: yesterday, gift: [], giftTaken: true, tideDone: false, requests: [], requestDay: yesterday },
  streak: { count: 1, lastDay: yesterday, days: 1 },
  tutorial: { done: true, firstBuild: true, seen: { move: 1 } }, fails: {}, debugDayOffset: 0,
};

const g = await openGame({ page: 'dev.html?clean=1', w: W, h: H, dpr: 2, lang, storage: { 'lowtide.save.v1': JSON.stringify(seed) } });
const pg = g.page;
const problems = [];
let n = 0;
const shot = async (name) => { n++; await pg.screenshot({ path: path.join(out, `${String(n).padStart(2, '0')}_${name}.png`) }); problems.push(...await audit(pg, name)); };
const S = () => pg.evaluate(() => JSON.parse(localStorage.getItem('lowtide.save.v1')));
const tap = async (sel) => { const l = pg.locator(sel).first(); if (!(await l.isVisible().catch(() => false))) return false; await l.tap({ force: true }); return true; };
const waitFor = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(fn)) return true; await pg.waitForTimeout(120); } return false; };
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) problems.push(msg); };

await waitFor(() => window.__app && window.__app.mode === 'island');
await pg.waitForTimeout(1500);
await pg.evaluate(() => window.__app.ui.closeAll());
await shot('home_new_day');

// 1) overnight gift: tap one on the beach
const before = await S();
const gift = await pg.evaluate(() => {
  const w = window.__app.world, gg = w.gifts[0];
  if (!gg) return null;
  const r = document.getElementById('game').getBoundingClientRect();
  const k = r.width / document.getElementById('game').width;
  return { type: gg.type, x: r.left + (gg.x - w.camX) * k, y: r.top + (gg.y - w.camY) * k, count: w.gifts.length };
});
if (gift) {
  await pg.touchscreen.tap(gift.x, gift.y);
  await pg.waitForTimeout(500);
  const after = await S();
  const left = await pg.evaluate(() => window.__app.world.gifts.length);
  ok(left === gift.count - 1 && (after.mats[gift.type] || 0) === (before.mats[gift.type] || 0) + 1, `gift: tapping a ${gift.type} on the beach collects it (${gift.count} -> ${left})`);
  // every gift must be reachable by a tap (not under a button)
  const covered = await pg.evaluate(() => {
    const w = window.__app.world, c = document.getElementById('game'), r = c.getBoundingClientRect(), k = r.width / c.width;
    return w.gifts.filter((gg) => { const e = document.elementFromPoint(r.left + (gg.x - w.camX) * k, r.top + (gg.y - w.camY) * k); return e && e.id !== 'touch' && e.id !== 'game'; }).length;
  });
  ok(covered === 0, `gift: none of the remaining gifts sit under a button (${covered} covered)`);
} else ok(false, 'gift: no overnight gifts on a new day');

// 2) grandma's request
await tap('.home-side.right .side-btn:nth-child(2) .btn');
await pg.waitForTimeout(500);
await shot('requests');
const reqs = (await S()).daily.requests;
const doable = reqs.findIndex((r) => (before.mats[r.mat] || 0) >= r.n);
if (doable >= 0) {
  const m0 = await S();
  await pg.locator('#L-popup .lrow').nth(doable).locator('.btn.go').tap({ force: true });
  await pg.waitForTimeout(400);
  const m1 = await S();
  const r = m1.daily.requests[doable];
  ok(r.done && m1.mats[r.mat] === m0.mats[r.mat] - r.n, `request: giving ${r.n} ${r.mat} for ${JSON.stringify(r.reward)} works`);
} else ok(false, 'request: none affordable with ' + JSON.stringify(before.mats) + ' -> ' + JSON.stringify(reqs.map((r) => `${r.n} ${r.mat}`)));
await pg.evaluate(() => window.__app.ui.closeAll());

// 3) decorate
const d0 = (await S()).decor.length;
await tap('.home-side.right .side-btn:nth-child(3) .btn');
await pg.waitForTimeout(500);
await shot('decor');
await tap('#L-popup .cell .btn.go');
await pg.waitForTimeout(500);
const d1 = (await S()).decor.length;
ok(d1 === d0 + 1, `decor: placing one fills a slot (${d0} -> ${d1})`);
await pg.evaluate(() => window.__app.ui.closeAll());
await pg.waitForTimeout(600);
await shot('home_with_decor');

// 4) today's tide
await tap('.home-side.left .side-btn:nth-child(2) .btn');
await pg.waitForTimeout(500);
await shot('daily_popup');
await tap('#L-popup .foot .btn');
const ran = await waitFor(() => window.__app.mode === 'run' && window.__app.isDaily, 8000);
ok(ran, 'daily: head out starts today\'s tide');
await waitFor(() => ['ready', 'play'].includes(window.__app.world.state), 8000);
await pg.evaluate(() => window.__autopilot.start({ greed: 0 }));
await waitFor(() => window.__app.mode === 'results', 120000);
await pg.evaluate(() => window.__autopilot.stop());
await pg.waitForTimeout(1500);
await shot('daily_results');
const dsv = await S();
const success = await pg.evaluate(() => !!document.querySelector('.results h2') && !/휩쓸|Swept/.test(document.querySelector('.results h2').textContent));
ok(!success || dsv.daily.tideDone, `daily: a safe return marks today's tide done (success=${success}, done=${dsv.daily.tideDone})`);
await tap('.results .rbtns .btn.wood');
await waitFor(() => window.__app.mode === 'island', 8000);
await pg.waitForTimeout(800);
await pg.evaluate(() => window.__app.ui.closeAll());

// 5) give up from pause, twice on the same tide -> the slow-tide offer
for (let k = 1; k <= 2; k++) {
  if (k === 1) await tap('.home-bottom .btn');
  else await tap('.results .rbtns .btn.go');
  await waitFor(() => window.__app.mode === 'run' && ['ready', 'play'].includes(window.__app.world.state), 10000);
  await pg.evaluate(() => window.__autopilot.start({ greed: 0 }));
  await waitFor(() => window.__app.world.player.bag.length >= 3, 30000);
  await pg.evaluate(() => window.__autopilot.stop());
  await tap('#L-hud .btn');
  await pg.waitForTimeout(400);
  if (k === 1) await shot('pause');
  await tap('#L-popup .foot .btn.wood');
  const res = await waitFor(() => window.__app.mode === 'results', 20000);
  ok(res, `give up ${k}: ends the run as swept and shows results`);
  await pg.waitForTimeout(1500);
}
await shot('results_after_two_fails');
const offered = await pg.locator('.results .btn.sea').first().isVisible().catch(() => false);
ok(offered, 'assist: "slower tide" is offered after two misses');
if (offered) {
  await pg.locator('.results .btn.sea').first().tap({ force: true });
  const assisted = await waitFor(() => window.__app.mode === 'run' && !!window.__app.world.assist, 8000);
  ok(assisted, 'assist: tapping it starts the tide with the slower water');
  await pg.waitForTimeout(1200);
  await shot('assist_run');
  await pg.evaluate(() => window.__app.toIsland());
  await waitFor(() => window.__app.mode === 'island', 8000);
}

// 6) Start Over
await pg.evaluate(() => window.__app.ui.closeAll());
await tap('#L-home .topbar .btn');
await pg.waitForTimeout(400);
await pg.locator('#L-popup .setrow .btn', { hasText: lang.startsWith('ko') ? '처음부터' : 'Start Over' }).first().tap({ force: true });
await pg.waitForTimeout(400);
await shot('reset_confirm');
await tap('#L-popup .foot .btn.primary');
await pg.waitForTimeout(2500);
const fresh = await S();
ok(fresh && Object.keys(fresh.levels || {}).length === 0 && !fresh.buildings.boardwalk, 'start over: progress is wiped and the first tide begins');
await shot('after_reset');

console.log('audit:', problems.length ? '\n  ' + problems.join('\n  ') : 'no problems');
console.log('console errors:', g.errors.filter((e) => !e.includes('404')).join('\n') || 'none');
await g.close();
