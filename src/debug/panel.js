// Development-only panel (bundled only into dev.html / game.dev.js via __DEV__).
import * as eco from '../meta/economy.js';
import { readQueue, analytics } from '../platform/analytics.js';
import { writeSave } from '../meta/save.js';
import { makeAutopilot } from './autopilot.js';
import { audio } from '../audio/audio.js';

export function initDebug(app) {
  analytics.debug = true;
  const ap = makeAutopilot(app);
  window.__autopilot = ap;
  window.__audio = audio;
  app.preUpdate.push((dt) => ap.update(dt));
  const root = document.getElementById('root');
  const wrap = document.createElement('div');
  wrap.id = 'debug';
  if (new URLSearchParams(location.search).get('clean')) wrap.style.display = 'none';
  const toggle = document.createElement('button');
  toggle.className = 'dbtn';
  toggle.textContent = 'DEV';
  const panel = document.createElement('div');
  panel.className = 'dpanel';
  panel.style.display = 'none';
  wrap.append(toggle, panel);
  root.appendChild(wrap);
  for (const el of [toggle, panel]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  toggle.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; render(); });
  const s = () => app.save;
  const refresh = () => { eco.refreshPlots(s()); writeSave(s(), true); app.toIsland(); render(); };
  const actions = [
    ['+10 all mats', () => { for (const m of eco.MATS) s().mats[m] += 10; refresh(); }],
    ['+100 all mats', () => { for (const m of eco.MATS) s().mats[m] += 100; refresh(); }],
    ['clear current (3★)', () => { const lv = eco.levelById(app.levelN); const r = eco.levelRecord(s(), app.levelN); r.stars = 7; s().unlocked = Math.max(s().unlocked, Math.min(eco.levelCount(), app.levelN + 1)); app.levelN = Math.min(eco.levelCount(), app.levelN + 1); refresh(); }],
    ['prev level', () => { app.levelN = Math.max(1, app.levelN - 1); refresh(); }],
    ['next level', () => { app.levelN = Math.min(eco.levelCount(), app.levelN + 1); s().unlocked = Math.max(s().unlocked, app.levelN); refresh(); }],
    ['unlock all levels', () => { s().unlocked = eco.levelCount(); refresh(); }],
    ['build all max', () => { for (const id of Object.keys(s().buildings)) s().buildings[id] = id === 'boardwalk' || id === 'cottage' ? 3 : id === 'shed' || id === 'lighthouse' ? 2 : 1; refresh(); }],
    ['buildings 0', () => { for (const id of Object.keys(s().buildings)) s().buildings[id] = 0; refresh(); }],
    ['next day (+1)', () => { s().debugDayOffset = (s().debugDayOffset || 0) + 1; eco.dailyRefresh(s()); app.placeGifts(); refresh(); }],
    ['skip 2 days (break streak)', () => { s().debugDayOffset = (s().debugDayOffset || 0) + 2; eco.dailyRefresh(s()); app.placeGifts(); refresh(); }],
    ['start daily tide', () => { app.startDaily(); }],
    ['swept now', () => { if (app.world.state === 'play') app.world.beginSwept(); }],
    ['arrive now', () => { if (app.world.state === 'play') app.world.beginArrive(false); }],
    ['tide +10s', () => { if (app.world.state === 'play') app.world.runT += 10; }],
    ['autopilot on/off', () => { if (ap.on) ap.stop(); else ap.start({}); }],
  ];
  function render() {
    panel.innerHTML = '';
    for (const [label, fn] of actions) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      panel.appendChild(b);
    }
    const info = document.createElement('pre');
    const sv = s();
    info.textContent = `level ${app.levelN} unlocked ${sv.unlocked} cleared ${eco.clearedCount(sv)}\nday ${sv.daily.day} streak ${sv.streak.count}\nmats ${JSON.stringify(sv.mats)}\nbuild ${JSON.stringify(sv.buildings)}\nlast events:\n${readQueue().slice(-8).map((e) => e.e).join(', ')}`;
    panel.appendChild(info);
  }
}
