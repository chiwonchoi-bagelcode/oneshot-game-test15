// Full-resolution real-gameplay capture: the page's clock (rAF, performance.now, Date, timers)
// and CSS animations run at `slow` speed while we screenshot continuously, so ~7 fps of captures
// become ~30 fps of game time. Every frame records its in-page (game) timestamp.
import fs from 'node:fs';
import path from 'node:path';

export const SLOW_INIT = (S) => `(() => {
  // virtual clock: v = v0 + (real - r0) * rate; rate can change at runtime (__setRate)
  let rate = ${S};
  const rn = performance.now.bind(performance);
  let r0 = rn(), v0 = r0;
  const virt = (real) => v0 + (real - r0) * rate;
  window.__setRate = (s) => { const now = rn(); v0 = virt(now); r0 = now; rate = s; };
  window.__rate = () => rate;
  performance.now = () => virt(rn());
  const rd = Date.now; const d0 = rd(); const p0 = rn();
  Date.now = () => d0 + (virt(rn()) - p0);
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  // timers are converted once at scheduling time (good enough when the rate is steady)
  window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) / rate, ...a);
  window.setInterval = (fn, ms, ...a) => si(fn, (ms || 0) / rate, ...a);
  const raf = window.requestAnimationFrame.bind(window);
  // Animation.setPlaybackRate also scales rAF timestamps, so use our own clock instead
  window.requestAnimationFrame = (cb) => raf(() => cb(virt(rn())));
  window.__recLog = [];
})();`;

export async function setRate(page, cdp, s) {
  await page.evaluate((r) => window.__setRate(r), s);
  await cdp.send('Animation.setPlaybackRate', { playbackRate: s });
}

export async function setupSlow(page, S) {
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: dpr, mobile: true });
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: S });
  return cdp;
}

// capture until `until()` resolves true or maxSec (game time) passes
export async function captureSegment(page, cdp, dir, name, { maxSec = 20, until = null, quality = 92 } = {}) {
  const out = path.join(dir, name);
  fs.mkdirSync(out, { recursive: true });
  const frames = [];
  const start = await page.evaluate(() => performance.now() / 1000);
  for (let i = 0; ; i++) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    const t = await page.evaluate(() => performance.now() / 1000);
    const file = path.join(out, `f${String(i).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    frames.push({ file, t: t - start, abs: t });
    if (t - start > maxSec) break;
    if (until && i % 3 === 0 && await until()) break;
  }
  return { frames, start };
}

// write an ffmpeg concat list resampled to a constant frame rate
export function concatList(frames, fps, listFile, t0 = null, t1 = null) {
  const a = t0 ?? frames[0].t, b = t1 ?? frames[frames.length - 1].t;
  const lines = [];
  let k = 0;
  for (let t = a; t <= b; t += 1 / fps) {
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    lines.push(`file '${frames[k].file}'`, `duration ${(1 / fps).toFixed(6)}`);
  }
  lines.push(`file '${frames[k].file}'`);
  fs.writeFileSync(listFile, lines.join('\n'));
  return Math.round((b - a) * fps);
}
