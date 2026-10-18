// Dev-only autopilot: plays runs through the real engine by steering the joystick along solver routes.
// Used for automated playtests, screenshots and trailer capture.
import { prepare, plan, allGoalsObjective } from '../game/solver.js';
import { earliest, pathTo, cellOf, CELL } from '../game/model.js';
import { input } from '../core/input.js';
import { upgradesFrom } from '../meta/economy.js';

export function makeAutopilot(app) {
  const ap = {
    on: false, wps: [], targets: [], phase: 'idle', opts: {}, log: [],
    start(opts = {}) {
      ap.opts = { greed: 0, wobble: 0.15, speed: 1, ...opts };
      ap.on = true; ap.phase = 'wait'; ap.targets = []; ap.wps = [];
    },
    stop() { ap.on = false; input.active = false; input.vx = input.vy = input.mag = 0; },
  };
  let wobT = 0, wob = 0;
  function planRoute() {
    const w = app.world;
    const P = prepare(w.level, upgradesFrom(app.save), w.assist || 0);
    const best = plan(P, { scale: ap.opts.planScale || 0.92, beam: 24, objective: ap.opts.objective || allGoalsObjective(w.level.goals) });
    ap.targets = best ? best.picked.slice() : [];
    ap.P = P;
    if (ap.opts.order) ap.targets = ap.opts.order.slice();
  }
  function routeTo(x, y, home) {
    const w = app.world;
    const p = w.player;
    const r = earliest(w.nav, w.m, w.tide, p.x, p.y, w.runT, p.weight, 1, !!home);
    const goal = home ? r.goal : cellOf(w.nav, x, y);
    if (goal < 0 || !(r.times[goal] < Infinity)) return [];
    const pts = pathTo(r, w.nav, goal);
    if (!home) pts.push([x, y]);
    return pts;
  }
  ap.update = (dt) => {
    if (!ap.on) return;
    const w = app.world;
    if (app.mode !== 'run') return;
    if (w.state === 'ready' && ap.phase === 'wait') {
      planRoute();
      ap.phase = 'collect';
      ap.wps = [];
      ap.extra = ap.opts.greed;
    }
    if (w.state !== 'play' && w.state !== 'ready') { input.active = false; input.vx = input.vy = input.mag = 0; return; }
    const p = w.player;
    // pick next waypoint list
    if (!ap.wps.length) {
      if (ap.phase === 'collect') {
        const fits = (it) => p.weight + ({ shell: 1, wood: 2, glass: 1, rope: 2, pearl: 1, chest: 5, bottle: 1, starfish: 1 }[it.type] || 1) <= w.m.st.capacity;
        while (ap.targets.length && (w.items[ap.targets[0]].state !== 'idle' || !fits(w.items[ap.targets[0]]))) ap.targets.shift();
        if (ap.targets.length) {
          const it = w.items[ap.targets[0]];
          ap.wps = routeTo(it.x, it.y, false);
          if (!ap.wps.length) ap.targets.shift();
        } else if (ap.extra > 0) {
          // greedy extra: nearest remaining item
          let best = null, bd = 1e9;
          for (const it of w.items) { if (it.state !== 'idle' || !fits(it)) continue; const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = it; } }
          ap.extra--;
          if (best) ap.wps = routeTo(best.x, best.y, false);
        } else {
          ap.phase = 'home';
        }
      }
      if (ap.phase === 'home' && !ap.wps.length) ap.wps = routeTo(0, 0, true);
    }
    // steer
    while (ap.wps.length && Math.hypot(ap.wps[0][0] - p.x, ap.wps[0][1] - (p.y - 2)) < 5) ap.wps.shift();
    if (!ap.wps.length) { input.active = true; input.vx = 0; input.vy = ap.phase === 'home' ? 1 : 0; input.mag = 1; return; }
    const [tx, ty] = ap.wps[0];
    let dx = tx - p.x, dy = ty - (p.y - 2);
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    wobT -= dt;
    if (wobT <= 0) { wobT = 0.3 + Math.random() * 0.4; wob = (Math.random() - 0.5) * 2 * ap.opts.wobble; }
    const c = Math.cos(wob), s = Math.sin(wob);
    input.active = true;
    input.vx = (dx * c - dy * s) * ap.opts.speed;
    input.vy = (dx * s + dy * c) * ap.opts.speed;
    input.mag = ap.opts.speed;
    if (!input.moved) input.moved = true;
  };
  return ap;
}
