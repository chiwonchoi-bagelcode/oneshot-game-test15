// Progression simulator: plays the tides in order with a planner-driven but imperfect player,
// spends materials on buildings, and reports when things unlock. Bundled by econ.mjs.
import { LEVELS } from '../../src/data/levels/index.js';
import BUILD from '../../src/data/buildings.json';
import { prepare, plan, allGoalsObjective, goalObjective } from '../../src/game/solver.js';
import { freshSave } from '../../src/meta/save.js';
import * as eco from '../../src/meta/economy.js';
import { mulberry32 } from '../../src/game/model.js';

const PRIORITY = ['boardwalk', 'cottage', 'haenyeo', 'shed', 'lighthouse', 'stilt'];

export function simulate({ runs = 120, seed = 1, sweepRate = { easy: 0.08, think: 0.3, discover: 0.18 }, greedy = 0.5 } = {}) {
  const R = mulberry32(seed);
  const save = freshSave();
  save.installId = 'sim' + seed;
  eco.refreshPlots(save);
  const log = [];
  const built = [];
  const cache = new Map();
  for (let r = 1; r <= runs; r++) {
    // choose a tide: the newest open one, else the best replay for what we need
    let n = save.unlocked;
    let st = eco.levelState(save, n);
    if (st.state === 'needs' || st.state === 'locked') {
      n = Math.max(1, save.unlocked - 1 - Math.floor(R() * 3));
    }
    const lv = LEVELS[n - 1];
    const up = eco.upgradesFrom(save);
    const key = `${n}|${JSON.stringify(up)}|${greedy > R() ? 'all' : 'goal'}`;
    let best = cache.get(key);
    if (!best) {
      const P = prepare(lv, up);
      best = plan(P, { scale: 0.88, beam: 16, objective: key.endsWith('all') ? allGoalsObjective(lv.goals) : goalObjective(lv.goals[0]) });
      cache.set(key, best);
    }
    const swept = R() < (sweepRate[lv.kind] || 0.15);
    const counts = {};
    if (best) {
      for (const [k, v] of Object.entries(best.counts)) counts[k] = swept ? Math.ceil(v / 2) : v;
    }
    const res = { success: !swept && !!best, counts, closeCall: false, furthest: 20, analysis: null, time: 40, tideFraction: 0.8, lostCounts: {} };
    const sum = eco.applyRun(save, n, res, null, {});
    if (r === 1 && !save.buildings.boardwalk) {
      const nb = eco.nextBuild(save, 'boardwalk');
      eco.grant(save, eco.missing(save, nb.cost), 'tutorial', null);
    }
    // a returning player: a new day every ~12 runs (gifts + grandma's trades)
    if (r % 12 === 0) {
      save.debugDayOffset = (save.debugDayOffset || 0) + 1;
      eco.dailyRefresh(save, null);
      for (const g of save.daily.gift) save.mats[g] = (save.mats[g] || 0) + 1;
    }
    if (save.buildings.haenyeo) for (let i = 0; i < 3; i++) eco.fulfilRequest(save, i, null);
    // spend
    let bought = true;
    while (bought) {
      bought = false;
      for (const id of PRIORITY) {
        if (eco.canBuildNow(save, id)) {
          const lvB = eco.doBuild(save, id, null);
          built.push({ run: r, id, lv: lvB, level: save.unlocked });
          bought = true;
          break;
        }
      }
    }
    log.push({ run: r, n, cleared: !!(sum.bits & 1), swept, unlocked: save.unlocked, mats: { ...save.mats } });
  }
  return { log, built, final: { unlocked: save.unlocked, cleared: eco.clearedCount(save), mats: save.mats, buildings: save.buildings, stars: eco.totalStars(save) } };
}
