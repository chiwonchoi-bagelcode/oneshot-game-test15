// Automated playthrough with screenshots: fresh install -> first tide -> results -> build -> next tides.
// node tools/qa/playtest.mjs [--runs 3] [--w 390 --h 844] [--out dir] [--lang ko-KR] [--greed 0]
import path from 'node:path';
import fs from 'node:fs';
import { openGame } from './shot.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = arg('out', '/tmp/claude-0/play');
fs.mkdirSync(out, { recursive: true });
const runs = +arg('runs', 2);
const g = await openGame({ page: 'dev.html', w: +arg('w', 390), h: +arg('h', 844), dpr: +arg('dpr', 3), lang: arg('lang', 'ko-KR') });
const pg = g.page;
let n = 0;
const shot = async (name) => { n++; await pg.screenshot({ path: path.join(out, `${String(n).padStart(2, '0')}_${name}.png`) }); };
const state = () => pg.evaluate(() => ({ mode: window.__app && window.__app.mode, ws: window.__app && window.__app.world.state, t: window.__app && window.__app.world.runT, lvl: window.__app && window.__app.levelN }));
const waitFor = async (fn, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await state(); if (fn(s)) return s; await pg.waitForTimeout(200); } return state(); };

await pg.waitForTimeout(800);
await shot('title');
for (let r = 0; r < runs; r++) {
  await waitFor((s) => s.mode === 'run' || s.mode === 'island', 15000);
  let s = await state();
  if (s.mode === 'island') {
    await shot(`island_before_run${r + 1}`);
    await pg.evaluate(() => window.__app.onGo());
  }
  await waitFor((s2) => s2.ws === 'ready', 10000);
  await shot(`run${r + 1}_ready`);
  await pg.evaluate((greed) => window.__autopilot.start({ greed }), +arg('greed', 0));
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < 90000) {
    s = await state();
    if (s.ws === 'arrive' || s.ws === 'swept' || s.mode === 'results') break;
    await pg.waitForTimeout(2500);
    k++;
    await shot(`run${r + 1}_t${k}`);
  }
  await pg.waitForTimeout(500);
  await shot(`run${r + 1}_end`);
  await waitFor((s2) => s2.mode === 'results', 15000);
  await pg.waitForTimeout(1500);
  await shot(`run${r + 1}_results`);
  await pg.evaluate(() => window.__autopilot.stop());
  // build if offered, else go next or retry
  const clicked = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('.buildcard .btn')][0];
    if (b) { b.click(); return 'build'; }
    const go = [...document.querySelectorAll('.rbtns .btn.go')][0];
    if (go) { go.click(); return 'go'; }
    return 'none';
  });
  if (clicked === 'build') {
    await pg.waitForTimeout(900);
    await shot(`run${r + 1}_building`);
    await pg.waitForTimeout(2200);
    await shot(`run${r + 1}_built`);
  }
}
await shot('final');
console.log('errors:', g.errors.filter((e) => !e.includes('404')).join('\n') || 'none');
await g.close();
