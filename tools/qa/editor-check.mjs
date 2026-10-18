import { chromium } from 'playwright';
import { serve } from './shot.mjs';
const srv = await serve('/home/user/oneshot-game-test15/out');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://127.0.0.1:${srv.address().port}/tools/editor.html`);
await pg.waitForTimeout(1500);
// pick level 12, scrub tide, validate
await pg.click('#list .lv:nth-of-type(14)');
await pg.waitForTimeout(400);
await pg.evaluate(() => { const r = document.querySelector('#scrub input'); r.value = 640; r.dispatchEvent(new Event('input')); });
await pg.click('text=검증하기');
await pg.waitForTimeout(6000);
await pg.screenshot({ path: '/tmp/claude-0/editor.png' });
console.log(errs.join('\n') || 'no errors');
await b.close(); srv.close();
