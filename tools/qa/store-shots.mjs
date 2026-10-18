// Raw 1080x1920 store screenshots that the trailer footage doesn't cover: a swept run's results
// (with the turn-back map) and the grown village with its home UI. node tools/qa/store-shots.mjs [--en]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame } from './shot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const en = process.argv.includes('--en');
const lang = en ? 'en-US' : 'ko-KR';
const OUT = path.join(root, '.cache', 'store', en ? 'en' : 'ko');
fs.mkdirSync(OUT, { recursive: true });

const dk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function save(extra) {
  const levels = {};
  for (let i = 1; i <= 29; i++) levels['L' + String(i).padStart(2, '0')] = { stars: 7, attempts: 2, clears: 1, best: 0 };
  return JSON.stringify({
    v: 1, installId: 'store', firstOpen: Date.now() - 86400000 * 4, newInstall: false,
    settings: { music: 0.7, sfx: 0.9, vibrate: true, lang: 'auto', quality: 'high' },
    mats: { shell: 46, wood: 23, glass: 18, rope: 9, pearl: 3 },
    buildings: { boardwalk: 3, cottage: 3, haenyeo: 1, shed: 2, lighthouse: 2, stilt: 1 }, plots: {},
    decor: ['flowerbed', 'lantern', 'bench', 'flag', 'chime', 'well', 'lantern', 'flowerbed'],
    levels, current: 30, unlocked: 30,
    stats: { runs: 60, sweeps: 9, arrivals: 51, closeCalls: 8, furthest: 44, picks: 700, chests: 6, playSeconds: 4000 },
    collection: { treasures: { compass: 1, spoon: 1, bell: 1 }, letters: { l1: 1, l2: 1 } },
    daily: { day: dk(new Date()), gift: [], giftTaken: true, tideDone: true, requests: [], requestDay: dk(new Date()) },
    streak: { count: 3, lastDay: dk(new Date()), days: 4 },
    tutorial: { done: true, firstBuild: true, seen: { move: 1 } }, fails: {}, debugDayOffset: 0, ...extra,
  });
}
const waitIn = async (pg, cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(cond)) return true; await pg.waitForTimeout(150); } return false; };

// 1) the grown village, home UI visible
if (!process.argv.includes('--swept-only')) {
  const g = await openGame({ page: 'dev.html?clean=1', w: 360, h: 640, dpr: 3, lang, storage: { 'lowtide.save.v1': save({}) } });
  await waitIn(g.page, () => window.__app && window.__app.mode === 'island');
  await g.page.waitForTimeout(2500);
  await g.page.screenshot({ path: path.join(OUT, 'village.png') });
  // the lighthouse popup: what a building changes, in numbers
  await g.page.evaluate(() => window.__app.ui.openBuilding('cottage'));
  await g.page.waitForTimeout(600);
  await g.page.screenshot({ path: path.join(OUT, 'building.png') });
  await g.close();
}

// 2) a greedy run on tide 11 that gets swept, then its results
{
  const lv = { boardwalk: 2, cottage: 1, haenyeo: 1, shed: 1, lighthouse: 0, stilt: 0 };
  const levels = {};
  for (let i = 1; i <= 10; i++) levels['L' + String(i).padStart(2, '0')] = { stars: 7, attempts: 1, clears: 1, best: 0 };
  let ok = false;
  for (let attempt = 0; attempt < 6 && !ok; attempt++) {
    const g = await openGame({ page: 'dev.html?clean=1', w: 360, h: 640, dpr: 3, lang, storage: { 'lowtide.save.v1': save({ buildings: lv, levels, current: 11, unlocked: 11, decor: [] }) } });
    const pg = g.page;
    await waitIn(pg, () => window.__app && window.__app.mode === 'island');
    await pg.evaluate(() => { window.__app.selectLevel(11); window.__app.onGo(); });
    await waitIn(pg, () => window.__app.world && window.__app.world.state === 'play' || window.__app.world.state === 'intro');
    await pg.waitForTimeout(1500);
    await pg.evaluate((a) => window.__autopilot.start({ greed: 60 + a * 10, speed: 0.6, planScale: 0.6 }), attempt);
    await waitIn(pg, () => ['swept', 'arrive'].includes(window.__app.world.state) || window.__app.mode === 'results', 90000);
    const st = await pg.evaluate(() => window.__app.world.state);
    if (st === 'swept') {
      await waitIn(pg, () => window.__app.mode === 'results', 20000);
      await pg.waitForTimeout(2600);
      await pg.screenshot({ path: path.join(OUT, 'swept.png') });
      console.log('results body overflow (px):', await pg.evaluate(() => { const b = document.querySelector('.results .rbody'); return b ? b.scrollHeight - b.clientHeight : null; }));
      ok = true;
    }
    console.log('attempt', attempt, st);
    await g.close();
  }
}
console.log('done', OUT);
