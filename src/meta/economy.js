// Materials, buildings, level progress, chests, daily systems. Pure functions over the save object.
import BAL from '../data/balance.json';
import ITEMS from '../data/items.json';
import BUILD from '../data/buildings.json';
import COLL from '../data/collection.json';
import { LEVELS } from '../data/levels/index.js';
import { mulberry32 } from '../game/model.js';
import { dayKey, daysBetween } from './save.js';

export const MATS = ['shell', 'wood', 'glass', 'rope', 'pearl'];

export function upgradesFrom(save) {
  const b = save.buildings;
  return { boardwalk: b.boardwalk || 0, bag: b.cottage || 0, sled: b.shed || 0, light: b.lighthouse || 0, stilt: b.stilt || 0, requests: b.haenyeo || 0 };
}

export function clearedCount(save) {
  let n = 0;
  for (const k of Object.keys(save.levels)) if (save.levels[k].stars & 1) n++;
  return n;
}

export function canAfford(save, cost) {
  for (const [k, v] of Object.entries(cost)) if ((save.mats[k] || 0) < v) return false;
  return true;
}

export function missing(save, cost) {
  const out = {};
  for (const [k, v] of Object.entries(cost)) { const d = v - (save.mats[k] || 0); if (d > 0) out[k] = d; }
  return out;
}

export function pay(save, cost, sink, track) {
  for (const [k, v] of Object.entries(cost)) {
    save.mats[k] -= v;
    if (track) track('resource_spend', { currency: k, amount: v, sink });
  }
}

export function grant(save, counts, source, track) {
  for (const [k, v] of Object.entries(counts)) {
    if (!v) continue;
    save.mats[k] = (save.mats[k] || 0) + v;
    if (track) track('resource_earn', { currency: k, amount: v, source });
  }
}

export function buildingLevel(save, id) { return save.buildings[id] || 0; }

export function nextBuild(save, id) {
  const def = BUILD.list[id];
  const lv = buildingLevel(save, id);
  if (lv >= def.levels.length) return null;
  return { level: lv + 1, ...def.levels[lv] };
}

export function plotAvailable(save, id) {
  const def = BUILD.list[id];
  return clearedCount(save) >= def.unlockCleared || buildingLevel(save, id) > 0 || (id === 'boardwalk');
}

// which plots show a signpost (available & not maxed)
export function refreshPlots(save) {
  const plots = {};
  for (const id of BUILD.order) {
    if (plotAvailable(save, id) && nextBuild(save, id)) plots[id] = true;
  }
  save.plots = plots;
  return plots;
}

export function canBuildNow(save, id) {
  const nb = nextBuild(save, id);
  return !!(nb && plotAvailable(save, id) && canAfford(save, nb.cost));
}

export function anyBuildable(save) {
  return BUILD.order.find((id) => canBuildNow(save, id)) || null;
}

export function doBuild(save, id, track) {
  const nb = nextBuild(save, id);
  if (!nb || !canAfford(save, nb.cost)) return false;
  pay(save, nb.cost, `build_${id}`, track);
  save.buildings[id] = nb.level;
  refreshPlots(save);
  if (track) track('building_built', { building: id, level: nb.level, cleared: clearedCount(save) });
  return nb.level;
}

// ---------- decorations ----------
export function decorUnlocked(save) { return clearedCount(save) >= BUILD.decor.unlockCleared; }
export function decorCost(save, key) {
  const base = BUILD.decor.catalog[key].cost;
  const k = 1 + BUILD.decor.growth * save.decor.length;
  const out = {};
  for (const [m, v] of Object.entries(base)) out[m] = Math.ceil(v * k);
  return out;
}
export function decorSlotsLeft(save) { return BUILD.decor.slots.length - save.decor.length; }
export function buildDecor(save, key, track) {
  const cost = decorCost(save, key);
  if (!canAfford(save, cost) || decorSlotsLeft(save) <= 0) return false;
  pay(save, cost, `decor_${key}`, track);
  save.decor.push(key);
  if (track) track('decor_built', { decor: key, count: save.decor.length });
  return true;
}

// ---------- levels ----------
export function levelById(n) { return LEVELS[n - 1]; }
export function levelCount() { return LEVELS.length; }

export function levelRecord(save, n) {
  const id = LEVELS[n - 1].id;
  if (!save.levels[id]) save.levels[id] = { stars: 0, attempts: 0, clears: 0, best: 0 };
  return save.levels[id];
}

