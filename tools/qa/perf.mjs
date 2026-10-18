// Frame-time check on an emulated budget phone: CPU throttled, DPR 2, a busy late tide played by the autopilot.
// Reports frame intervals (avg fps, p95, share of frames over 33 ms), script time per frame and heap, for both
// graphics settings. node tools/qa/perf.mjs [--throttle 4] [--level 30] [--seconds 20]
import { openGame } from './shot.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const THROTTLE = +arg('throttle', 4), LEVEL = +arg('level', 30), SECS = +arg('seconds', 20);

const levels = {};
for (let i = 1; i < LEVEL; i++) levels['L' + String(i).padStart(2, '0')] = { stars: 1, attempts: 1, clears: 1, best: 0 };
const save = (quality) => JSON.stringify({
  v: 1, installId: 'perf', firstOpen: Date.now(), newInstall: false, settings: { music: 0.7, sfx: 0.9, vibrate: true, lang: 'auto', quality },
  mats: { shell: 10, wood: 10, glass: 10, rope: 5, pearl: 1 }, buildings: { boardwalk: 3, cottage: 3, haenyeo: 1, shed: 2, lighthouse: 2, stilt: 1 },
  plots: {}, decor: ['flowerbed', 'lantern', 'bench'], levels, current: LEVEL, unlocked: LEVEL,
  tutorial: { done: true, firstBuild: true, seen: { move: 1 } },
});

for (const quality of ['high', 'low']) {
  const g = await openGame({ page: 'dev.html?clean=1', w: 360, h: 640, dpr: 2, lang: 'ko-KR', storage: { 'lowtide.save.v1': save(quality) } });
  const pg = g.page;
  const cdp = await pg.context().newCDPSession(pg);
  await pg.waitForTimeout(2000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await cdp.send('Performance.enable');
  await pg.evaluate((n) => { window.__app.ui.closeAll(); window.__app.selectLevel(n); window.__app.onGo(); }, LEVEL);
  await pg.waitForTimeout(2500);
  // a fixed walk out along the boardwalk and back (no route planning, so only the game's own cost is measured)
  await pg.evaluate(() => window.__autopilot.runScript([{ x: 5.5, y: 44 }, { x: 5.6, y: 30 }, { x: 4, y: 24 }, { x: 8, y: 22 }, { x: 5.6, y: 30 }, { home: true }]));
  if (args.includes('--profile')) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  const m0 = await cdp.send('Performance.getMetrics');
  await pg.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length < 5000) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await pg.waitForTimeout(SECS * 1000);
  const m1 = await cdp.send('Performance.getMetrics');
  if (args.includes('--profile')) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const dt = profile.timeDeltas;
    profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
    const tot = [...self.values()].reduce((a, b) => a + b, 0);
    console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `   ${(v / tot * 100).toFixed(1)}% ${k}`).join('\n'));
  }
  const ft = await pg.evaluate(() => window.__ft.slice(5));
  const st = await pg.evaluate(() => ({ ws: window.__app.world.state, t: window.__app.world.runT, auto: !!window.__app.autoLow }));
  const get = (m, k) => (m.metrics.find((x) => x.name === k) || {}).value || 0;
  const script = get(m1, 'ScriptDuration') - get(m0, 'ScriptDuration');
  const task = get(m1, 'TaskDuration') - get(m0, 'TaskDuration');
  const heap = get(m1, 'JSHeapUsedSize') / 1e6;
  const s = ft.slice().sort((a, b) => a - b);
  const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
  const p95 = s[Math.floor(s.length * 0.95)] || 0;
  const over = ft.filter((x) => x > 33.4).length / ft.length;
  console.log(`[${quality}] throttle ${THROTTLE}x, tide ${LEVEL}: ${ft.length} frames, avg ${(1000 / avg).toFixed(1)} fps, p95 ${p95.toFixed(1)} ms, >33ms ${(over * 100).toFixed(1)}%, ` +
    `script ${(script / ft.length * 1000).toFixed(2)} ms/frame, busy ${(task / SECS * 100).toFixed(0)}% of wall time, heap ${heap.toFixed(1)} MB, state ${st.ws} @${st.t.toFixed(1)}s${st.auto ? ' [auto-lightened]' : ''}`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await g.close();
}
