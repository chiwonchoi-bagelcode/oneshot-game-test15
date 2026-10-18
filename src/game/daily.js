// "Today's Tide": a level generated from the date, sized to how far the player's boardwalk reaches.
// tools/levels/validate.mjs --daily checks a full year of these for solvability.
import { makeTerrain, line, arc, cluster, one, rng } from '../../tools/levels/lib.mjs';
import { mulberry32 } from './model.js';

const MODS = ['spring', 'star', 'glass', 'quick'];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function makeDailyLevel(day, save) {
  const seed = hashStr('daily' + day);
  const r = mulberry32(seed);
  const board = save ? (save.buildings.boardwalk || 0) : 1;
  const mod = MODS[seed % MODS.length];
  // reach: how far up the map items may be placed (rows; smaller = further)
  const far = board >= 3 ? 6 : board >= 2 ? 15 : 30;
  const sea = board >= 3 ? 2 : board >= 2 ? 10 : 24;
  const map = {
    sea, channel: board >= 3 ? 10 : false, creek2: board >= 2 ? 26 : false,
    mud: [[1 + r() * 3, far + 4 + r() * 8, 2, 1.6], [8 + r() * 3, 33 + r() * 6, 2, 1.6]],
    bars: [[2 + r() * 8, far + 1.5, 2.2, 1.3]],
    rocks: [[Math.floor(1 + r() * 3), 38], [Math.floor(8 + r() * 3), 36]],
  };
  const { terrain, heights } = makeTerrain(map);
  const items = [];
  const R = rng(seed + 7);
  const spot = (y0, y1) => [1.2 + R() * 9.6, y0 + R() * (y1 - y0)];
  const near = () => spot(44, 50), mid = () => spot(Math.max(far + 8, 29), 39), farS = () => spot(far, far + 4);
  let goals;
  let tide;
  if (mod === 'star') {
    for (let i = 0; i < 9; i++) { const [x, y] = i < 4 ? near() : mid(); items.push(...one('starfish', +x.toFixed(2), +y.toFixed(2))); }
    items.push(...line('shell', 4.6, 49.6, 3.0, 45.0, 4), ...cluster('wood', 8.4, 46.6, 3, 1.3, seed));
    goals = [{ t: 'starfish', n: 5 }, { t: 'shell', n: 4 }, { t: 'starfish', n: 8 }];
    tide = { low: board >= 2 ? 42 : 52, duration: 74, curve: 1.95 };
  } else if (mod === 'glass') {
    for (let i = 0; i < 7; i++) { const [x, y] = i < 2 ? near() : i < 5 ? mid() : farS(); items.push(...one('glass', +x.toFixed(2), +y.toFixed(2))); }
    items.push(...line('shell', 6.4, 49.6, 8.6, 45.4, 4), ...cluster('wood', 2.6, 40, 2, 1.2, seed + 1));
    goals = [{ t: 'glass', n: 3 }, { t: 'shell', n: 4 }, { t: 'glass', n: 5 }];
    tide = { low: board >= 2 ? 40 : 50, duration: 76, curve: 1.95 };
  } else if (mod === 'quick') {
    items.push(...arc('shell', 5.5, 46.5, 2.6, 180, 360, 6), ...cluster('wood', 2.6, 44.6, 3, 1.2, seed), ...cluster('glass', 8.6, 40.6, 2, 1.0, seed + 2));
    items.push(...one('chest', +(3 + r() * 6).toFixed(2), 37.4));
    goals = [{ t: 'shell', n: 5 }, { t: 'wood', n: 3 }, { t: 'chest', n: 1 }];
    tide = { low: 54, duration: 54, curve: 2.2 };
  } else { // spring: the sea goes far out
    const [cx, cy] = farS();
    items.push(...one('chest', +cx.toFixed(2), +cy.toFixed(2)), ...cluster('pearl', +cx.toFixed(2), +(cy + 1.4).toFixed(2), 2, 1, seed));
    items.push(...line('glass', 3.0, far + 12, 8.0, far + 12, 3), ...line('shell', 5.2, 40, 3.6, 33, 5));
    goals = [{ t: 'glass', n: 2 }, { t: 'pearl', n: 1 }, { t: 'chest', n: 1 }];
    tide = { low: board >= 2 ? 26 : 34, duration: 80, curve: 1.95 };
  }
  // keep items off rocks and inside the map
  const clean = items.filter((it) => {
    const row = terrain[Math.floor(it.y)];
    return row && row[Math.floor(it.x)] !== 'r' && row[Math.floor(it.x)] !== '~';
  });
  return {
    id: 'D' + day, n: 0, key: 'daily', daily: true, day, mod, chapter: 0, kind: 'discover',
    tide, requires: {}, fog: null, hintReturn: false, goals, terrain, heights, items: clean,
  };
}
