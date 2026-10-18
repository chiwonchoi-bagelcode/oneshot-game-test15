// Source definitions for the 40 tides. `node tools/levels/gen.mjs --force` writes src/data/levels/*.json.
// After generation the JSON files are the source of truth and can be edited in the level editor.
// Zones (rows, 0 = horizon, 51 = next to the island):
//   A 44-51 near flats | creek1 ~41-43 | B 28-39 | creek2 ~24-28 | C 13-23 | channel 10-12 | D 2-9 horizon bar
import { makeTerrain, line, arc, cluster, one, sc } from './lib.mjs';

const L = [];
const add = (def) => L.push(def);
const C1 = { creek2: false, channel: false };

// ---------------- Chapter 1: 앞갯벌 (near flats) ----------------
add({ // first tide: a shell trail leads out, the creek is a river, the sea comes back gently
  name: 'glitter', kind: 'easy', tutorial: 'move', hintReturn: true,
  tide: { low: 60, duration: 46, curve: 2.2 },
  map: { ...C1, sea: 39, rocks: [[1, 47], [10, 49]] },
  items: [
    ...line('shell', 5.5, 50.6, 5.0, 47.8, 4), ...arc('shell', 6.6, 46.8, 1.8, 190, 340, 5),
    ...one('wood', 9.0, 45.4), ...one('wood', 2.2, 45.6), ...one('wood', 9.8, 48.2), ...one('wood', 1.6, 50.2),
    sc('shell', 7, 44.3, 51, 11), ...one('glass', 3.2, 45.3),
  ],
  goals: [{ t: 'shell', n: 6 }, { t: 'wood', n: 3 }, { t: 'shell', n: 12 }],
});
add({ // the boardwalk crosses the creek: the good stuff is on the other side
  name: 'across', kind: 'discover', requires: { boardwalk: 1 },
  tide: { low: 50, duration: 43, curve: 2.5 },
  map: { ...C1, sea: 27, mud: [[2, 34, 2, 1.5]] },
  items: [
    ...line('shell', 4.6, 50.0, 3.2, 45.6, 4),
    ...arc('wood', 5.5, 37.6, 2.6, 180, 360, 5), sc('wood', 3, 29, 36, 21),
    ...line('shell', 6.6, 37.2, 10.0, 31.0, 7), sc('shell', 6, 29, 39, 22), ...one('glass', 9.6, 29.2),
  ],
  goals: [{ t: 'wood', n: 4 }, { t: 'shell', n: 12 }, { t: 'wood', n: 7 }],
});
add({ // heavy driftwood near, light shells far: what do you fill the sack with?
  name: 'heavy', kind: 'think', requires: { boardwalk: 1 },
  tide: { low: 50, duration: 42, curve: 2.5 },
  map: { ...C1, sea: 27, mud: [[8.5, 33, 2, 1.5]], rocks: [[1, 46]] },
  items: [
    ...cluster('wood', 3.2, 48.0, 6, 1.6, 21), ...line('wood', 8.4, 46.8, 9.6, 45.2, 2),
    ...line('shell', 4.4, 38.6, 1.6, 30.0, 8), ...line('shell', 6.6, 36.2, 10.2, 36.2, 5), sc('shell', 6, 28.5, 35, 31),
    ...one('glass', 7.2, 29.0),
  ],
  goals: [{ t: 'shell', n: 12 }, { t: 'wood', n: 5 }, { t: 'shell', n: 15 }],
});
add({ // a chest glints at the far end of the flats
  name: 'firstchest', kind: 'discover', requires: { boardwalk: 1 },
  tide: { low: 48, duration: 45, curve: 2.6 },
  map: { ...C1, sea: 26, mud: [[3, 34, 2.4, 1.5]], rocks: [[7, 36], [8, 36]] },
  items: [
    ...one('chest', 8.6, 28.4),
    ...line('shell', 5.0, 39.0, 8.0, 30.0, 7), ...line('shell', 4.6, 49.0, 2.4, 45.6, 4),
    ...cluster('wood', 2.8, 34.2, 3, 1.2, 4), sc('wood', 3, 44.5, 51, 41), sc('shell', 5, 29, 38, 42), ...one('glass', 1.4, 29.4),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'shell', n: 9 }, { t: 'wood', n: 4 }],
});
add({ // the mud is full of shells but slows you down
  name: 'sticky', kind: 'think', requires: { boardwalk: 1 },
  tide: { low: 48, duration: 45, curve: 2.6 },
  map: { ...C1, sea: 26, mud: [[3, 34, 3, 4.5], [2, 47, 1.6, 1.4]], rocks: [[8, 39]] },
  items: [
    ...cluster('shell', 2.8, 34.0, 10, 2.6, 51), ...cluster('wood', 3.2, 31.0, 3, 1.2, 52),
    ...line('shell', 7.5, 37.6, 9.8, 29.8, 5), ...one('wood', 9.0, 29.0), ...one('wood', 10.4, 35.0),
    ...line('shell', 4.6, 49.8, 6.8, 47.0, 3), ...one('glass', 8.0, 33.4),
  ],
  goals: [{ t: 'shell', n: 12 }, { t: 'wood', n: 4 }, { t: 'shell', n: 15 }],
});
add({ // sea glass sits where the water returns first
  name: 'glass', kind: 'discover', requires: { boardwalk: 1 },
  tide: { low: 46, duration: 45, curve: 2.6 },
  map: { ...C1, sea: 25, mud: [[8, 34, 2, 2]], bars: [[3, 29.5, 2, 1.2]] },
  items: [
    ...arc('glass', 3.0, 29.6, 1.8, 160, 380, 5), ...one('glass', 9.6, 28.0), ...one('glass', 7.0, 31.0),
    ...line('shell', 5.0, 39.2, 3.6, 32.0, 6), ...cluster('wood', 8.0, 34.0, 3, 1.3, 61),
    ...line('shell', 7.0, 48.8, 9.6, 45.6, 4), sc('shell', 4, 44.5, 51, 62),
  ],
  goals: [{ t: 'glass', n: 4 }, { t: 'shell', n: 10 }, { t: 'glass', n: 7 }],
});
add({ // a quick flood: no time to wander
  name: 'quick', kind: 'think', requires: { boardwalk: 1 },
  tide: { low: 50, duration: 34, curve: 2.6 },
  map: { ...C1, sea: 27, mud: [[9, 37, 2, 2]], rocks: [[2, 38], [3, 38]] },
  items: [
    ...line('wood', 2.0, 46.6, 3.8, 44.8, 2), ...line('wood', 6.6, 38.6, 8.4, 35.0, 3), ...one('wood', 1.6, 33.0),
    ...cluster('shell', 4.0, 33.0, 7, 2.0, 71), ...one('glass', 9.4, 30.4), ...one('glass', 1.2, 30.4),
    ...line('shell', 9.4, 48.6, 8.2, 45.6, 3), sc('shell', 4, 28.5, 32, 72),
  ],
  goals: [{ t: 'wood', n: 5 }, { t: 'shell', n: 10 }, { t: 'glass', n: 2 }],
});
add({ // the rocks split the flats: rich mud on the left, easy sand on the right
  name: 'fork', kind: 'think', requires: { boardwalk: 1 },
  tide: { low: 46, duration: 45, curve: 2.7 },
  map: { ...C1, sea: 25, mud: [[2.5, 32, 2.5, 4.5]], rocks: [[6, 36], [7, 36], [7, 35], [6, 32], [7, 32], [7, 31]] },
  items: [
    ...cluster('glass', 2.4, 31.6, 5, 2.0, 81), ...cluster('wood', 2.6, 35.6, 3, 1, 82),
    ...line('shell', 8.4, 39.0, 10.2, 29.4, 8), ...one('chest', 9.4, 27.6),
    ...line('shell', 3.4, 48.4, 2.0, 45.0, 4), sc('wood', 2, 44.5, 51, 83),
  ],
  goals: [{ t: 'glass', n: 3 }, { t: 'shell', n: 10 }, { t: 'chest', n: 1 }],
});
add({ // rope washed up along the creek banks
  name: 'rope', kind: 'discover', requires: { boardwalk: 1 },
  tide: { low: 46, duration: 46, curve: 2.7 },
  map: { ...C1, sea: 25, mud: [[8, 31, 2.5, 2]], bars: [[3, 34, 2, 1.4]] },
  items: [
    ...one('rope', 1.4, 39.0), ...one('rope', 10.6, 39.4), ...one('rope', 8.0, 29.4), ...one('rope', 3.4, 33.8), ...one('rope', 6.6, 27.6),
    ...line('wood', 4.4, 37.4, 6.6, 35.0, 3), ...line('shell', 6.6, 49.0, 9.4, 46.2, 4),
    ...cluster('glass', 8.4, 30.4, 3, 1.2, 91), sc('shell', 6, 28, 38, 92),
  ],
  goals: [{ t: 'rope', n: 3 }, { t: 'wood', n: 3 }, { t: 'rope', n: 5 }],
});
add({ // spring tide: the second creek runs dry for a short while — a far sandbar opens
  name: 'spring', kind: 'discover', requires: { boardwalk: 1 },
  tide: { low: 40, duration: 46, curve: 2.6 },
  map: { channel: false, sea: 13, bars: [[6, 18.5, 2.6, 1.6]], mud: [[2, 21, 2, 2]] },
  items: [
    ...one('pearl', 6.0, 18.2), ...one('chest', 7.8, 19.4), ...one('pearl', 4.4, 19.0),
    ...line('shell', 5.0, 38.0, 3.4, 30.0, 7), ...cluster('glass', 9.4, 30.0, 3, 1.2, 101),
    ...line('shell', 1.6, 22.0, 3.0, 19.6, 3), sc('wood', 3, 29, 38, 102), sc('glass', 2, 15, 23, 103),
  ],
  goals: [{ t: 'pearl', n: 1 }, { t: 'glass', n: 3 }, { t: 'chest', n: 1 }],
});

