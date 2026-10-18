// Opens the release game and the showcase straight from disk (file://) and reports what loaded.
import { openGame } from './shot.mjs';
const g = await openGame({ file: true, page: 'index.html', w: 360, h: 640, dpr: 2 });
await g.page.waitForTimeout(4000);
const s = await g.page.evaluate(() => ({ loaded: !document.getElementById('loading') || document.getElementById('loading').classList.contains('done'), mode: window.__app && window.__app.mode, ws: window.__app && window.__app.world.state, audioPack: !!window.__AUDIO_PACK__ || !!window.__AUDIO_META__ }));
console.log('game via file://', JSON.stringify(s));
console.log('errors:', g.errors.join(' | ') || 'none');
await g.page.goto('file://' + new URL('../../out/release/index.html', import.meta.url).pathname);
await g.page.waitForTimeout(3000);
const r = await g.page.evaluate(() => ({ title: document.title, imgs: [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src), videos: document.querySelectorAll('video').length, frameMode: (() => { try { const f = document.querySelector('iframe').contentWindow; return f.__app && f.__app.mode; } catch (e) { return 'cross-origin: ' + e.message.slice(0, 40); } })() }));
console.log('showcase via file://', JSON.stringify(r));
await g.close();
