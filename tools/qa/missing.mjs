// Lists every resource that fails to load (HTTP >= 400) on the game, the editor and the showcase.
import { chromium } from 'playwright';
import { serve } from './shot.mjs';
const srv = await serve(new URL('../../out', import.meta.url).pathname);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
pg.on('response', (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
for (const p of ['tools/editor.html', 'index.html', 'release/index.html']) { await pg.goto(`http://127.0.0.1:${srv.address().port}/${p}`); await pg.waitForTimeout(2500); }
await b.close(); srv.close();
