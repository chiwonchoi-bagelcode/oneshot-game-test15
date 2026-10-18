// Captures real gameplay for the trailer (first tide -> close call -> build -> next tide -> village).
// Output: .cache/trailer/<segment>/f*.jpg + segments.json (frame times + sound log, same clock).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame } from '../qa/shot.mjs';
import { SLOW_INIT, setupSlow, setRate, captureSegment } from './slowcap.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lang = process.argv.includes('--en') ? 'en-US' : 'ko-KR';
const OUT = path.join(root, '.cache', lang === 'en-US' ? 'trailer_en' : 'trailer');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const SLOW = 0.2;
const segs = {};

async function session(storage) {
  const g = await openGame({ page: 'dev.html?clean=1', w: 360, h: 640, dpr: 3, lang, storage });
  await g.context.addInitScript(SLOW_INIT(1));
  await g.page.reload();
  await g.page.waitForTimeout(1500);
  const cdp = await setupSlow(g.page, 1);
  return { g, pg: g.page, cdp };
}
const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
const waitIn = async (pg, cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await pg.evaluate(cond)) return true; await pg.waitForTimeout(100); } return false; };

// ---------- 1) the very first tide (fresh install) ----------
{
  const { g, pg, cdp } = await session(null);
  // first launch: title, then the tide goes out by itself
  await waitIn(pg, () => window.__app && window.__app.mode === 'run' && window.__app.world.state === 'intro');
  await ev(pg, () => { window.__recLog = []; });
  await ev(pg, () => window.__autopilot.runScript([
    { x: 5.5, y: 50.6 }, { x: 5.33, y: 49.67 }, { x: 5.17, y: 48.73 }, { x: 5.0, y: 47.8 }, { x: 4.83, y: 46.55 }, { x: 5.38, y: 45.74 },
    { x: 6.44, y: 45.37 }, { x: 7.02, y: 46.06 }, { x: 7.57, y: 45.59 }, { x: 8.29, y: 46.31 }, { x: 9.0, y: 45.4 }, { x: 10.6, y: 45.3 },
    { x: 8.0, y: 46.6 }, { x: 5.0, y: 46.8 }, { x: 4.3, y: 46.9 },
    // wait at the creek bank until the tide is about to turn, then reach for the glass: "just one more"
    { waitSlack: 5.0 }, { x: 3.25, y: 45.4 }, { home: true },
  ]));
  await setRate(pg, cdp, SLOW);
  const a = await captureSegment(pg, cdp, OUT, 'run1a', { maxSec: 22, until: () => ev(pg, () => window.__autopilot.script && window.__autopilot.script[0] && window.__autopilot.script[0].waitSlack !== undefined) });
  // fast-forward through the wait at the creek bank, then capture the grab and the race home
  await setRate(pg, cdp, 1);
  await waitIn(pg, () => window.__app.world.slack < 9.5, 90000);
  await setRate(pg, cdp, SLOW);
  const b = await captureSegment(pg, cdp, OUT, 'run1b', { maxSec: 26, until: () => ev(pg, () => window.__app.mode === 'results') });
  const b2 = await captureSegment(pg, cdp, OUT, 'run1c', { maxSec: 2.2 });
  const log1 = await ev(pg, () => window.__recLog);
  // build the boardwalk from the results card
  await ev(pg, () => { window.__recLog = []; const bb = document.querySelector('.buildcard .btn'); if (bb) bb.click(); });
  const c = await captureSegment(pg, cdp, OUT, 'build', { maxSec: 5.2 });
  const logB = await ev(pg, () => window.__recLog);
  // next tide: on the new boardwalk across the creek
  await ev(pg, () => { window.__recLog = []; window.__app.onGo(); });
  await waitIn(pg, () => window.__app.world.state === 'intro');
  // tide 2 if the first tide was cleared: up the boardwalk, over the creek, into the far flats
  const lvN = await ev(pg, () => window.__app.levelN);
  console.log('second run is tide', lvN);
  await ev(pg, () => window.__autopilot.runScript([{ x: 5.5, y: 46 }, { x: 5.5, y: 39.6 }, { x: 6.2, y: 37.8 }, { x: 7.4, y: 36.4 }, { x: 8.4, y: 34.6 }, { x: 9.4, y: 32.6 }]));
  const d = await captureSegment(pg, cdp, OUT, 'run2', { maxSec: 9 });
  const logD = await ev(pg, () => window.__recLog);
  segs.run1a = a; segs.run1b = b; segs.run1c = b2; segs.build = c; segs.run2 = d;
  segs.logs = { run1: log1, build: logB, run2: logD };
  await g.close();
}

// ---------- 2) the village growing (real saves at later progress) ----------
function save(b, decor, unlocked) {
  return JSON.stringify({
    v: 1, installId: 'trailer', firstOpen: Date.now(), newInstall: false,
    settings: { music: 0.7, sfx: 0.9, vibrate: true, lang: 'auto', quality: 'high' },
    mats: { shell: 40, wood: 30, glass: 20, rope: 10, pearl: 4 }, buildings: b, plots: {}, decor,
    levels: {}, current: unlocked, unlocked, stats: { runs: 40, sweeps: 5, arrivals: 35, closeCalls: 6, furthest: 40, picks: 400, chests: 4, playSeconds: 3000 },
    collection: { treasures: {}, letters: {} }, daily: { day: null, gift: [], giftTaken: true, tideDone: true, requests: [] },
    streak: { count: 1, lastDay: null, days: 1 }, tutorial: { done: true, firstBuild: true, seen: { move: 1 } }, fails: {}, debugDayOffset: 0,
  });
}
const stages = [
  [{ boardwalk: 1, cottage: 0, haenyeo: 0, shed: 0, lighthouse: 0, stilt: 0 }, [], 2],
  [{ boardwalk: 1, cottage: 1, haenyeo: 1, shed: 0, lighthouse: 0, stilt: 0 }, [], 6],
  [{ boardwalk: 2, cottage: 2, haenyeo: 1, shed: 1, lighthouse: 0, stilt: 0 }, ['flowerbed', 'bench'], 14],
  [{ boardwalk: 3, cottage: 3, haenyeo: 1, shed: 2, lighthouse: 2, stilt: 1 }, ['flowerbed', 'lantern', 'bench', 'flag', 'chime', 'well', 'lantern', 'flowerbed', 'flag'], 30],
];
segs.village = [];
for (let i = 0; i < stages.length; i++) {
  const [b, dec, un] = stages[i];
  const { g, pg, cdp } = await session({ 'lowtide.save.v1': save(b, dec, un) });
  await waitIn(pg, () => window.__app && window.__app.mode === 'island');
  await pg.waitForTimeout(1500);
  // clean cinematic plate: hide the home UI
  await pg.addStyleTag({ content: '#L-home, #L-fx, .toast { display: none !important; }' });
  await setRate(pg, cdp, SLOW);
  segs.village.push(await captureSegment(pg, cdp, OUT, 'village' + i, { maxSec: i === stages.length - 1 ? 3.2 : 1.4 }));
  await g.close();
}
fs.writeFileSync(path.join(OUT, 'segments.json'), JSON.stringify(segs));
console.log(Object.entries(segs).filter(([k]) => k !== 'logs' && k !== 'village').map(([k, v]) => `${k}: ${v.frames.length} frames, ${v.frames[v.frames.length - 1].t.toFixed(1)}s`).join('\n'));
console.log('village', segs.village.map((v) => v.frames.length).join(','));
