// Robustness of the save: corrupt JSON, a partial/old save, and wrong types must all start the game without errors.
import { openGame } from './shot.mjs';
const cases = {
  corrupt: '{"v":1,"mats":{"shell":',
  partial: JSON.stringify({ v: 1, mats: { shell: 5 }, unlocked: 4, current: 4 }),
  wrongTypes: JSON.stringify({ v: 1, mats: null, buildings: 'x', levels: [], unlocked: '7', settings: { lang: 'fr', music: 'loud' } }),
  future: JSON.stringify({ v: 99, mats: { shell: 1 } }),
};
for (const [name, raw] of Object.entries(cases)) {
  const g = await openGame({ page: 'index.html', w: 360, h: 640, dpr: 1, storage: { 'lowtide.save.v1': raw } });
  await g.page.waitForTimeout(3500);
  const s = await g.page.evaluate(() => ({ mode: window.__app && window.__app.mode, ws: window.__app && window.__app.world.state, broken: !!localStorage.getItem('lowtide.save.v1.broken'), saved: (() => { try { const x = JSON.parse(localStorage.getItem('lowtide.save.v1')); return x && { v: x.v, unlocked: x.unlocked, mats: x.mats && Object.keys(x.mats).length }; } catch (e) { return 'unreadable'; } })() }));
  console.log(name.padEnd(11), JSON.stringify(s), 'errors:', g.errors.filter((e) => !e.includes('404')).join(' | ') || 'none');
  await g.close();
}
