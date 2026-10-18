import { openGame } from '../qa/shot.mjs';
import fs from 'node:fs';
const g = await openGame({ page: 'dev.html', w: 360, h: 640, dpr: 3 });
await g.page.waitForTimeout(2500);
console.log('dpr in page', await g.page.evaluate(() => window.devicePixelRatio));
const cdp = await g.page.context().newCDPSession(g.page);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true });
await g.page.waitForTimeout(300);
let t0 = Date.now(); let r;
for (let i = 0; i < 20; i++) {
  r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 360, height: 640, scale: 1 }, captureBeyondViewport: false });
}
fs.writeFileSync('/tmp/claude-0/cdpshot.jpg', Buffer.from(r.data, 'base64'));
console.log('jpeg clip ms/frame', (Date.now() - t0) / 20);
await g.close();
