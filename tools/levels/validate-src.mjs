// Level validator (bundled by tools/levels/validate.mjs). Checks every tide is clearable,
// every star is reachable, and reports difficulty metrics.
import { LEVELS } from '../../src/data/levels/index.js';
import BAL from '../../src/data/balance.json';
import ITEMS from '../../src/data/items.json';
import { prepare, plan, goalObjective, allGoalsObjective, greedyBot, turnFraction } from '../../src/game/solver.js';
import { makeDailyLevel } from '../../src/game/daily.js';

export function structural(lv) {
  const errs = [];
  if (!Array.isArray(lv.terrain) || lv.terrain.length !== BAL.flatsRows) errs.push(`terrain rows ${lv.terrain && lv.terrain.length} != ${BAL.flatsRows}`);
  (lv.terrain || []).forEach((r, y) => {
    if (r.length !== BAL.worldW) errs.push(`row ${y} width ${r.length}`);
    if (/[^~cmsbr]/.test(r)) errs.push(`row ${y} bad char`);
  });
  const col = BAL.boardwalk.column;
  for (let y = BAL.flatsRows - BAL.boardwalk.length[3]; y < BAL.flatsRows; y++) if (lv.terrain[y] && lv.terrain[y][col] === 'r') errs.push(`rock under boardwalk at row ${y}`);
  for (const it of lv.items || []) {
    if (!ITEMS[it.t]) errs.push(`unknown item ${it.t}`);
    const row = lv.terrain[Math.floor(it.y)];
    const ch = row ? row[Math.floor(it.x)] : undefined;
    if (ch === undefined) errs.push(`item outside map ${it.t}@${it.x},${it.y}`);
    else if (ch === 'r' || ch === '~') errs.push(`item on ${ch === 'r' ? 'rock' : 'sea'} ${it.t}@${it.x},${it.y}`);
  }
  for (const g of lv.goals || []) {
    const n = (lv.items || []).filter((i) => i.t === g.t).length;
    if (n < g.n) errs.push(`goal ${g.t}x${g.n} but only ${n} on the map`);
  }
  if (!lv.goals || !lv.goals.length) errs.push('no goals');
  return errs;
}

// upgrades a typical player owns when reaching a tide (used for tension metrics, not for solvability)
export function expected(lv) {
  const n = lv.n || 12;
  const r = lv.requires || {};
  const e = {
    boardwalk: Math.max(r.boardwalk || 0, n >= 11 ? 2 : n >= 2 ? 1 : 0),
    bag: n >= 30 ? 3 : n >= 16 ? 2 : n >= 5 ? 1 : 0,
    sled: n >= 24 ? 2 : n >= 10 ? 1 : 0,
    light: Math.max(r.light || 0, n >= 14 ? 1 : 0),
    stilt: Math.max(r.stilt || 0, 0),
  };
  return e;
}

function upFromReq(req) {
  return { boardwalk: req.boardwalk || 0, bag: req.bag || 0, sled: req.sled || 0, light: req.light || 0, stilt: req.stilt || 0 };
}

export function validateLevel(lv, opts = {}) {
  const out = { id: lv.id, errors: structural(lv), stars: [], metrics: {} };
  if (out.errors.length) return out;
  const up = opts.up || upFromReq(lv.requires || {});
  // the expected bag at this point of the game: one cottage level per ~6 tides (not required, so only for metrics)
  const P = prepare(lv, up);
  const human = BAL.validator.humanSpeed, starS = BAL.validator.starSpeed;
  lv.goals.forEach((g, i) => {
    if (opts.quick && i > 0) { out.stars.push({ goal: `${g.t}x${g.n}`, ok: true }); return; }
    const scale = i === 0 ? human : starS;
    const best = plan(P, { scale, beam: BAL.validator.beam, objective: goalObjective(g) });
    const ok = !!best && (best.counts[g.t] || 0) >= g.n;
    out.stars.push({ goal: `${g.t}x${g.n}`, ok, returnAt: best ? +best.returnAt.toFixed(1) : null, dep: best ? +best.dep.toFixed(1) : null });
    if (i === 0 && best) {
      out.metrics.mainReturn = +best.returnAt.toFixed(1);
      out.metrics.mainSlack = +(P.tide.dur - best.returnAt).toFixed(1);
    }
  });
  if (!out.stars[0].ok) out.errors.push('main goal not reachable at human speed');
  out.stars.slice(1).forEach((s, i) => { if (!s.ok) out.errors.push(`star ${i + 2} (${s.goal}) not reachable`); });
  if (opts.quick) return out;
  const all = plan(P, { scale: 1, beam: BAL.validator.beam, objective: allGoalsObjective(lv.goals) });
  out.metrics.bestValue = all ? all.val : 0;
  out.metrics.bestAllGoals = all ? lv.goals.map((g) => (all.counts[g.t] || 0) >= g.n ? 1 : 0).join('') : '000';
  // naive players: how often does someone who keeps picking "one more" get home?
  const g0 = lv.goals[0];
  const ex = expected(lv);
  const PB = prepare(lv, ex);
  const bots = [
    greedyBot(PB, { scale: 0.9, stopGap: 0.5, goal: g0, prefer: 'value' }),
    greedyBot(PB, { scale: 0.9, stopGap: 3, goal: g0, prefer: 'value' }),
    greedyBot(PB, { scale: 0.9, stopGap: 0.5, goal: g0 }),
    greedyBot(PB, { scale: 0.85, stopGap: 6, goal: g0 }),
  ];
  out.metrics.botWhy = bots.map((b) => `${b.reason[0]}${Math.round(b.frac * 100)}`).join(' ');
  out.metrics.turn = +turnFraction(PB, g0.t, Math.round(PB.cap * 0.6)).toFixed(2);
  out.metrics.naive = bots.map((b) => (b.success ? 'S' : 'x')).join('');
  out.metrics.naiveGoal = bots.map((b) => (b.success && (b.counts[lv.goals[0].t] || 0) >= lv.goals[0].n ? 'G' : '-')).join('');
  out.metrics.tide = `${lv.tide.low}/${lv.tide.duration}s/c${lv.tide.curve}`;
  out.metrics.items = lv.items.length;
  return out;
}

export function levelCount() { return LEVELS.length; }
export function levelId(i) { return LEVELS[i].id; }
export function validateIndex(i) { return validateLevel(LEVELS[i]); }
export function validateDaily(days) {
  const out = [];
  const base = Date.UTC(2026, 9, 1);
  for (const d of days) {
    const day = new Date(base + d * 86400000).toISOString().slice(0, 10);
    for (const b of [1, 2, 3]) {
      const lv = makeDailyLevel(day, { buildings: { boardwalk: b } });
      const r = validateLevel(lv, { up: { boardwalk: b }, quick: true });
      out.push({ day, board: b, mod: lv.mod, ok: !r.errors.length, errors: r.errors });
    }
  }
  return out;
}

export function runAll({ daily = false } = {}) {
  const results = LEVELS.map((lv) => validateLevel(lv));
  let dailyRes = [];
  if (daily) {
    const base = new Date(Date.UTC(2026, 9, 1));
    for (let d = 0; d < 120; d++) {
      const day = new Date(base.getTime() + d * 86400000).toISOString().slice(0, 10);
      for (const b of [1, 2, 3]) {
        const lv = makeDailyLevel(day, { buildings: { boardwalk: b } });
        const r = validateLevel(lv, { up: { boardwalk: b } });
        dailyRes.push({ day, board: b, mod: lv.mod, ok: !r.errors.length, errors: r.errors });
      }
    }
  }
  return { results, dailyRes };
}
