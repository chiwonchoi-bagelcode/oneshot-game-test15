import { openGame } from '../qa/shot.mjs';
import { SLOW_INIT, setupSlow, captureSegment } from './slowcap.mjs';
const S = 0.25;
const g = await openGame({ page: 'dev.html', w: 360, h: 640, dpr: 3 });
// re-open with the slow clock installed before any game code runs
await g.context.addInitScript(SLOW_INIT(S));
await g.page.reload();
await g.page.waitForTimeout(800 / S);
const cdp = await setupSlow(g.page, S);
await g.page.evaluate(() => window.__autopilot.start({}));
const seg = await captureSegment(g.page, cdp, '/tmp/claude-0/slow', 'a', { maxSec: 6 });
const ts = seg.frames.map((f) => f.t);
const gaps = ts.slice(1).map((t, i) => t - ts[i]);
console.log('frames', ts.length, 'game span', ts[ts.length - 1].toFixed(2), 'game fps', (ts.length / ts[ts.length - 1]).toFixed(1), 'max gap', Math.max(...gaps).toFixed(3));
await g.close();
