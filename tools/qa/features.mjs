// Frames from mid/late-game mechanics: fog (before the lighthouse), the bell + light path (lighthouse 2),
// and the stilt shelter's boat ride. node tools/qa/features.mjs [--lang ko-KR]
import fs from 'node:fs';
import path from 'node:path';
import { openGame } from './shot.mjs';

const args = process.argv.slice(2);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'ko-KR';
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '/tmp/claude-0/features';
fs.mkdirSync(out, { recursive: true });
const save = (unlocked, b) => {
  const levels = {};
  for (let i = 1; i < unlocked; i++) levels['L' + String(i).padStart(2, '0')] = { stars: 1, attempts: 1, clears: 1, best: 0 };
  return JSON.stringify({ v: 1, newInstall: false, mats: { shell: 10, wood: 10, glass: 10, rope: 5, pearl: 1 }, buildings: b, levels, current: unlocked, unlocked, tutorial: { done: true, firstBuild: true, seen: { move: 1 } } });
};
const cases = [
  ['fog', 14, { boardwalk: 2, cottage: 2, haenyeo: 1, shed: 1, lighthouse: 0, stilt: 0 }, { greed: 0 }, [4, 12]],
  // walk out along the boardwalk and wait there until the bell, then head home
  ['light', 23, { boardwalk: 3, cottage: 3, haenyeo: 1, shed: 2, lighthouse: 2, stilt: 0 }, { script: [{ x: 5.6, y: 40 }, { x: 5.6, y: 22 }, { waitSlack: 4.0 }, { home: true }] }, ['bell', 'bell+1.5']],
  // the far sandbar (a sea glass and the chest), then the stilt shelter's ladder
  ['boat', 28, { boardwalk: 3, cottage: 3, haenyeo: 1, shed: 2, lighthouse: 1, stilt: 1 }, { script: [{ x: 5.6, y: 40 }, { x: 5.6, y: 20 }, { x: 4.4, y: 18 }, { x: 6.6, y: 14.4 }, { x: 8.5, y: 15.8 }] }, ['boat', 'boat+1']],
];
for (const [name, lv, b, ap, when] of cases) {
  const g = await openGame({ page: 'dev.html?clean=1', w: 360, h: 640, dpr: 2, lang, storage: { 'lowtide.save.v1': save(lv, b) } });
  const pg = g.page;
  await pg.waitForTimeout(2000);
  await pg.evaluate((n) => { window.__app.ui.closeAll(); window.__app.selectLevel(n); window.__app.onGo(); }, lv);
  await pg.waitForTimeout(2300);
  await pg.evaluate((o) => (o.script ? window.__autopilot.runScript(o.script) : window.__autopilot.start(o)), ap);
  const t0 = Date.now();
  let k = 0, bellAt = 0, boatAt = 0;
  const log = [];
  while (Date.now() - t0 < 90000 && k < when.length) {
    const s = await pg.evaluate(() => ({ t: window.__app.world.runT, ws: window.__app.world.state, bell: window.__app.world.bellRung, mode: window.__app.mode }));
    if (s.bell && !bellAt) bellAt = Date.now();
    if (s.ws === 'boat' && !boatAt) boatAt = Date.now();
    const w = when[k];
    const due = typeof w === 'number' ? s.t >= w : w === 'bell' ? !!bellAt : w === 'bell+1.5' ? bellAt && Date.now() - bellAt > 1500 : w === 'boat' ? !!boatAt : boatAt && Date.now() - boatAt > 1000;
    if (due) { await pg.screenshot({ path: path.join(out, `${name}_${k}.png`) }); log.push(`${w}@${s.t.toFixed(1)}s ${s.ws}`); k++; }
    if (s.mode === 'results') break;
    await pg.waitForTimeout(60);
  }
  console.log(name, `tide ${lv}:`, log.join(', ') || 'no frames', g.errors.join('|') || '');
  await g.close();
}
