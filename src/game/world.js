// The world scene: one map for both the island (home) and the run on the tidal flats.
import BAL from '../data/balance.json';
import ITEMS from '../data/items.json';
import BUILD from '../data/buildings.json';
import ISLAND from '../data/island.json';
import { buildModel, buildNav, makeTide, earliest, pathTo, turnBackAnalysis, clamp, lerp, hash2, T } from './model.js';
import { bakeTerrain } from './terrain.js';
import { Water } from './water.js';
import { FX } from './fx.js';
import { Player } from './player.js';
import { spr, sprB, sprC, sprPart, frame } from '../core/assets.js';
import { input } from '../core/input.js';
import { screen } from '../core/screen.js';

const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class World {
  constructor(hooks) {
    this.hooks = hooks;           // { event(name, data) }
    this.water = new Water();
    this.fx = new FX();
    this.player = new Player();
    this.mode = 'island';
    this.state = 'idle';
    this.time = 0;
    this.camX = 0; this.camY = 0;
    this.items = [];
    this.villagers = [];
    this.building = null;         // construction animation
    this.slowmo = 1;
    this.quality = 1;
    this.hint = null;
    this.gifts = [];
    this.boardAnim = null;
  }

  // ---------- setup ----------
  load(level, up, save) {
    this.level = level;
    this.up = up;
    this.save = save;
    this.m = buildModel(level, up);
    this.nav = buildNav(this.m);
    this.terrain = bakeTerrain(this.m);
    this.islandTop = this.m.F * T;
    this.items = (level.items || []).map((it, i) => ({
      id: i, type: it.t, x: it.x * T, y: it.y * T, state: 'idle', phase: hash2(i, 3, 1) * 6.28, float: 0, alpha: 1,
      hidden: !!(level.fog && it.y < level.fog && !(up.light >= 1)),
    }));
    this.tide = makeTide(level, this.assist || 0);
    this.fx.clear();
    this.setupVillagers();
  }

  setAssist(a) { this.assist = a; if (this.level) this.tide = makeTide(this.level, a); }

  setupVillagers() {
    const b = this.save.buildings;
    const top = this.islandTop;
    const list = [];
    const add = (kind, x, y, roam) => list.push({ kind, x, y, hx: x, hy: y, tx: x, ty: y, t: Math.random() * 3, flip: false, anim: Math.random() * 4, roam });
    if (b.boardwalk) add('cat', 96, top + 30, 40);
    if (b.haenyeo) add('granny', 112, top + 150, 10);
    if (b.shed) add('fisher', 54, top + 64, 8);
    if (b.lighthouse) add('keeper', 150, top + 90, 8);
    if (b.stilt) add('boatman', 118, top + 64, 6);
    this.villagers = list;
  }

  islandCamY() {
    const bh = screen.bh;
    // frame the island just above the bottom card so no building hides behind the UI
    const ui = this.uiBottom || 100;
    // the camera may look past the world's bottom edge: open sea is drawn there
    return clamp(this.islandTop + 11 * T + 4 - (bh - ui), -bh, this.m.Hp - bh + ui + 8);
  }

  enterIsland() {
    this.mode = 'island';
    this.state = 'idle';
    this.waterLevel = 100;
    const [sx, sy] = ISLAND.spawn;
    if (!this.keepPlayerPos) this.player.reset(sx, this.islandTop + sy);
    this.keepPlayerPos = false;
    this.player.state = 'idle';
    this.player.dir = 'down';
    this.player.visible = true;
    this.player.rot = 0;
    this.camY = this.islandCamY();
    this.camTarget = this.camY;
  }

  // begin a run: water recedes, camera pans out
  startRun() {
    this.mode = 'run';
    this.state = 'intro';
    this.stateT = 0;
    this.runT = 0;
    this.waterLevel = 100;
    const [sx, sy] = ISLAND.spawn;
    this.player.reset(sx, this.islandTop + sy);
    this.player.dir = 'up';
    this.hasLeft = false;
    this.trace = [];
    this.picks = [];
    this.traceT = 0;
    this.combo = 0;
    this.lastPick = -10;
    this.fullCD = 0;
    this.maxDepthRecent = -10;
    this.wetT = -10;
    this.nearT = -10;
    this.gapT = 0;
    this.bellRung = false;
    this.litPath = null;
    this.slackT = 0;
    this.slack = Infinity;
    this.furthest = 0;
    this.camFrom = this.camY;
    this.anchor = 0.64;
    this.result = null;
    this.items.forEach((it) => { it.state = 'idle'; it.float = 0; it.alpha = 1; });
    this.fx.clear();
    input.moved = false;
    this.hooks.event('run_intro', {});
  }

  // ---------- update ----------
  update(dt) {
    this.time += dt;
    dt *= this.slowmo;
    this.fx.update(dt);
    this.updateVillagers(dt);
    if (this.building) {
      this.building.t += dt;
      if (this.building.t > this.building.dur + 0.6) this.building = null;
    }
    if (this.mode === 'island') return this.updateIsland(dt);
    switch (this.state) {
      case 'intro': return this.updateIntro(dt);
      case 'ready':
      case 'play': return this.updatePlay(dt);
      case 'arrive': return this.updateArrive(dt);
      case 'swept': return this.updateSwept(dt);
      case 'boat': return this.updateBoat(dt);
      default: this.updateCamera(dt);
    }
  }

  updateIsland(dt) {
    this.waterLevel = 100;
    const p = this.player;
    const ix = input.active ? input.vx : 0, iy = input.active ? input.vy : 0;
    const ox = p.x, oy = p.y;
    p.move(dt, ix, iy, this.m, 100);
    // keep the player on the island in home mode
    if (!this.m.isSafe(p.x, p.y) || p.y < this.islandTop + 6) { p.x = ox; p.y = oy; p.vx = p.vy = 0; }
    p.face = 'normal';
    let target = this.islandCamY();
    if (this.boardAnim) {
      const k = clamp(this.boardAnim.t / 1.2, 0, 1);
      const len = this.boardAnim.from + (this.m.st.boardLen - this.boardAnim.from) * k;
      target = Math.min(target, this.islandTop - len * T - screen.bh * 0.3);
    }
    this.camY += (target - this.camY) * (1 - Math.exp(-dt * 4));
    this.camX = this.centerCamX(p.x);
  }

  centerCamX(px) {
    const bw = screen.bw, Wp = this.m.Wp;
    if (bw >= Wp) return Math.round((Wp - bw) / 2);
    return Math.round(clamp(px - bw / 2, 0, Wp - bw));
  }

  runCamTarget() {
    const p = this.player;
    return clamp(p.y - screen.bh * this.anchor, -screen.bh * 0.3, this.m.Hp - screen.bh);
  }

  updateIntro(dt) {
    this.stateT += dt;
    const dur = BAL.tide.introSeconds;
    const k = clamp(this.stateT / dur, 0, 1);
    this.waterLevel = lerp(100, this.tide.low, easeOut(k));
    this.camY = lerp(this.camFrom, this.runCamTarget(), ease(k));
    this.camX = this.centerCamX(this.player.x);
    this.player.anim += dt * 2;
    if (k >= 1) {
      this.state = 'ready';
      this.hooks.event('run_ready', {});
    }
  }

  skipIntro() {
    if (this.state === 'intro') this.stateT = BAL.tide.introSeconds;
  }

  updateCamera(dt, rate = 5) {
    const t = this.runCamTarget();
    this.camY += (t - this.camY) * (1 - Math.exp(-dt * rate));
    this.camX = this.centerCamX(this.player.x);
  }

  updatePlay(dt) {
    const p = this.player;
    const m = this.m;
    if (this.state === 'ready') {
      this.waterLevel = this.tide.low;
      if (input.active && input.mag > 0.15) {
        this.state = 'play';
        this.hooks.event('run_start', {});
      }
    } else {
      this.runT += dt;
    }
    const lv = this.state === 'play' ? this.tide.at(this.runT) : this.tide.low;
    this.waterLevel = lv;
    const ix = input.active ? input.vx : 0, iy = input.active ? input.vy : 0;
    p.move(dt, ix, iy, m, lv, (side) => this.onStep(side));
    // look-ahead camera
    if (p.vy < -6) this.anchor += (0.64 - this.anchor) * (1 - Math.exp(-dt * 2));
    else if (p.vy > 6) this.anchor += (0.38 - this.anchor) * (1 - Math.exp(-dt * 2));
    this.updateCamera(dt);
    const onSafe = m.isSafe(p.x, p.y);
    if (!onSafe && p.y < this.islandTop - 8) this.hasLeft = true;
    this.furthest = Math.max(this.furthest, (this.islandTop - p.y) / T);
    // sea fog: things close to you come into view
    if (this.level.fog && !this.up.light) {
      for (const it of this.items) {
        if (it.hidden && Math.hypot(it.x - p.x, it.y - p.y) < 44) {
          it.hidden = false;
          this.fx.burst(it.x, it.y, 6, { speed: 26, life: 0.4, gravity: 0, sprites: ['fx_sparkle1', 'fx_sparkle3'] });
          this.hooks.event('reveal', it);
        }
      }
    }
    // pickups
    const cap = m.st.capacity;
    const R = BAL.player.pickupRadius;
    this.fullCD -= dt;
    for (const it of this.items) {
      if (it.state !== 'idle' || it.hidden) continue;
      const dx = it.x - p.x, dy = it.y - (p.y - 4);
      if (dx * dx + dy * dy > R * R) continue;
      const w = ITEMS[it.type].weight;
      if (p.weight + w > cap) {
        if (this.fullCD <= 0) { this.fullCD = 1.4; this.hooks.event('bag_full', { x: p.x, y: p.y }); this.fx.add({ x: p.x, y: p.y - 30, vx: 0, vy: -6, g: 0, life: 1.1, sprite: 'fx_full', drag: 1, fade: true }); }
        continue;
      }
      it.state = 'picked';
      p.addItem(it.type, this.runT);
      this.picks.push({ t: this.runT, type: it.type, x: it.x, y: it.y });
      this.combo = (this.runT - this.lastPick < BAL.combo.window) ? this.combo + 1 : 1;
      this.lastPick = this.runT;
      this.fx.fly(ITEMS[it.type].sprite, it.x, it.y, p);
      this.fx.anim(it.x, it.y, ['fx_ring0', 'fx_ring1', 'fx_ring2'], 18);
      this.fx.burst(it.x, it.y - 2, 5, { speed: 34, life: 0.35, gravity: 60, sprites: ['fx_sparkle1', 'fx_sparkle3'] });
      this.fx.floater(it.x, it.y, null, '+1');
      if (w >= 4) this.fx.shake(1.2, 0.18);
      this.hooks.event('pick', { type: it.type, combo: this.combo, fill: p.fill(cap), x: it.x, y: it.y });
    }
    // the sea takes back items it covers
    for (const it of this.items) {
      if (it.state === 'idle') {
        if (m.depth(it.x, it.y, lv) > 1.6) { it.state = 'float'; it.float = 0; if (this.onScreen(it.x, it.y)) this.hooks.event('item_float', it); }
      } else if (it.state === 'float') {
        it.float += dt;
        it.y -= dt * 5;
        it.x += Math.sin(it.float * 2 + it.phase) * dt * 3;
        it.alpha = clamp(1 - it.float / 2.6, 0, 1);
        if (it.alpha <= 0) it.state = 'gone';
      }
    }
    // danger
    const d = m.depth(p.x, p.y, lv);
    if (d > 0) this.wetT = this.runT;
    // how close is the water behind you? (remembered briefly for the close-call call at the island)
    this.gapT -= dt;
    if (this.gapT <= 0 && this.state === 'play') {
      this.gapT = 0.1;
      let gap = 99;
      for (let dy = 4; dy < 48; dy += 4) if (m.depth(p.x, p.y - dy, lv) > 0) { gap = dy; break; }
      if (gap < BAL.closeCall.behindPixels) this.nearT = this.runT;
    }
    const danger = d > 0 ? clamp(d / BAL.move.sweptDepth, 0, 1) : (d > -BAL.move.wetBand && !onSafe ? 0.04 : 0);
    this.danger = danger;
    p.face = p.pickFace(cap, danger);
    // trace for the post-run analysis
    this.traceT -= dt;
    if (this.state === 'play' && this.traceT <= 0) {
      this.traceT = 0.25;
      this.trace.push({ t: this.runT, x: p.x, y: p.y, w: p.weight });
    }
    // lighthouse bell / tutorial hint: tell the player when it's time to turn back
    this.slackT -= dt;
    if (this.state === 'play' && this.slackT <= 0 && p.bag.length && !onSafe) {
      this.slackT = 0.5;
      this.slack = this.computeSlack();
      const warnAt = BAL.lighthouse.bellMargin;
      if (!this.bellRung && this.slack <= warnAt && (this.up.light >= 1 || this.level.hintReturn)) {
        this.bellRung = true;
        this.hooks.event('turn_back', { slack: this.slack, late: this.slack < 0 });
      }
      if (this.bellRung && this.up.light >= 2) {
        const r = earliest(this.nav, m, this.tide, p.x, p.y, this.runT, p.weight);
        this.litPath = r.goal >= 0 ? pathTo(r, this.nav, r.goal) : null;
      }
    }
    this.hooks.event('tick', { lv, danger, depth: d, fill: p.fill(cap) });
    if (this.state !== 'play') return;
    // swept?
    if (d >= BAL.move.sweptDepth) return this.beginSwept();
    // stilt hut: a safe ferry far out
    if (this.up.stilt && p.bag.length && this.atStilt()) return this.beginBoat();
    // home?
    if (onSafe && this.hasLeft && p.bag.length) return this.beginArrive(false);
    if (this.runT >= this.tide.dur) {
      if (onSafe) return this.beginArrive(false);
      return this.beginSwept();
    }
  }

  atStilt() {
    const [ax, ay] = BUILD.list.stilt.anchor;
    const p = this.player;
    return Math.abs(p.x - ax) < 14 && Math.abs(p.y - ay) < 10;
  }

  computeSlack() {
    // latest departure (from now on, staying here) that still gets home; negative if already late
    const p = this.player;
    const now = this.runT;
    const ok = (t0) => earliest(this.nav, this.m, this.tide, p.x, p.y, t0, p.weight).time < Infinity;
    if (!ok(now)) return -1;
    let lo = now, hi = this.tide.dur;
    if (ok(hi)) return hi - now;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid; else hi = mid;
    }
    return lo - now;
  }

  onStep(side) {
    const p = this.player;
    const d = p.depth;
    const kind = d > 0 ? 'water' : this.m.onBoard(p.x, p.y) ? 'board' : this.m.type[this.m.tileAt(p.x, p.y)] === 'mud' ? 'mud' : 'sand';
    if (kind === 'sand' || kind === 'mud') {
      this.fx.footprint(p.x + (side ? 2 : -2), p.y, kind, side === 1);
      if (Math.random() < 0.5) this.fx.burst(p.x, p.y, 2, { speed: 14, life: 0.3, gravity: 20, colors: kind === 'mud' ? ['#7c6750', '#9b8468'] : ['#f8e6b8', '#d9b47a'] });
    } else if (kind === 'water') {
      this.fx.burst(p.x, p.y - 2, 3, { speed: 26, life: 0.35, gravity: 120, angle: -Math.PI / 2, spread: 1.6, colors: ['#f4fffb', '#9fe2dc'] });
    }
    this.hooks.event('step', { kind, fill: p.fill(this.m.st.capacity) });
  }

  onScreen(x, y) {
    return y > this.camY - 16 && y < this.camY + screen.bh + 16;
  }

  // ---------- the stilt hut ferry ----------
  beginBoat() {
    this.state = 'boat';
    this.stateT = 0;
    this.player.vx = this.player.vy = 0;
    this.player.state = 'cheer';
    this.hooks.event('boat', {});
  }

  updateBoat(dt) {
    this.stateT += dt;
    this.player.anim += dt * 2;
    if (this.stateT > 0.7 && !this.boatMoved) {
      this.boatMoved = true;
      const [sx, sy] = ISLAND.spawn;
      this.player.x = sx; this.player.y = this.islandTop + sy;
      this.anchor = 0.45;
      this.camY = this.runCamTarget();
    }
    if (this.stateT > 1.1) { this.boatMoved = false; this.beginArrive(true); }
  }

  // ---------- arrival ----------
  beginArrive(byBoat) {
    const p = this.player;
    this.state = 'arrive';
    this.stateT = 0;
    this.byBoat = byBoat;
    const recentWet = this.runT - this.wetT < BAL.closeCall.seconds || this.runT - this.nearT < BAL.closeCall.seconds;
    const frac = this.tide.fraction(this.runT);
    // how far behind was the water? (looking back toward the flats)
    let gap = 99;
    for (let dy = 0; dy < 60; dy += 2) {
      if (this.m.depth(p.x, p.y - dy - 8, this.waterLevel) > 0) { gap = dy; break; }
    }
    this.closeCall = recentWet || gap < BAL.closeCall.pixels || frac > 0.93;
    this.slowmo = 0.3;
    p.state = 'cheer';
    p.face = 'happy';
    p.vx = p.vy = 0;
    // a wave crashes right behind
    const cy = p.y - Math.min(gap, 40) - 10;
    this.fx.anim(p.x, cy, ['fx_crash0', 'fx_crash1', 'fx_crash2', 'fx_crash3', 'fx_crash4'], 12, { front: false });
    this.fx.burst(p.x, cy + 6, this.closeCall ? 26 : 12, { speed: 60, life: 0.8, gravity: 140, angle: -Math.PI / 2, spread: 2.2, colors: ['#f4fffb', '#bff0e6', '#9fe2dc'] });
    this.fx.shake(this.closeCall ? 3 : 1.5, 0.35);
    this.hooks.event('arrive', { closeCall: this.closeCall, byBoat, gap, frac, bag: p.bag.slice() });
    this.pourT = 0.55;
    this.pourIndex = 0;
    this.pourList = p.bag.slice();
    this.pile = [];
  }

  updateArrive(dt) {
    const p = this.player;
    this.stateT += dt;
    if (this.stateT > 0.35) this.slowmo = Math.min(1, this.slowmo + dt * 3);
    this.waterLevel = this.state === 'arrive' && this.runT < this.tide.dur ? this.tide.at(this.runT) : this.waterLevel;
    p.anim += dt * 2;
    this.updateCamera(dt, 3);
    if (this.stateT > 0.5 && p.state === 'cheer' && this.pourIndex === 0) p.lift = 0;
    // harvest pours out of the sack one by one
    if (this.stateT >= this.pourT && this.pourIndex < this.pourList.length) {
      const it = this.pourList[this.pourIndex];
      const n = this.pourList.length;
      const a = -Math.PI / 2 + ((this.pourIndex % 7) - 3) * 0.32 + (Math.random() - 0.5) * 0.2;
      const s = 70 + Math.random() * 30;
      this.fx.add({ x: p.x, y: p.y - 12, vx: Math.cos(a) * s * 0.6, vy: Math.sin(a) * s, g: 260, life: 0.62, sprite: ITEMS[it.type].sprite, drag: 1, fade: false });
      this.hooks.event('pour', { type: it.type, i: this.pourIndex, n });
      this.pourIndex++;
      this.pourT = this.stateT + Math.max(0.045, 0.16 - n * 0.006);
      if (this.pourIndex >= this.pourList.length) this.pourDoneAt = this.stateT + 0.65;
    }
    p.state = this.pourIndex < this.pourList.length || this.stateT < 1.2 ? 'cheer' : 'idle';
    if (p.state === 'idle') { p.dir = 'down'; p.face = 'happy'; }
    if (this.pourDoneAt && this.stateT >= this.pourDoneAt && !this.arriveDone) {
      this.arriveDone = true;
      this.hooks.event('arrive_done', this.buildResult(true));
    }
  }

  // tap to hurry the harvest
  hurry() {
    if (this.state === 'arrive' && !this.arriveDone) {
      while (this.pourIndex < this.pourList.length) {
        this.hooks.event('pour', { type: this.pourList[this.pourIndex].type, i: this.pourIndex, n: this.pourList.length, quiet: true });
        this.pourIndex++;
      }
      this.slowmo = 1;
      this.pourDoneAt = this.stateT;
    }
    if (this.state === 'swept' && this.stateT < 2.6) this.stateT = Math.max(this.stateT, 2.6);
  }

  // ---------- swept ----------
  beginSwept() {
    const p = this.player;
    this.state = 'swept';
    this.stateT = 0;
    p.state = 'flail';
    p.vx = p.vy = 0;
    const n = p.bag.length;
    const lose = Math.floor(n * (1 - BAL.sweep.keepFraction));
    this.lost = p.bag.slice(n - lose);
    this.kept = p.bag.slice(0, n - lose);
    // lost items float away from the sack (most recent first)
    this.lost.slice().reverse().forEach((it, i) => {
      const a = -Math.PI / 2 + (i - this.lost.length / 2) * 0.5;
      this.fx.add({ x: p.x, y: p.y - 10, vx: Math.cos(a) * 26, vy: Math.sin(a) * 22 - 6, g: 0, life: 2.2 + i * 0.1, sprite: ITEMS[it.type].sprite, drag: 0.97, fade: true });
    });
    this.fx.burst(p.x, p.y - 6, 24, { speed: 70, life: 0.9, gravity: 160, colors: ['#f4fffb', '#bff0e6', '#62bccb'] });
    this.fx.shake(4, 0.5);
    // analysis: what made the difference
    try {
      this.analysis = turnBackAnalysis(this.m, this.nav, makeTide(this.level, this.assist || 0), this.trace, this.picks);
    } catch (e) {
      this.analysis = { kind: 'none' };
    }
    this.sweptAt = { x: p.x, y: p.y, t: this.runT };
    this.hooks.event('swept', { lost: this.lost, kept: this.kept, analysis: this.analysis });
  }

  updateSwept(dt) {
    const p = this.player;
    this.stateT += dt;
    const t = this.stateT;
    if (t < 1.3) {
      this.waterLevel = this.tide.at(Math.min(this.tide.dur, this.runT + t));
      p.rot = Math.sin(t * 14) * 0.5;
      p.lift = Math.sin(t * 6) * 2;
      p.anim += dt * 3;
      p.y -= dt * 6;
      this.updateCamera(dt, 3);
      if (!this.wipeSent && t > 1.0) { this.wipeSent = true; this.hooks.event('wipe', {}); }
    } else if (!this.washed) {
      // washed ashore on the island beach
      this.washed = true;
      const [sx, sy] = ISLAND.spawn;
      p.x = sx + 10; p.y = this.islandTop + sy + 10;
      p.rot = 0; p.lift = 0;
      p.state = 'sit';
      p.face = 'dazed';
      p.bag = this.kept.slice();
      p.weight = p.bag.reduce((s, it) => s + ITEMS[it.type].weight, 0);
      this.anchor = 0.45;
      this.camY = this.runCamTarget();
      this.waterLevel = 100;
      this.hooks.event('washed', {});
    } else {
      p.anim += dt;
      if (t > 2.2 && p.face !== 'happy') {
        p.face = 'happy';
        this.fx.burst(p.x, p.y - 12, 10, { speed: 40, life: 0.5, gravity: 140, colors: ['#9fe2dc', '#f4fffb'] });
        this.hooks.event('shake_off', {});
      }
      if (t % 0.4 < dt) this.fx.add({ x: p.x + (Math.random() - 0.5) * 10, y: p.y - 14, vx: 0, vy: 10, g: 60, life: 0.4, sprite: 'fx_sweat', drag: 1, fade: true });
      if (t > 2.8 && !this.sweptDone) {
        this.sweptDone = true;
        this.hooks.event('swept_done', this.buildResult(false));
      }
    }
  }

  buildResult(success) {
    const p = this.player;
    const bag = success ? p.bag : this.kept;
    const counts = {};
    for (const it of bag) counts[it.type] = (counts[it.type] || 0) + 1;
    const lostCounts = {};
    if (!success) for (const it of this.lost) lostCounts[it.type] = (lostCounts[it.type] || 0) + 1;
    return {
      success,
      closeCall: success && this.closeCall,
      byBoat: !!this.byBoat,
      counts,
      lostCounts,
      analysis: success ? null : this.analysis,
      trace: this.trace,
      sweptAt: this.sweptAt,
      time: this.runT,
      tideFraction: this.tide.fraction(this.runT),
      furthest: Math.round(this.furthest),
      picks: this.picks.length,
    };
  }

  resetFlags() {
    this.arriveDone = false; this.sweptDone = false; this.washed = false; this.wipeSent = false; this.pourDoneAt = 0;
    this.slowmo = 1;
  }

  // ---------- villagers & construction ----------
  updateVillagers(dt) {
    for (const v of this.villagers) {
      v.anim += dt * (v.kind === 'cat' ? 6 : 2);
      v.t -= dt;
      const dx = v.tx - v.x, dy = v.ty - v.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const sp = v.kind === 'cat' ? 14 : 8;
        v.x += dx / d * sp * dt; v.y += dy / d * sp * dt;
        v.flip = dx < 0;
        v.moving = true;
      } else v.moving = false;
      if (v.t <= 0) {
        v.t = 2 + Math.random() * 4;
        v.tx = v.hx + (Math.random() - 0.5) * 2 * v.roam;
        v.ty = v.hy + (Math.random() - 0.5) * v.roam;
        if (!this.m.isSafe(v.tx, v.ty)) { v.tx = v.hx; v.ty = v.hy; }
      }
    }
  }

  playBuild(id, level) {
    const b = BUILD.list[id];
    const [ax, ay] = b.anchor;
    const y = b.flats ? ay : this.islandTop + ay;
    this.building = { id, level, t: 0, dur: 1.6, x: ax, y };
    return { x: ax, y };
  }

  focusOn(y) { this.camTargetIsland = y; }

  // building hit-test for taps in island mode (world px)
  pick(wx, wy) {
    const b = this.save.buildings;
    let best = null, bd = 1e9;
    for (const id of BUILD.order) {
      const def = BUILD.list[id];
      if (def.flats) continue;
      const [ax, ay] = def.anchor;
      const y = this.islandTop + ay;
      let w = 16, h = 20;
      const lv = b[id] || 0;
      if (id === 'boardwalk') { w = 24; h = 24; }
      else if (lv && def.sprite) { const f = frame(def.sprite[lv - 1]); if (f) { w = f[2]; h = f[3]; } }
      if (wx > ax - w / 2 - 4 && wx < ax + w / 2 + 4 && wy > y - h - 4 && wy < y + 6) {
        const d = Math.abs(wy - (y - h / 2));
        if (d < bd) { bd = d; best = id; }
      }
    }
    return best;
  }

  // ---------- render ----------
  render(ctx) {
    const bw = screen.bw, bh = screen.bh;
    const [sx, sy] = this.fx.shakeOffset();
    const cx = Math.round(this.camX) + sx, cy = Math.round(this.camY) + sy;
    ctx.fillStyle = '#2c638e';
    ctx.fillRect(0, 0, bw, bh);
    // terrain
    const m = this.m;
    const tx0 = Math.max(0, cx), ty0 = Math.max(0, cy);
    const tx1 = Math.min(m.Wp, cx + bw), ty1 = Math.min(m.Hp, cy + bh);
    if (tx1 > tx0 && ty1 > ty0) ctx.drawImage(this.terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 - cx, ty0 - cy, tx1 - tx0, ty1 - ty0);
    this.fx.drawPrints(ctx, cx, cy);
    // items lying on the flats (under the water layer so the sea visibly covers them)
    for (const it of this.items) {
      if (it.state !== 'idle' || !this.onScreen(it.x, it.y)) continue;
      if (it.hidden) {
        if (((this.time * 2 + it.phase) % 3) < 0.4) sprC(ctx, 'fx_sparkle2', it.x - cx, it.y - cy, false, 0.5);
        continue;
      }
      const bob = Math.round(Math.sin(this.time * 2.2 + it.phase) * 0.8);
      spr(ctx, it.type === 'chest' ? 'shadow_big' : 'shadow', it.x - (it.type === 'chest' ? 10 : 6) - cx, it.y + 3 - cy);
      sprC(ctx, ITEMS[it.type].sprite, it.x - cx, it.y - cy + bob);
    }
    if (this.mode === 'island') {
      for (const g of this.gifts) {
        spr(ctx, 'shadow', g.x - 6 - cx, g.y + 3 - cy);
        sprC(ctx, ITEMS[g.type].sprite, g.x - cx, g.y - cy + Math.round(Math.sin(this.time * 2.4 + g.x) * 0.8));
        const ph = (this.time * 0.8 + g.x * 0.01) % 1;
        if (ph < 0.25) sprC(ctx, `fx_sparkle${Math.min(3, (ph / 0.0625) | 0)}`, g.x - cx + 4, g.y - cy - 6);
      }
    }
    // water
    if (this.quality >= 1 || (this.water.frame & 1) === 0 || this.waterDirty !== this.waterLevel) {
      this.water.resize(bw, bh);
      this.water.render(m, this.waterLevel, this.time, cx, cy);
      this.waterDirty = this.waterLevel;
    }
    ctx.drawImage(this.water.canvas, 0, 0);
    // glints on items above water
    for (const it of this.items) {
      if (it.state !== 'idle' || it.hidden || !this.onScreen(it.x, it.y)) continue;
      const ph = (this.time * 0.7 + it.phase / 6.28) % 1;
      if (ph < 0.22) sprC(ctx, `fx_sparkle${Math.min(3, (ph / 0.055) | 0)}`, it.x - cx + 4, it.y - cy - 5);
    }
    for (const it of this.items) {
      if (it.state === 'float') sprC(ctx, ITEMS[it.type].sprite, it.x - cx, it.y - cy + Math.sin(it.float * 4) * 1.2, false, it.alpha * 0.85);
    }
    this.fx.drawParts(ctx, cx, cy, false);
    this.drawBoardwalk(ctx, cx, cy);
    if (this.level.fog && !this.up.light && this.mode === 'run') this.drawFog(ctx, cx, cy);
    if (this.litPath && this.state === 'play') {
      for (let i = 1; i < this.litPath.length; i += 2) {
        const [lx, ly] = this.litPath[i];
        const ph = (this.time * 3 - i * 0.35) % 2;
        if (ph < 1.2) sprC(ctx, ph < 0.6 ? 'fx_sparkle1' : 'fx_sparkle3', lx - cx, ly - cy, false, 0.85);
      }
    }
    // y-sorted objects
    const objs = [];
    this.collectBuildings(objs);
    for (const pr of ISLAND.props) objs.push({ y: this.islandTop + pr.y, draw: () => sprB(ctx, pr.s, pr.x - cx, this.islandTop + pr.y - cy) });
    for (const v of this.villagers) objs.push({ y: v.y, draw: () => this.drawVillager(ctx, v, cx, cy) });
    const p = this.player;
    objs.push({ y: p.y, draw: () => p.draw(ctx, cx, cy, m.st.capacity, this.waterLevel) });
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.draw();
    this.fx.drawParts(ctx, cx, cy, true);
    this.fx.drawFlyers(ctx, cx, cy);
    this.fx.drawFloaters(ctx, cx, cy, drawPixelText);
    this.drawJoystick(ctx);
  }

  drawFog(ctx, cx, cy) {
    if (!this.fogTile) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const x = hash2(i, 1, 71) * 64, y = hash2(i, 2, 71) * 64, r = 6 + hash2(i, 3, 71) * 12;
        for (const [ox, oy] of [[0, 0], [64, 0], [-64, 0], [0, 64], [0, -64]]) {
          g.fillStyle = 'rgba(236,244,246,0.16)';
          g.fillRect(Math.round(x - r + ox), Math.round(y - r * 0.6 + oy), Math.round(r * 2), Math.round(r * 1.2));
        }
      }
      this.fogTile = c;
    }
    const fy = this.level.fog * T;
    const off = (this.time * 4) % 64;
    for (let y = Math.floor((cy) / 64) * 64; y < Math.min(fy, cy + screen.bh); y += 64) {
      for (let x = -64; x < screen.bw + 64; x += 64) {
        const a = clamp((fy - y) / 64, 0.25, 1);
        ctx.globalAlpha = a;
        ctx.drawImage(this.fogTile, Math.round(x - (cx % 64) + off - 64), Math.round(y - cy));
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBoardwalk(ctx, cx, cy) {
    let len = this.m.st.boardLen;
    if (this.boardAnim) len = Math.round(this.boardAnim.from + (len - this.boardAnim.from) * clamp(this.boardAnim.t / 1.2, 0, 1));
    if (!len) return;
    const col = BAL.boardwalk.column;
    const x = col * T - cx;
    for (let k = 0; k < len + 1; k++) {
      const y = this.islandTop + T - (k + 1) * T;
      if (y - cy > screen.bh || y - cy < -T) continue;
      spr(ctx, k === len ? 'board_end' : 'board_mid', x, y - cy);
      if (k % 2 === 0 && k < len) {
        spr(ctx, 'board_post', x - 2, y - cy + 10);
        spr(ctx, 'board_post', x + T - 2, y - cy + 10);
      }
      const ti = Math.floor((y + 8) / T) * this.m.W + col;
      const be = this.m.boardEl[ti];
      if (be && this.waterLevel > be - 0.6) {
        const d = this.waterLevel - be;
        ctx.globalAlpha = clamp(0.35 + d * 0.08, 0.35, 0.8);
        ctx.fillStyle = '#62bccb';
        ctx.fillRect(x, y - cy, T, T);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f4fffb';
        const wob = Math.round(Math.sin(this.time * 3 + k) * 2);
        ctx.fillRect(x + 2 + wob, y - cy + 4, 5, 1);
        ctx.fillRect(x + 8 - wob, y - cy + 11, 5, 1);
      }
    }
  }

  collectBuildings(objs) {
    const b = this.save.buildings;
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    const ctx = screen.ctx;
    const plots = this.save.plots || {};
    for (const id of BUILD.order) {
      const def = BUILD.list[id];
      const lv = b[id] || 0;
      const [ax, ay] = def.anchor;
      const y = def.flats ? ay : this.islandTop + ay;
      const anim = this.building && this.building.id === id ? this.building : null;
      if (id === 'boardwalk') {
        if (plots[id] && this.mode === 'island') objs.push({ y: y + 1, draw: () => this.drawSign(ctx, ax + 16, y, cx, cy, id) });
        continue;
      }
      if (lv && def.sprite) {
        const sp = def.sprite[lv - 1];
        if (anim) {
          const k = clamp(anim.t / anim.dur, 0, 1);
          objs.push({ y, draw: () => {
            if (anim.level > 1) sprB(ctx, def.sprite[anim.level - 2], ax - cx, y - cy, false, 1 - k);
            sprPart(ctx, sp, ax - cx, y - cy, easeOut(k));
          } });
        } else {
          objs.push({ y, draw: () => sprB(ctx, sp, ax - cx, y - cy) });
        }
        if (id === 'lighthouse' && lv >= 1) objs.push({ y: y + 100, draw: () => this.drawBeam(ctx, ax - cx, y - cy - 58) });
        if (id === 'stilt' && this.mode === 'run') objs.push({ y: y + 2, draw: () => sprB(ctx, 'rowboat', ax + 22 - cx, y + 6 - cy) });
      }
      if (plots[id] && this.mode === 'island' && !def.flats) {
        const sx = lv ? ax + 14 : ax;
        objs.push({ y: y + 2, draw: () => this.drawSign(ctx, sx, y + (lv ? 4 : 0), cx, cy, id) });
      }
    }
    // decorations
    const deco = this.save.decor || [];
    deco.forEach((d, i) => {
      const slot = BUILD.decor.slots[i];
      if (!slot) return;
      const y = this.islandTop + slot[1];
      const sp = BUILD.decor.catalog[d].sprite;
      objs.push({ y, draw: () => sprB(ctx, sp, slot[0] - cx, y - cy) });
    });
  }

  drawSign(ctx, x, y, cx, cy, id) {
    const bob = Math.round(Math.sin(this.time * 3) * 1);
    sprB(ctx, 'plot_sign', x - cx, y - cy);
    const can = this.hooks.canBuild && this.hooks.canBuild(id);
    if (can) sprB(ctx, 'fx_alert', x - cx, y - cy - 20 + bob);
  }

  drawBeam(ctx, x, y) {
    const a = 0.12 + 0.06 * Math.sin(this.time * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff6c8';
    const dir = Math.sin(this.time * 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 60 - 10, y - 90);
    ctx.lineTo(x + dir * 60 + 18, y - 90);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawVillager(ctx, v, cx, cy) {
    const x = v.x - cx, y = v.y - cy;
    if (v.kind === 'cat') {
      const f = v.moving ? `cat_walk${(v.anim | 0) % 2}` : `cat_sit${((v.anim / 3) | 0) % 2}`;
      spr(ctx, 'shadow', x - 6, y - 2);
      sprB(ctx, f, x, y, v.moving ? v.flip : false);
      return;
    }
    spr(ctx, 'shadow', x - 6, y - 2);
    sprB(ctx, `${v.kind}${((v.anim) | 0) % 2}`, x, y, v.flip);
  }

  drawJoystick(ctx) {
    if (!input.active || this.mode !== 'run' || (this.state !== 'play' && this.state !== 'ready')) return;
    const k = screen.bw / screen.cssW;
    const ox = input.ox * k, oy = input.oy * k;
    ctx.globalAlpha = 0.45;
    sprC(ctx, 'joy_ring', ox, oy);
    ctx.globalAlpha = 0.9;
    const R = 13;
    sprC(ctx, 'joy_knob', ox + input.vx * R, oy + input.vy * R);
    ctx.globalAlpha = 1;
  }
}

// tiny bitmap text: digits, + and x (sprites g_*)
export function drawPixelText(ctx, text, x, y, color, alpha = 1, icon = null) {
  const suffix = color === 'gold' ? '_gold' : color === 'teal' ? '_teal' : '';
  const glyphs = [];
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') glyphs.push('g_' + ch + suffix);
    else if (ch === '+') glyphs.push('g_plus' + suffix);
    else if (ch === 'x') glyphs.push('g_x' + suffix);
    else if (ch === '!') glyphs.push('g_bang' + suffix);
    else if (ch === 'm') glyphs.push('g_m' + suffix);
  }
  let w = glyphs.length * 4 + 1 + (icon ? 12 : 0);
  let px = Math.round(x - w / 2);
  if (icon) { sprC(ctx, icon, px + 5, y + 2, false, alpha); px += 12; }
  for (const g of glyphs) { spr(ctx, g, px, Math.round(y), false, alpha); px += 4; }
}
