// Release build over http: the service worker registers, caches the game, and the game still starts offline.
import { openGame } from './shot.mjs';
const g = await openGame({ page: 'index.html', w: 360, h: 640, dpr: 2 });
await g.page.waitForTimeout(3000);
const reg = await g.page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'active' : 'installing') : 'none'; });
const cached = await g.page.evaluate(async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return { caches: ks.length, entries: n }; });
console.log('service worker:', reg, JSON.stringify(cached));
await g.context.setOffline(true);
await g.page.reload();
await g.page.waitForTimeout(3000);
const st = await g.page.evaluate(() => ({ mode: window.__app && window.__app.mode, controlled: !!navigator.serviceWorker.controller }));
console.log('offline reload:', JSON.stringify(st));
console.log('errors:', g.errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e)).join(' | ') || 'none');
await g.close();
