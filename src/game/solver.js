// Route planner over the time-dependent flood model. Used by the level validator (Node),
// the bot playtests, and the dev autopilot. Pure functions only.
import BAL from '../data/balance.json';
import ITEMS from '../data/items.json';
import ISLAND from '../data/island.json';
import { buildModel, buildNav, makeTide, earliest, cellOf, CELL, T, bagMultiplier } from './model.js';

export function prepare(level, up, assist = 0) {
  const m = buildModel(level, up);
  const nav = buildNav(m);
  const tide = makeTide(level, assist);
  const start = { x: ISLAND.spawn[0], y: m.F * T + ISLAND.spawn[1] };
  const items = (level.items || []).map((it, i) => ({ i, type: it.t, x: it.x * T, y: it.y * T, w: ITEMS[it.t].weight, v: ITEMS[it.t].value, cell: cellOf(nav, it.x * T, it.y * T) }));
  return { level, m, nav, tide, start, items, cap: m.st.capacity };
}

// latest time you can leave (x,y) carrying w and still get home
function latestDeparture(P, x, y, w, scale, cache, key) {
  if (cache.has(key)) return cache.get(key);
  const ok = (t0) => earliest(P.nav, P.m, P.tide, x, y, t0, w, scale).time < Infinity;
  let res;
  if (!ok(0)) res = -1;
  else if (ok(P.tide.dur)) res = P.tide.dur;
  else {
    let lo = 0, hi = P.tide.dur;
    for (let k = 0; k < 11; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    res = lo;
  }
  cache.set(key, res);
  return res;
}

// Beam search. objective(counts) -> number to maximise among safe returns.
export function plan(P, { scale = 1, beam = 40, objective, maxDepth = 30, pickDelay = 0.05 } = {}) {
  const cache = new Map();
  const startCell = cellOf(P.nav, P.start.x, P.start.y);
  let frontier = [{ x: P.start.x, y: P.start.y, t: 0, w: 0, picked: [], counts: {}, val: 0 }];
  let best = null;
  const consider = (s, back) => {
    const res = { counts: s.counts, picked: s.picked, returnAt: back, val: s.val, score: objective(s.counts, s), dep: s.t };
    if (!best || res.score > best.score || (res.score === best.score && back < best.returnAt)) best = res;
  };
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next = [];
    for (const s of frontier) {
      const r = earliest(P.nav, P.m, P.tide, s.x, s.y, s.t, s.w, scale, false);
      // option: go home now
      let homeT = Infinity;
      for (let c = 0; c < P.nav.n; c++) if (P.nav.safe[c] && r.times[c] < homeT) homeT = r.times[c];
      if (homeT < Infinity && (s.picked.length || depth === 0)) consider(s, homeT);
      for (const it of P.items) {
        if (s.picked.includes(it.i)) continue;
        if (s.w + it.w > P.cap) continue;
        const ta = r.times[it.cell];
        if (!(ta < Infinity)) continue;
        // the item must still be on dry-ish ground when we get there
        const lvl = P.tide.at(ta);
        if (P.m.depth(it.x, it.y, lvl) > 1.6) continue;
        const nw = s.w + it.w;
        const ld = latestDeparture(P, it.x, it.y, nw, scale, cache, it.i * 64 + nw);
        if (ta + pickDelay > ld) continue;
        const counts = { ...s.counts, [it.type]: (s.counts[it.type] || 0) + 1 };
        next.push({ x: it.x, y: it.y, t: ta + pickDelay, w: nw, picked: s.picked.concat(it.i), counts, val: s.val + it.v });
      }
    }
    // keep the most promising, deduplicate by picked-set
    const seen = new Set();
    next.sort((a, b) => (objective(b.counts, b) - objective(a.counts, a)) || (a.t - b.t));
    frontier = [];
    for (const s of next) {
      const k = s.picked.slice().sort((a, b) => a - b).join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      frontier.push(s);
      if (frontier.length >= beam) break;
    }
  }
  return best;
}

// goal objective: meet goal g (big bonus), then value
export function goalObjective(goal, extra = 0) {
  return (counts, s) => {
    const have = counts[goal.t] || 0;
    return (have >= goal.n ? 1000 : have * 50) + s.val * 0.5 + extra;
  };
}

export function allGoalsObjective(goals) {
  return (counts, s) => {
    let sc = 0;
    goals.forEach((g, i) => { const have = counts[g.t] || 0; sc += (have >= g.n ? 1000 : have * 40) * (i === 0 ? 1.5 : 1); });
    return sc + s.val;
  };
}