export function requirementsMet(save, level) {
  const req = level.requires || {};
  const up = upgradesFrom(save);
  const miss = [];
  for (const [k, v] of Object.entries(req)) if ((up[k] || 0) < v) miss.push([k, v]);
  return miss;
}

// state: 'locked' (previous not cleared) | 'needs' (building missing) | 'open' | 'cleared'
export function levelState(save, n) {
  if (n > save.unlocked) return { state: 'locked' };
  const lv = LEVELS[n - 1];
  const miss = requirementsMet(save, lv);
  const rec = save.levels[lv.id];
  if (rec && rec.stars & 1) return { state: 'cleared', stars: rec.stars, miss };
  if (miss.length) return { state: 'needs', miss };
  return { state: 'open', stars: rec ? rec.stars : 0 };
}

export function starCount(bits) { return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1); }
export function totalStars(save) { let s = 0; for (const r of Object.values(save.levels)) s += starCount(r.stars); return s; }

// chest contents: deterministic per player so reloads cannot reroll
export function rollChest(save) {
  const seed = (hashStr(save.installId) + save.stats.chests * 7919) >>> 0;
  const r = mulberry32(seed);
  const out = {};
  for (const [k, [a, b]] of Object.entries(ITEMS.chest.contents)) {
    const n = a + Math.floor(r() * (b - a + 1));
    if (n > 0) out[k] = n;
  }
  // every chest has at least a little something rare once the player is far enough
  const tid = COLL.treasures.find((t) => !save.collection.treasures[t]);
  save.stats.chests++;
  return { contents: out, treasure: tid || null };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// apply a finished run to the save; returns a summary for the results screen
export function applyRun(save, levelN, res, track, opts = {}) {
  const level = opts.levelData || LEVELS[levelN - 1];
  const isDaily = !!opts.daily;
  const rec = isDaily ? { stars: 0, attempts: 0, clears: 0 } : levelRecord(save, levelN);
  rec.attempts++;
  save.stats.runs++;
  const counts = res.counts;
  const gained = {};
  const chests = [];
  const letters = [];
  for (const [k, v] of Object.entries(counts)) {
    if (MATS.includes(k)) gained[k] = (gained[k] || 0) + v;
    else if (k === 'chest') {
      for (let i = 0; i < v; i++) {
        const c = rollChest(save);
        for (const [m, n] of Object.entries(c.contents)) gained[m] = (gained[m] || 0) + n;
        if (c.treasure) save.collection.treasures[c.treasure] = Date.now();
        chests.push(c);
      }
    } else if (k === 'bottle') {
      for (let i = 0; i < v; i++) {
        const lid = COLL.letters.find((l) => !save.collection.letters[l]);
        if (lid) { save.collection.letters[lid] = Date.now(); letters.push(lid); }
        else gained.glass = (gained.glass || 0) + 1;
      }
    } else if (k === 'starfish') {
      gained.shell = (gained.shell || 0) + v * 2;
    }
  }
  grant(save, gained, res.success ? 'run' : 'run_swept', track);
  // goals and stars
  const goals = level.goals || [];
  let bits = 0;
  const goalState = goals.map((g, i) => {
    const have = counts[g.t] || 0;
    const ok = res.success && have >= g.n;
    if (ok) bits |= 1 << i;
    return { ...g, have, ok };
  });
  const prevBits = rec.stars;
  const newBits = bits & ~prevBits;
  rec.stars |= bits;
  const firstClear = !!(bits & 1) && !(prevBits & 1);
  if (res.success) save.stats.arrivals++; else save.stats.sweeps++;
  if (res.closeCall) save.stats.closeCalls++;
  const prevFurthest = save.stats.furthest;
  save.stats.furthest = Math.max(save.stats.furthest, res.furthest);
  let unlockedNext = false;
  if (!isDaily) {
    if (bits & 1) {
      rec.clears++;
      save.fails[level.id] = 0;
      if (levelN >= save.unlocked && levelN < LEVELS.length) { save.unlocked = levelN + 1; unlockedNext = true; }
      if (firstClear && track) track('level_complete', { level: levelN, stars: starCount(rec.stars), attempts: rec.attempts });
      if (unlockedNext && track) track('level_reach', { level: levelN + 1 });
    } else {
      save.fails[level.id] = (save.fails[level.id] || 0) + 1;
      if (track) track('level_fail', { level: levelN, cause: res.success ? 'goal' : 'swept', attempt: rec.attempts, greedy_items: res.analysis && res.analysis.greedy ? res.analysis.greedy.length : 0 });
    }
  } else if (res.success && !save.daily.tideDone) {
    save.daily.tideDone = true;
    grant(save, BAL.daily.dailyTideReward, 'daily_tide', track);
    for (const [k, v] of Object.entries(BAL.daily.dailyTideReward)) gained[k] = (gained[k] || 0) + v;
    if (track) track('daily_tide_complete', { day: save.daily.day });
  }
  refreshPlots(save);
  return {
    gained, chests, letters, goalState, bits, newBits, firstClear, unlockedNext,
    record: res.furthest > prevFurthest && prevFurthest > 0,
    furthest: res.furthest,
    fails: save.fails[level.id] || 0,
  };
}

// ---------- daily: streak, overnight gift, requests ----------
export function today(save) { return dayKey(save.debugDayOffset || 0); }

export function dailyRefresh(save, track) {
  const d = today(save);
  const events = {};
  const st = save.streak;
  if (st.lastDay !== d) {
    if (st.lastDay && daysBetween(st.lastDay, d) === 1) st.count++;
    else st.count = 1;
    if (st.lastDay) events.newDay = true;
    st.lastDay = d;
    st.days++;
  }
  if (save.daily.day !== d) {
    const firstDay = save.daily.day === null;
    save.daily.day = d;
    save.daily.tideDone = false;
    save.daily.giftTaken = false;
    // overnight gift on the beach (not on the very first launch)
    if (!firstDay) {
      const n = BAL.daily.giftByStreak[Math.min(st.count, BAL.daily.giftByStreak.length) - 1];
      const r = mulberry32(hashStr(save.installId + d));
      const pool = save.unlocked > 8 ? ['shell', 'shell', 'wood', 'wood', 'glass', 'rope', 'glass'] : ['shell', 'shell', 'wood', 'wood', 'shell'];
      const gift = [];
      for (let i = 0; i < n; i++) gift.push(pool[Math.floor(r() * pool.length)]);
      if (st.count >= 7 || (st.count >= 3 && r() < 0.5)) gift.push(save.unlocked > 10 ? 'pearl' : 'glass');
      save.daily.gift = gift;
      events.gift = gift.length;
    } else save.daily.gift = [];
    save.daily.requests = makeRequests(save, d);
  }
  return events;
}

export function makeRequests(save, d) {
  const r = mulberry32(hashStr('req' + save.installId + d));
  const adv = save.unlocked;
  // Grandma asks for what piles up (shells, sea glass) and pays in what runs short (driftwood, rope, pearls)
  const asks = adv > 12 ? ['shell', 'glass', 'shell'] : ['shell', 'shell', 'glass'];
  const rewards = adv > 20 ? [{ wood: 6 }, { rope: 4 }, { pearl: 2, wood: 2 }] : adv > 8 ? [{ wood: 4 }, { rope: 2, wood: 1 }, { pearl: 1, wood: 2 }] : [{ wood: 3 }, { wood: 2, glass: 1 }, { rope: 1, wood: 1 }];
  const out = [];
  for (let i = 0; i < BAL.daily.requestCount; i++) {
    const m = asks[(i + Math.floor(r() * 3)) % asks.length];
    const base = m === 'shell' ? 10 : 6;
    const n = base + Math.floor(r() * 4) + Math.floor(adv / 6) * (m === 'shell' ? 2 : 1);
    out.push({ id: `r${i}`, mat: m, n, reward: rewards[i % rewards.length], done: false });
  }
  return out;
}

export function fulfilRequest(save, idx, track) {
  const rq = save.daily.requests[idx];
  if (!rq || rq.done || (save.mats[rq.mat] || 0) < rq.n) return false;
  pay(save, { [rq.mat]: rq.n }, 'request', track);
  grant(save, rq.reward, 'request', track);
  rq.done = true;
  if (track) track('request_complete', { request: rq.mat, reward: Object.keys(rq.reward).join('+') });
  return true;
}

export function dailyTideUnlocked(save) { return clearedCount(save) >= 5; }
export function collectionUnlocked(save) { return save.stats.chests > 0 || Object.keys(save.collection.letters).length > 0; }
export function calendarUnlocked(save) { return save.unlocked >= 3; }