// ---------------- Chapter 2: 모래톱 (sandbars past the second creek) ----------------
const ch2 = (o) => ({ channel: false, sea: 12, ...o });
add({
  name: 'secondcreek', kind: 'discover', requires: { boardwalk: 2 },
  tide: { low: 46, duration: 45, curve: 2.6 },
  map: ch2({ bars: [[3.5, 19.5, 2.5, 1.5]], mud: [[9, 21, 2, 2]] }),
  items: [
    ...arc('glass', 3.6, 19.6, 1.9, 180, 360, 5), ...line('rope', 6.6, 22.6, 8.4, 20.0, 2),
    ...line('shell', 6.6, 35.0, 10.0, 29.0, 6), ...cluster('wood', 2.2, 32.0, 3, 1.1, 111), sc('shell', 5, 14, 23, 112), sc('wood', 2, 44, 51, 113),
  ],
  goals: [{ t: 'glass', n: 4 }, { t: 'rope', n: 2 }, { t: 'shell', n: 9 }],
});
add({
  name: 'mudfield', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 46, duration: 45, curve: 2.6 },
  map: ch2({ mud: [[3, 18.5, 3, 3.4], [8, 33, 3, 2.6]], bars: [[9.5, 17, 1.8, 1.2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 912),
    ...cluster('glass', 3.0, 18.6, 6, 2.2, 121), ...one('pearl', 9.4, 16.8),
    ...cluster('shell', 8.0, 33.0, 8, 2.2, 122), ...line('wood', 4.4, 36.4, 2.0, 30.6, 3), sc('rope', 2, 14, 22, 123),
  ],
  goals: [{ t: 'glass', n: 4 }, { t: 'shell', n: 8 }, { t: 'pearl', n: 1 }],
});
add({
  name: 'twochests', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 44, duration: 46, curve: 2.7 },
  map: ch2({ bars: [[2, 17.5, 1.8, 1.2], [9.5, 18.5, 1.8, 1.2]], rocks: [[7, 21], [8, 21]] }),
  items: [
    sc('wood', 3, 28.5, 40, 913),
    ...one('chest', 2.0, 17.4), ...one('chest', 9.6, 18.4),
    ...line('shell', 4.4, 23.0, 4.4, 15.0, 6), ...cluster('rope', 3.6, 30.0, 3, 1.4, 131),
    ...line('glass', 8.4, 33.0, 10.2, 30.0, 3), sc('wood', 3, 29, 38, 132),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'rope', n: 2 }, { t: 'chest', n: 2 }],
});
add({ // sea fog hides the far sandbar until the lighthouse is lit
  name: 'fog', kind: 'discover', requires: { boardwalk: 2 }, fog: 25,
  tide: { low: 44, duration: 46, curve: 2.7 },
  map: ch2({ bars: [[7.5, 16.5, 2.6, 1.5]], mud: [[2, 20, 2, 2.4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 914),
    ...cluster('pearl', 7.6, 16.6, 2, 1.2, 141), ...cluster('glass', 2.0, 20.0, 4, 1.6, 142), ...one('rope', 10.4, 21.6),
    ...line('shell', 4.4, 33.0, 9.0, 29.0, 6), sc('wood', 3, 28, 38, 143), sc('shell', 4, 14, 23, 144),
  ],
  goals: [{ t: 'pearl', n: 1 }, { t: 'glass', n: 3 }, { t: 'pearl', n: 2 }],
});
add({
  name: 'tightrope', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 46, duration: 40, curve: 2.8 },
  map: ch2({ mud: [[3, 33, 2.5, 2], [8.5, 21.5, 2.5, 2]], rocks: [[2, 28], [3, 28], [8, 29], [9, 29], [10, 29]] }),
  items: [
    sc('wood', 3, 28.5, 40, 915),
    ...line('rope', 8.4, 21.6, 10.0, 19.2, 3), ...line('glass', 1.8, 21.0, 3.8, 18.6, 4),
    ...line('shell', 4.6, 37.6, 1.8, 32.6, 6), ...one('wood', 7.4, 33.4), ...one('wood', 8.6, 34.6), sc('shell', 4, 14, 23, 151),
  ],
  goals: [{ t: 'rope', n: 2 }, { t: 'glass', n: 3 }, { t: 'rope', n: 3 }],
});
add({ // an easy, generous tide after the tight one
  name: 'treasure', kind: 'easy', requires: { boardwalk: 2 },
  tide: { low: 46, duration: 48, curve: 2.6 },
  map: ch2({ bars: [[5.5, 19.5, 4, 1.6]] }),
  items: [
    sc('wood', 3, 28.5, 40, 916),
    ...arc('shell', 5.5, 19.6, 3.6, 180, 360, 9), ...line('glass', 3.4, 19.8, 7.6, 19.8, 4),
    ...one('chest', 5.4, 17.6), ...line('wood', 8.6, 33.0, 10.2, 29.0, 3), ...one('rope', 1.4, 31.0), sc('shell', 4, 29, 38, 161),
  ],
  goals: [{ t: 'shell', n: 8 }, { t: 'glass', n: 3 }, { t: 'chest', n: 1 }],
});
add({
  name: 'lowlands', kind: 'think', requires: { boardwalk: 2 }, fog: 24,
  tide: { low: 44, duration: 45, curve: 2.7 },
  map: ch2({ mud: [[6, 17, 4, 2.5]], bars: [[1.5, 14.5, 1.5, 1.2], [10.5, 14.5, 1.5, 1.2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 917),
    ...one('pearl', 1.4, 14.4), ...one('pearl', 10.6, 14.2), ...cluster('glass', 6.0, 17.0, 5, 2.4, 171),
    ...line('rope', 3.6, 29.6, 7.8, 29.6, 2), ...line('shell', 9.2, 37.0, 9.8, 30.0, 5), sc('wood', 3, 30, 38, 172),
  ],
  goals: [{ t: 'glass', n: 3 }, { t: 'pearl', n: 1 }, { t: 'pearl', n: 2 }],
});
add({
  name: 'wreckwood', kind: 'easy', requires: { boardwalk: 2 },
  tide: { low: 46, duration: 46, curve: 2.6 },
  map: ch2({ bars: [[3, 21.5, 2, 1.2]], mud: [[8, 19.5, 2, 1.6]] }),
  items: [
    sc('wood', 3, 28.5, 40, 918),
    ...cluster('wood', 3.0, 21.4, 6, 1.8, 181), ...cluster('rope', 8.0, 19.6, 3, 1.4, 182),
    ...line('shell', 4.4, 35.0, 4.4, 29.0, 5), ...one('glass', 1.4, 29.4), ...one('glass', 10.6, 30.4), sc('shell', 4, 14, 22, 183),
  ],
  goals: [{ t: 'wood', n: 5 }, { t: 'rope', n: 2 }, { t: 'glass', n: 2 }],
});
add({ // a wide creek floods fast behind you
  name: 'crossing', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 42, duration: 45, curve: 2.8 },
  map: ch2({ creek2: 26, width2: 4, bars: [[9, 16.5, 2, 1.4]], mud: [[2, 16, 2, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 919),
    ...one('chest', 9.2, 16.2), ...cluster('pearl', 2.2, 15.6, 2, 1.0, 191), ...line('glass', 3.6, 21.0, 8.0, 21.0, 4),
    ...line('shell', 1.4, 34.0, 4.0, 30.0, 5), ...one('rope', 9.6, 32.0), sc('wood', 2, 29, 38, 192),
  ],
  goals: [{ t: 'glass', n: 3 }, { t: 'pearl', n: 2 }, { t: 'chest', n: 1 }],
});
add({
  name: 'drifting', kind: 'discover', requires: { boardwalk: 2 },
  tide: { low: 44, duration: 46, curve: 2.7 },
  map: ch2({ bars: [[5.5, 15.5, 3, 1.4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 920),
    ...one('bottle', 5.6, 15.2), ...line('glass', 3.0, 16.8, 8.2, 16.8, 5),
    ...cluster('rope', 2.0, 21.6, 2, 1.2, 201), ...line('shell', 9.8, 35.0, 8.0, 28.0, 6), sc('wood', 3, 29, 38, 202),
  ],
  goals: [{ t: 'bottle', n: 1 }, { t: 'glass', n: 3 }, { t: 'rope', n: 2 }],
});
add({ // pearls line the far bar: how many dare you take?
  name: 'greed', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 42, duration: 43, curve: 2.8 },
  map: ch2({ bars: [[5.5, 14, 4, 1.4]], mud: [[3, 22.5, 2, 1.5], [8, 22.5, 2, 1.5]] }),
  items: [
    sc('wood', 3, 28.5, 40, 921),
    ...line('pearl', 2.4, 13.8, 8.6, 13.8, 4), ...one('chest', 5.4, 15.2),
    ...cluster('glass', 3.0, 22.6, 3, 1.3, 211), ...cluster('glass', 8.0, 22.6, 2, 1.3, 212),
    ...line('shell', 4.4, 37.0, 4.4, 31.0, 4), sc('wood', 2, 29, 38, 213),
  ],
  goals: [{ t: 'glass', n: 3 }, { t: 'pearl', n: 2 }, { t: 'chest', n: 1 }],
});
add({
  name: 'stormafter', kind: 'easy', requires: { boardwalk: 2 },
  tide: { low: 46, duration: 50, curve: 2.6 },
  map: ch2({ mud: [[2, 30, 2, 2]], bars: [[8, 20.5, 2.5, 1.5]] }),
  items: [
    sc('wood', 3, 28.5, 40, 922),
    ...line('wood', 2.0, 46.8, 10.0, 46.8, 5), ...cluster('rope', 8.0, 20.6, 3, 1.6, 221),
    ...cluster('glass', 2.0, 30.0, 3, 1.4, 222), ...line('shell', 6.6, 38.4, 9.6, 33.4, 5), ...one('bottle', 10.0, 19.0), sc('shell', 4, 14, 23, 223),
  ],
  goals: [{ t: 'rope', n: 3 }, { t: 'wood', n: 4 }, { t: 'bottle', n: 1 }],
});

// ---------------- Chapter 3: 먼 모래톱 (far sandbars, spring tides) ----------------
const ch3 = (o) => ({ sea: 9, channel: 10, ...o });
add({
  name: 'farbar', kind: 'discover', requires: { boardwalk: 2, light: 1 },
  tide: { low: 42, duration: 48, curve: 2.7 },
  map: ch3({ bars: [[8.5, 15.5, 2.5, 1.6], [3, 16.5, 2, 1.3]], mud: [[5, 20, 2, 1.6]] }),
  items: [
    sc('wood', 3, 28.5, 40, 923),
    ...cluster('pearl', 3.0, 16.4, 2, 1.0, 231), ...one('chest', 9.6, 14.6),
    ...line('glass', 4.6, 21.0, 7.4, 21.0, 3), ...line('rope', 1.6, 30.0, 2.8, 28.4, 2), ...line('shell', 9.6, 35.0, 8.0, 31.0, 4), sc('wood', 3, 29, 38, 232), sc('shell', 3, 14, 22, 233),
  ],
  goals: [{ t: 'pearl', n: 2 }, { t: 'glass', n: 3 }, { t: 'chest', n: 1 }],
});
add({ // the lighthouse bell earns its keep
  name: 'bellnight', kind: 'think', requires: { boardwalk: 2, light: 1 },
  tide: { low: 42, duration: 43, curve: 2.9 },
  map: ch3({ bars: [[5.5, 14, 3, 1.4]], mud: [[2, 19, 2, 2], [9, 19, 2, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 924),
    ...line('pearl', 4.0, 13.6, 7.0, 13.6, 3), ...cluster('glass', 2.0, 19.0, 3, 1.4, 241),
    ...cluster('rope', 9.0, 19.0, 3, 1.4, 242), ...line('wood', 3.6, 34.0, 7.4, 34.0, 3), sc('shell', 5, 28, 38, 243),
  ],
  goals: [{ t: 'pearl', n: 2 }, { t: 'rope', n: 3 }, { t: 'pearl', n: 3 }],
});
add({
  name: 'scattered', kind: 'easy', requires: { boardwalk: 2 },
  tide: { low: 44, duration: 50, curve: 2.7 },
  map: ch3({ bars: [[3, 15, 2, 1.2], [9, 22, 2, 1.2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 925),
    sc('shell', 9, 14, 23, 251), ...cluster('glass', 3.0, 15.0, 3, 1.2, 252),
    ...cluster('rope', 9.0, 22.0, 2, 1.2, 253), ...cluster('wood', 4.0, 32.0, 3, 1.8, 254), ...one('pearl', 1.2, 13.4), sc('glass', 2, 28, 38, 255),
  ],
  goals: [{ t: 'shell', n: 6 }, { t: 'glass', n: 3 }, { t: 'pearl', n: 1 }],
});
add({
  name: 'chestrow', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 42, duration: 46, curve: 2.8 },
  map: ch3({ bars: [[5.5, 14.5, 4.5, 1.4]], mud: [[5.5, 19, 3.5, 1.4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 926),
    ...line('chest', 2.4, 14.4, 8.6, 14.4, 3), ...cluster('glass', 5.5, 19.0, 4, 2, 261),
    ...line('shell', 1.6, 30.0, 4.4, 27.8, 4), ...one('rope', 9.4, 30.0), sc('wood', 3, 30, 38, 262),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'glass', n: 3 }, { t: 'chest', n: 2 }],
});
add({ // the long boardwalk reaches over the deep channel
  name: 'beyondchannel', kind: 'discover', requires: { boardwalk: 3 },
  tide: { low: 38, duration: 48, curve: 2.8 },
  map: ch3({ sea: 3, bars: [[5.5, 6, 3, 1.6]], mud: [[2, 15, 2, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 927),
    ...one('chest', 5.6, 5.6), ...line('pearl', 4.0, 6.6, 7.2, 6.6, 2),
    ...cluster('glass', 2.0, 15.0, 3, 1.4, 271), ...line('rope', 8.6, 19.0, 9.8, 17.0, 2), ...line('shell', 6.6, 30.0, 9.0, 27.6, 4), sc('shell', 3, 4, 9, 272),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'glass', n: 3 }, { t: 'pearl', n: 2 }],
});
add({ // the stilt hut ferry lets you stay out longer
  name: 'stiltday', kind: 'discover', requires: { boardwalk: 2, stilt: 1 },
  tide: { low: 40, duration: 48, curve: 2.8 },
  map: ch3({ bars: [[8.5, 15.5, 2.5, 1.6], [3, 15, 2, 1.3]] }),
  items: [
    sc('wood', 3, 28.5, 40, 928),
    ...cluster('pearl', 3.0, 15.0, 3, 1.2, 281), ...one('chest', 6.6, 14.4),
    ...line('glass', 2.0, 18.0, 4.4, 18.0, 3), ...line('rope', 4.6, 24.0, 2.0, 22.0, 2), sc('shell', 4, 28, 38, 282),
  ],
  goals: [{ t: 'pearl', n: 2 }, { t: 'chest', n: 1 }, { t: 'pearl', n: 3 }],
});
add({
  name: 'longway', kind: 'think', requires: { boardwalk: 2 },
  tide: { low: 42, duration: 42, curve: 2.9 },
  map: ch3({ mud: [[3, 16, 3, 3], [8, 30, 3, 2]], rocks: [[7, 18], [8, 18], [9, 18]] }),
  items: [
    sc('wood', 3, 28.5, 40, 929),
    ...cluster('glass', 3.0, 16.0, 5, 2.2, 291), ...line('pearl', 9.0, 14.6, 10.4, 13.4, 2),
    ...cluster('rope', 8.0, 30.0, 3, 1.6, 292), ...line('wood', 2.0, 36.0, 4.4, 33.6, 2), sc('shell', 4, 20, 28, 293),
  ],
  goals: [{ t: 'glass', n: 4 }, { t: 'rope', n: 3 }, { t: 'pearl', n: 2 }],
});
add({
  name: 'letters', kind: 'easy', requires: { boardwalk: 2 },
  tide: { low: 44, duration: 51, curve: 2.7 },
  map: ch3({ bars: [[5.5, 17, 3, 1.4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 930),
    ...line('bottle', 3.0, 17.0, 8.0, 17.0, 2), ...arc('glass', 5.5, 17.0, 3.2, 200, 340, 4),
    ...line('shell', 1.4, 24.0, 4.4, 21.0, 4), ...line('rope', 9.6, 26.0, 8.4, 23.0, 2), sc('wood', 3, 29, 38, 301), sc('shell', 3, 13, 20, 302),
  ],
  goals: [{ t: 'bottle', n: 1 }, { t: 'glass', n: 3 }, { t: 'bottle', n: 2 }],
});
add({
  name: 'racing', kind: 'think', requires: { boardwalk: 3 },
  tide: { low: 38, duration: 42, curve: 2.9 },
  map: ch3({ sea: 3, bars: [[2.5, 5, 2, 1.4], [9, 6, 2, 1.4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 931),
    ...one('chest', 2.6, 4.6), ...one('chest', 9.0, 5.8), ...cluster('pearl', 5.5, 7.0, 2, 1.0, 311),
    ...line('glass', 4.0, 16.0, 8.0, 16.0, 3), ...one('rope', 1.6, 20.0), sc('shell', 4, 13, 22, 312),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'pearl', n: 2 }, { t: 'chest', n: 2 }],
});
add({
  name: 'calm', kind: 'easy', requires: { boardwalk: 2 },
  tide: { low: 44, duration: 53, curve: 2.6 },
  map: ch3({ bars: [[5.5, 14, 4, 1.6]], mud: [[2, 24, 2, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 932),
    ...arc('pearl', 5.5, 14.0, 3.0, 190, 350, 3), ...cluster('glass', 2.0, 23.6, 4, 1.6, 321),
    ...line('rope', 8.6, 23.6, 9.6, 21.0, 3), ...line('shell', 4.4, 34.0, 4.4, 29.0, 4), sc('wood', 3, 29, 38, 322), sc('shell', 4, 13, 21, 323),
  ],
  goals: [{ t: 'glass', n: 3 }, { t: 'pearl', n: 2 }, { t: 'rope', n: 3 }],
});
add({
  name: 'edge', kind: 'think', requires: { boardwalk: 3 },
  tide: { low: 36, duration: 45, curve: 2.9 },
  map: ch3({ sea: 3, bars: [[5.5, 4.6, 4, 1.4]], mud: [[3, 15, 2.4, 2], [8, 15, 2.4, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 933),
    ...line('pearl', 2.4, 4.4, 8.6, 4.4, 4), ...one('chest', 5.4, 6.0),
    ...cluster('glass', 3.0, 15.0, 3, 1.4, 331), ...cluster('rope', 8.0, 15.0, 2, 1.4, 332), sc('shell', 4, 20, 28, 333),
  ],
  goals: [{ t: 'pearl', n: 2 }, { t: 'glass', n: 3 }, { t: 'pearl', n: 4 }],
});

// ---------------- Chapter 4: 수평선 (the horizon sandbar) ----------------
const ch4 = (o) => ({ sea: 1, channel: 10, ...o });
add({
  name: 'horizon', kind: 'discover', requires: { boardwalk: 3 },
  tide: { low: 36, duration: 48, curve: 2.8 },
  map: ch4({ bars: [[5.5, 3.4, 4.5, 1.6]], mud: [[3, 7, 2, 1.2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 934),
    ...one('bottle', 5.6, 2.8), ...line('pearl', 3.0, 3.6, 8.0, 3.6, 3), ...one('chest', 8.8, 5.6),
    ...cluster('glass', 3.0, 7.0, 3, 1.2, 341), ...line('rope', 2.0, 17.0, 4.0, 15.0, 2), sc('shell', 4, 14, 23, 342),
  ],
  goals: [{ t: 'pearl', n: 2 }, { t: 'bottle', n: 1 }, { t: 'chest', n: 1 }],
});
add({
  name: 'wreck', kind: 'discover', requires: { boardwalk: 3 },
  tide: { low: 36, duration: 50, curve: 2.8 },
  map: ch4({ bars: [[2.5, 4, 2, 1.4], [9, 4, 2, 1.4]], rocks: [[6, 3], [7, 3], [7, 4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 935),
    ...line('chest', 2.0, 3.8, 3.4, 4.6, 2), ...line('rope', 8.6, 3.6, 10.2, 5.0, 3),
    ...line('wood', 3.6, 6.6, 8.0, 6.6, 3), ...cluster('pearl', 7.5, 15.0, 2, 1.4, 352), sc('glass', 3, 13, 22, 353),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'rope', n: 3 }, { t: 'chest', n: 2 }],
});
add({
  name: 'moonlow', kind: 'think', requires: { boardwalk: 3, stilt: 1 },
  tide: { low: 34, duration: 49, curve: 2.9 },
  map: ch4({ bars: [[5.5, 3, 5, 1.2], [8.5, 15.5, 2.5, 1.6]], mud: [[3, 16, 2, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 936),
    ...line('pearl', 1.6, 2.8, 9.6, 2.8, 5), ...one('chest', 5.4, 4.4),
    ...cluster('glass', 3.0, 16.0, 3, 1.4, 361), ...one('rope', 10.4, 18.0), sc('shell', 4, 20, 28, 362),
  ],
  goals: [{ t: 'pearl', n: 3 }, { t: 'glass', n: 3 }, { t: 'pearl', n: 5 }],
});
add({
  name: 'oldvillage', kind: 'easy', requires: { boardwalk: 3 },
  tide: { low: 36, duration: 53, curve: 2.7 },
  map: ch4({ bars: [[5.5, 5, 4, 2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 937),
    ...arc('glass', 5.5, 5.0, 3.6, 180, 360, 6), ...one('chest', 5.4, 4.6), ...one('bottle', 2.0, 7.0),
    ...line('rope', 8.4, 16.0, 9.6, 13.4, 2), ...line('shell', 3.0, 25.0, 6.0, 22.0, 4), sc('wood', 3, 29, 38, 371),
  ],
  goals: [{ t: 'glass', n: 4 }, { t: 'chest', n: 1 }, { t: 'bottle', n: 1 }],
});
add({
  name: 'twinbars', kind: 'think', requires: { boardwalk: 3 },
  tide: { low: 34, duration: 46, curve: 2.9 },
  map: ch4({ bars: [[2, 4, 1.8, 1.4], [9.5, 4, 1.8, 1.4]], mud: [[5.5, 6, 2, 1.2]] }),
  items: [
    sc('wood', 3, 28.5, 40, 938),
    ...cluster('pearl', 2.0, 4.0, 3, 1.0, 381), ...cluster('pearl', 9.6, 4.0, 3, 1.0, 382),
    ...cluster('glass', 5.5, 6.0, 3, 1.2, 383), ...line('rope', 2.0, 15.0, 3.0, 13.0, 2), sc('shell', 4, 20, 28, 384),
  ],
  goals: [{ t: 'pearl', n: 3 }, { t: 'glass', n: 3 }, { t: 'pearl', n: 5 }],
});
add({
  name: 'lastlight', kind: 'think', requires: { boardwalk: 3, light: 2 },
  tide: { low: 34, duration: 47, curve: 3.0 },
  map: ch4({ bars: [[5.5, 3, 4.5, 1.4]], mud: [[2, 16, 2, 2.4], [9, 16, 2, 2.4]] }),
  items: [
    sc('wood', 3, 28.5, 40, 939),
    ...line('chest', 3.0, 3.0, 8.0, 3.0, 2), ...line('pearl', 4.0, 4.4, 7.0, 4.4, 3),
    ...cluster('glass', 2.0, 16.0, 3, 1.4, 391), ...cluster('rope', 9.0, 16.0, 3, 1.4, 392), sc('shell', 4, 20, 28, 393),
  ],
  goals: [{ t: 'chest', n: 1 }, { t: 'pearl', n: 3 }, { t: 'chest', n: 2 }],
});
add({
  name: 'homecoming', kind: 'discover', requires: { boardwalk: 3 },
  tide: { low: 32, duration: 51, curve: 2.8 },
  map: ch4({ bars: [[5.5, 2.6, 5, 1.2], [3, 15, 2, 1.4], [8.5, 15.5, 2.5, 1.6]] }),
  items: [
    sc('wood', 3, 28.5, 40, 940),
    ...one('bottle', 5.6, 2.2), ...line('pearl', 2.0, 2.8, 9.4, 2.8, 4), ...one('chest', 3.0, 14.6),
    ...arc('glass', 5.5, 22.0, 3.0, 200, 340, 4), ...line('shell', 4.4, 38.0, 4.4, 34.0, 3), sc('wood', 3, 29, 38, 401),
  ],
  goals: [{ t: 'bottle', n: 1 }, { t: 'pearl', n: 3 }, { t: 'chest', n: 1 }],
});

function resolveItems(list, terrain) {
  const items = [];
  for (const it of list) {
    if (typeof it === 'function') items.push(...it(terrain));
    else items.push(it);
  }
  // drop hand-placed items that land on rock or open sea, and near-duplicates
  const out = [];
  for (const it of items) {
    const row = terrain[Math.floor(it.y)];
    const ch = row && row[Math.floor(it.x)];
    if (!ch || ch === 'r' || ch === '~') continue;
    if (out.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < 0.6)) continue;
    out.push(it);
  }
  return out;
}

export const LEVEL_DEFS = L.map((d, i) => {
  const { terrain, heights } = makeTerrain({ ...d.map });
  return {
    id: `L${String(i + 1).padStart(2, '0')}`,
    n: i + 1,
    key: d.name,
    chapter: i < 10 ? 1 : i < 22 ? 2 : i < 33 ? 3 : 4,
    kind: d.kind,
    tide: d.tide,
    requires: d.requires || {},
    fog: d.fog || null,
    hintReturn: !!d.hintReturn,
    tutorial: d.tutorial || null,
    goals: d.goals,
    terrain,
    heights,
    items: resolveItems(d.items, terrain),
  };
});