// A naive player: grabs the nearest item, heads home only when the water touches its feet
// or when the bag is full. Returns { success, counts, t }.
export function naiveBot(P, { scale = 1, panicDepth = 0, returnAtFrac = 1, greed = 1 } = {}) {
  let x = P.start.x, y = P.start.y, t = 0, w = 0;
  const picked = new Set();
  const counts = {};
  for (let step = 0; step < 60; step++) {
    const r = earliest(P.nav, P.m, P.tide, x, y, t, w, scale, false);
    let bestIt = null, bt = Infinity;
    for (const it of P.items) {
      if (picked.has(it.i) || w + it.w > P.cap) continue;
      const ta = r.times[it.cell];
      if (ta < bt && P.m.depth(it.x, it.y, P.tide.at(ta)) <= 1.6) { bt = ta; bestIt = it; }
    }
    const frac = P.tide.fraction(t);
    const wet = P.m.depth(x, y, P.tide.at(t)) > panicDepth;
    if (!bestIt || frac >= returnAtFrac || wet || (bt - t) > 12 * greed) break;
    x = bestIt.x; y = bestIt.y; t = bt; w += bestIt.w;
    picked.add(bestIt.i);
    counts[bestIt.type] = (counts[bestIt.type] || 0) + 1;
  }
  const back = earliest(P.nav, P.m, P.tide, x, y, t, w, scale);
  return { success: back.time < Infinity, counts, t: back.time, picks: picked.size, departure: t };
}

export { bagMultiplier, CELL };

// A goal-driven but greedy player: fetches goal items first, keeps grabbing the nearest thing
// until the water comes within `stopGap` elevation units of where it stands, then heads home.
export function greedyBot(P, { scale = 0.9, stopGap = 2, goal = null, prefer = 'near' } = {}) {
  let x = P.start.x, y = P.start.y, t = 0, w = 0;
  const picked = new Set();
  const counts = {};
  let reason = 'none';
  for (let step = 0; step < 60; step++) {
    const here = cellOf(P.nav, x, y);
    const lv = P.tide.at(t);
    if (step > 0 && !P.nav.safe[here] && P.nav.flood[here] - lv < stopGap) { reason = 'water'; break; }
    const r = earliest(P.nav, P.m, P.tide, x, y, t, w, scale, false);
    const needGoal = goal && (counts[goal.t] || 0) < goal.n;
    let best = null, bt = Infinity;
    for (const it of P.items) {
      if (picked.has(it.i) || w + it.w > P.cap) continue;
      if (needGoal && it.type !== goal.t) continue;
      const ta = r.times[it.cell];
      if (!(ta < Infinity) || P.m.depth(it.x, it.y, P.tide.at(ta)) > 1.6) continue;
      // 'value' players chase the shiniest thing in sight; 'near' players grab what's closest
      const key = prefer === 'value' ? -(it.v / (ta - t + 1.5)) : ta;
      if (key < bt) { bt = key; best = it; best._ta = ta; }
    }
    if (best) bt = best._ta;
    if (!best) {
      if (needGoal) { goal = null; continue; }
      reason = P.items.some((it) => !picked.has(it.i) && w + it.w <= P.cap) ? 'nothing' : 'full';
      break;
    }
    x = best.x; y = best.y; t = bt + 0.05; w += best.w;
    picked.add(best.i);
    counts[best.type] = (counts[best.type] || 0) + 1;
  }
  const back = earliest(P.nav, P.m, P.tide, x, y, t, w, scale);
  return { success: back.time < Infinity, counts, t: back.time, departure: t, picks: picked.size, reason, frac: t / P.tide.dur, fill: w / P.cap };
}

// how late (fraction of the tide) can you leave the farthest item of a type, carrying `w`
export function turnFraction(P, type, w, scale = 0.9) {
  let worst = Infinity;
  for (const it of P.items) {
    if (it.type !== type) continue;
    const ok = (t0) => earliest(P.nav, P.m, P.tide, it.x, it.y, t0, w, scale).time < Infinity;
    if (!ok(0)) { worst = Math.min(worst, -1); continue; }
    let lo = 0, hi = P.tide.dur;
    if (ok(hi)) continue;
    for (let k = 0; k < 10; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    worst = Math.min(worst, lo);
  }
  return worst === Infinity ? 1 : worst / P.tide.dur;
}
