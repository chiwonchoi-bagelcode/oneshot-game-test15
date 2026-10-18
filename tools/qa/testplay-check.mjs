// Verifies the editor -> game test-play hand-off starts a run with the edited level.
import { openGame } from './shot.mjs';
import fs from 'node:fs';
const lv = JSON.parse(fs.readFileSync(new URL('../../src/data/levels/L05.json', import.meta.url)));
lv.items = lv.items.slice(0, 3);
const g = await openGame({ page: 'dev.html?test=1', storage: { 'lowtide.editor.test': JSON.stringify({ level: lv, up: { boardwalk: 1 } }) } });
await g.page.waitForTimeout(3500);
const r = await g.page.evaluate(() => ({ mode: window.__app.mode, state: window.__app.world.state, items: window.__app.world.items.length, test: !!window.__app.test }));
console.log(JSON.stringify(r));
await g.close();
