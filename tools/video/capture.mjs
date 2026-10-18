// Real-time frame capture through the DevTools screencast. Frames + timestamps + sound log.
import fs from 'node:fs';
import path from 'node:path';

export async function startCapture(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) { /* closed */ }
  });
  const vp = page.viewportSize();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: dpr, mobile: true });
  await new Promise((r) => setTimeout(r, 200));
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  // wall clock of the page vs epoch so sound events can be aligned with frame timestamps
  const clock = await page.evaluate(() => ({ perf: performance.now() / 1000, epoch: Date.now() / 1000 }));
  return {
    frames,
    async stop() {
      await cdp.send('Page.stopScreencast');
      await new Promise((r) => setTimeout(r, 300));
      const log = await page.evaluate(() => window.__recLog || []);
      return { frames, log, clock, vp };
    },
  };
}
