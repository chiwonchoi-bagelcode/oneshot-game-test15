// Tap-to-skip: arrival sequence, results count-up and build reveal each finish early on a tap.
import { openGame } from './shot.mjs';
const save = JSON.stringify({ v: 1, newInstall: false, mats: { shell: 50, wood: 50, glass: 50, rope: 50, pearl: 10 }, buildings: { boardwalk: 1 }, levels: { L01: { stars: 1, clears: 1, attempts: 1 } }, current: 2, unlocked: 2, tutorial: { done: true, firstBuild: true, seen: { move: 1 } } });
async function arrival(tapIt) {
  const g = await openGame({ page: 'dev.html?clean=1', w: 360, h: 640, dpr: 1, storage: { 'lowtide.save.v1': save } });
  const pg = g.page;
  await pg.waitForTimeout(2000);
  await pg.evaluate(() => { window.__app.ui.closeAll(); window.__app.selectLevel(1); window.__app.onGo(); });
  await pg.waitForTimeout(2200);
  // a short trip: a few steps out and straight back
  await pg.evaluate(() => window.__autopilot.runScript([{ x: 5.5, y: 48.5 }, { home: true }]));
  const t0 = Date.now();
  while (Date.now() - t0 < 40000 && !(await pg.evaluate(() => window.__app.world.state === 'arrive'))) await pg.waitForTimeout(50);
  const ta = Date.now();
  if (tapIt) { await pg.waitForTimeout(250); await pg.touchscreen.tap(180, 300); }
  while (Date.now() - ta < 15000 && !(await pg.evaluate(() => window.__app.mode === 'results'))) await pg.waitForTimeout(50);
  const toResults = Date.now() - ta;
  // results count-up: tap right away and read the haul numbers
  let counted = null;
  if (tapIt) {
    await pg.waitForTimeout(60);
    await pg.touchscreen.tap(180, 500);
    await pg.waitForTimeout(60);
    counted = await pg.evaluate(() => [...document.querySelectorAll('.results .haul .it span')].map((e) => e.textContent).join(','));
  }
  await g.close();
  return { toResults, counted };
}
const slow = await arrival(false), fast = await arrival(true);
console.log(`arrival -> results: ${slow.toResults} ms without tap, ${fast.toResults} ms with a tap`);
console.log(`results haul right after a tap: ${fast.counted}`);
