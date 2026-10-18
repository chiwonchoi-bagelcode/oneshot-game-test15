import { openGame } from '../qa/shot.mjs';
import { SLOW_INIT } from './slowcap.mjs';
const g = await openGame({ page: 'dev.html', w: 360, h: 640, dpr: 3 });
await g.context.addInitScript(SLOW_INIT(0.25));
await g.page.reload();
await g.page.waitForTimeout(12000);
await g.page.evaluate(() => window.__autopilot.start({}));
for (let i = 0; i < 4; i++) {
  await g.page.waitForTimeout(3000);
  console.log(await g.page.evaluate(() => { const a = window.__autopilot, w = window.__app.world; return JSON.stringify({ on: a.on, phase: a.phase, targets: a.targets.length, wps: a.wps.length, ws: w.state, mode: window.__app.mode, px: Math.round(w.player.x), py: Math.round(w.player.y) }); }));
}
console.log(g.errors.join('\n'));
await g.close();
