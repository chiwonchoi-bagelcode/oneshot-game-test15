// Game controller: island <-> run flow, results, building, daily systems, settings.
import BAL from '../data/balance.json';
import ITEMS from '../data/items.json';
import BUILD from '../data/buildings.json';
import { World } from './world.js';
import { makeDailyLevel } from './daily.js';
import { T, clamp } from './model.js';
import { input } from '../core/input.js';
import { screen } from '../core/screen.js';
import { Screens } from '../ui/screens.js';
import { t, setLang, i18n } from '../ui/i18n.js';
import { setUiSound } from '../ui/sfxhook.js';
import { loadSave, writeSave, clearSave, freshSave } from '../meta/save.js';
import * as eco from '../meta/economy.js';
import { play, setMusic, setLayer, setVolumes, setAmbience, unlockAudio } from '../audio/audio.js';
import { buzz, setHaptics } from '../audio/haptics.js';
import { track } from '../platform/analytics.js';
import { auth } from '../platform/account.js';

export class App {
  constructor(root) {
    this.root = root;
    this.save = loadSave();
    // level-editor test play: a throwaway save with the editor's upgrades
    try {
      if (new URLSearchParams(location.search).get('test')) {
        const data = JSON.parse(localStorage.getItem('lowtide.editor.test') || 'null');
        if (data && data.level) {
          this.test = data;
          const keep = this.save.settings;
          this.save = freshSave();
          this.save.settings = keep;
          const u = data.up || {};
          Object.assign(this.save.buildings, { boardwalk: u.boardwalk || 0, cottage: u.bag || 0, shed: u.sled || 0, lighthouse: u.light || 0, stilt: u.stilt || 0 });
          this.save.tutorial.done = true;
          this.save.stats.runs = 5;
        }
      }
    } catch (_) { this.test = null; }
    setLang(this.save.settings.lang);
    setHaptics(this.save.settings.vibrate);
    setVolumes(this.save.settings.music, this.save.settings.sfx);
    this.world = new World({ event: (n, d) => this.onWorld(n, d), canBuild: (id) => eco.canBuildNow(this.save, id) });
    this.ui = new Screens(this, root);
    setUiSound((k) => this.sfx(k === 'tap' ? 'ui_tap' : k, { vol: 0.7 }));
    this.levelN = clamp(this.save.current || 1, 1, eco.levelCount());
    this.isDaily = false;
    this.paused = false;
    this.mode = 'boot';
    this.sessionStart = Date.now();
    this.runsThisSession = 0;
    this.gifts = [];
    this.preUpdate = [];
    this.applyQuality();
  }

  track(name, p) { track(name, p); }
  sfx(name, opts) { return play(name, opts); }
  buzz(kind) { buzz(kind); }
  persist(now) { if (this.test) return; this.save.current = this.levelN; writeSave(this.save, now); }

  // ---------- boot ----------
  async boot() {
    await auth.signIn(this.save.installId);
    eco.refreshPlots(this.save);
    const ev = eco.dailyRefresh(this.save, track);
    if (this.save.newInstall) {
      track('first_open', { install_id: this.save.installId, lang: i18n.lang, screen: `${screen.cssW}x${screen.cssH}` });
      this.save.newInstall = false;
    }
    track('session_start', { day_index: this.save.streak.days, streak: this.save.streak.count, cleared: eco.clearedCount(this.save) });
    this.loadLevel();
    this.world.enterIsland();
    this.placeGifts();
    this.persist(true);
    if (this.test) {
      this.startRun();
    } else if (!this.save.tutorial.done && eco.clearedCount(this.save) === 0 && this.save.stats.runs === 0) {
      // first launch: the title floats over the island, then the tide simply goes out
      this.mode = 'title';
      this.ui.title(true);
      setTimeout(() => { this.ui.title(false); this.startRun(); }, 1700);
    } else {
      this.toIsland(true);
      if (ev.gift && this.save.daily.gift.length) setTimeout(() => this.ui.toast(t('home.gift'), 2200, true), 600);
      else if (ev.newDay && this.save.streak.count > 1) setTimeout(() => this.ui.toast(t('home.streak', { n: this.save.streak.count }), 2000, true), 600);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.persist(true);
        track('session_end', { seconds: Math.round((Date.now() - this.sessionStart) / 1000), runs: this.runsThisSession, last_screen: this.mode });
        if (this.mode === 'run' && this.world.state === 'play' && !this.paused) this.pause();
      } else {
        // coming back on a new day refreshes daily systems
        const ev2 = eco.dailyRefresh(this.save, track);
        if ((ev2.gift || ev2.newDay) && this.mode === 'island') { this.placeGifts(); this.ui.refreshHome(); if (ev2.gift) this.ui.toast(t('home.gift'), 2200, true); }
        this.sessionStart = Date.now();
      }
    });
  }

  loadLevel() {
    const lv = this.test ? this.test.level : this.isDaily ? this.dailyLevel() : eco.levelById(this.levelN);
    this.currentLevel = lv;
    this.world.setAssist(this.assistNext ? BAL.assist.tideBonus : 0);
    this.world.load(lv, eco.upgradesFrom(this.save), this.save);
  }

  dailyLevel() {
    if (!this._daily || this._daily.day !== this.save.daily.day) this._daily = makeDailyLevel(this.save.daily.day, this.save);
    return this._daily;
  }

  // ---------- island ----------
  toIsland(first = false) {
    this.mode = 'island';
    this.paused = false;
    this.ui.hideResults();
    this.ui.hideHud();
    this.ui.dragHint(false);
    if (this.isDaily) { this.isDaily = false; }
    this.assistNext = false;
    this.loadLevel();
    this.world.resetFlags();
    this.world.keepPlayerPos = !first && this.world.player && this.world.m.isSafe(this.world.player.x, this.world.player.y);
    this.world.enterIsland();
    this.placeGifts();
    this.ui.showHome();
    setMusic(['island']);
    setAmbience('waves', 0.5);
    track('screen_view', { screen: 'island' });
  }

  placeGifts() {
    const g = this.save.daily.giftTaken ? [] : (this.save.daily.gift || []);
    // spread over the middle of the top beach, clear of the side buttons on either edge
    this.world.gifts = g.map((type, i) => ({ type, x: 58 + ((i * 23) % 84), y: this.world.islandTop + 6 + (i % 3) * 7 }));
  }

  onGo() {
    const st = eco.levelState(this.save, this.levelN);
    if (st.state === 'needs') {
      const k = st.miss[0][0];
      const id = { boardwalk: 'boardwalk', bag: 'cottage', sled: 'shed', light: 'lighthouse', stilt: 'stilt' }[k];
      this.ui.openBuilding(id);
      return;
    }
    if (st.state === 'locked') { this.levelN = this.save.unlocked; this.ui.refreshHome(); return; }
    this.startRun();
  }

  selectLevel(n) {
    this.levelN = n;
    this.persist();
    this.loadLevel();
    this.world.enterIsland();
    this.placeGifts();
    this.ui.refreshHome();
  }

  startDaily() {
    this.isDaily = true;
    this.startRun();
  }

  // ---------- run ----------
  startRun() {
    unlockAudio();
    this.mode = 'run';
    this.paused = false;
    this.ui.hideHome();
    this.ui.hideResults();
    this.ui.closeAll();
    this.ui.clearToasts();
    this.pulseGo = false;
    const titleFading = !!this.ui.titleEl;
    this.loadLevel();
    this.world.resetFlags();
    this.world.startRun();
    const lv = this.currentLevel;
    this.ui.showHud(lv, this.isDaily);
    // on the very first launch the title is still fading: show the goal card right after it
    if (titleFading) this.ui.later(() => this.ui.levelCard(lv, this.isDaily, !!this.assistNext), 600);
    else this.ui.levelCard(lv, this.isDaily, !!this.assistNext);
    this.runCounts = {};
    this.runAttempt = this.isDaily ? 1 : eco.levelRecord(this.save, this.levelN).attempts + 1;
    setMusic(['run_base', 'run_tension']);
    setAmbience('waves', 0.8);
    this.sfx('tide_out', { vol: 0.8 });
    this.lastHeart = 0;
    this.warned = false;
    track('screen_view', { screen: 'run' });
  }

  retry(assist) {
    this.assistNext = !!assist;
    if (assist) track('assist_used', { level: this.levelN });
    this.startRun();
    this.assistNext = false;
  }

  nextLevel() {
    if (this.levelN < eco.levelCount()) this.levelN++;
    this.persist();
    this.startRun();
  }

  pause() {
    if (this.mode !== 'run' || this.paused || !(this.world.state === 'play' || this.world.state === 'ready')) return;
    this.paused = true;
    this.ui.openPause();
  }
  resume() { this.paused = false; }
  giveUp() {
    this.paused = false;
    if (this.world.state === 'play' || this.world.state === 'ready') {
      if (!this.world.player.bag.length) return this.toIsland();
      this.world.beginSwept();
    } else this.toIsland();
  }

  onPopup(open) { this.popupOpen = open; input.enabled = !open; }

  onWorld(name, d) {
    const w = this.world;
    switch (name) {
      case 'run_ready':
        if (this.save.stats.runs < 2) this.ui.dragHint(true);
        if (!this.save.tutorial.seen.move) { this.save.tutorial.seen.move = 1; track('tutorial_step', { step: 'move' }); }
        break;
      case 'run_start':
        this.ui.dragHint(false);
        track('run_start', { level: this.isDaily ? 'daily' : this.levelN, attempt: this.runAttempt, assist: w.assist ? 1 : 0, bag_lv: this.save.buildings.cottage, board_lv: this.save.buildings.boardwalk });
        break;
      case 'pick': {
        this.runCounts[d.type] = (this.runCounts[d.type] || 0) + 1;
        const semis = Math.min(12, (d.combo - 1) * 2);
        const rate = Math.pow(2, semis / 12) * (0.98 + Math.random() * 0.04);
        this.sfx(ITEMS[d.type].sfx, { rate, vol: 0.9 });
        if (d.combo >= 3) this.sfx('combo', { rate: Math.pow(2, Math.min(9, d.combo - 3) / 12), vol: 0.35 });
        this.buzz(ITEMS[d.type].weight >= 4 ? 'pick_heavy' : d.combo >= 3 ? 'combo' : 'tick');
        this.ui.updateGoals(this.runCounts);
        if (d.fill >= 0.6 && !this.heavyShown) { this.heavyShown = true; this.sfx('bag_heavy', { vol: 0.6 }); }
        break;
      }
      case 'bag_full':
        this.sfx('bag_full', { vol: 0.8 });
        this.buzz('full');
        this.ui.toast(t('run.full'), 1000, true);
        break;
      case 'item_float': this.sfx('bloop', { vol: 0.35, rate: 0.9 + Math.random() * 0.2 }); break;
      case 'step': {
        const k = d.kind === 'water' ? 'step_water' : d.kind === 'board' ? 'step_board' : d.kind === 'mud' ? 'step_mud' : 'step_sand';
        this.sfx(k, { vol: 0.32 + d.fill * 0.25, rate: (0.92 + Math.random() * 0.12) * (1 - d.fill * 0.12) });
        if (d.kind === 'water') this.buzz('wet');
        break;
      }
      case 'tick': this.onTick(d); break;
      case 'turn_back':
        this.sfx('bell', { vol: 0.9 });
        this.buzz('bell');
        this.ui.toast(d.late ? t('run.hurry') : t('run.bell'), 1800, true);
        track('bell_rung', { level: this.levelN, slack: Math.round(d.slack * 10) / 10 });
        break;
      case 'arrive':
        setLayer(1, 0, 0.3);
        this.sfx('wave_crash', { vol: d.closeCall ? 1 : 0.6 });
        this.sfx(d.closeCall ? 'arrive_close' : 'arrive', { vol: 0.95 });
        this.buzz(d.closeCall ? 'close_call' : 'arrive');
        this.ui.hideHud();
        if (d.closeCall) setTimeout(() => this.ui.toast(t('res.close_call'), 900), 120);
        break;
      case 'pour':
        if (!d.quiet) this.sfx('pour', { rate: Math.pow(2, Math.min(14, d.i) / 14), vol: 0.55 });
        if (!d.quiet && d.i % 3 === 0) this.buzz('tick');
        break;
      case 'arrive_done': this.finishRun(d); break;
      case 'swept':
        setLayer(1, 0, 0.2);
        this.sfx('swept', { vol: 1 });
        this.buzz('swept');
        this.ui.hideHud();
        break;
      case 'wipe': this.ui.wipe(); this.sfx('wash', { vol: 0.8 }); break;
      case 'washed': break;
      case 'boat': this.ui.wipe(); this.sfx('wash', { vol: 0.6 }); this.sfx('bell', { vol: 0.5, rate: 1.4 }); break;
      case 'reveal': this.sfx('star', { vol: 0.35, rate: 1.3 }); break;
      case 'shake_off': this.sfx('shake_off', { vol: 0.7 }); this.sfx('sigh', { vol: 0.6 }); break;
      case 'swept_done': this.finishRun(d); break;
      default: break;
    }
  }

  onTick(d) {
    const w = this.world;
    const frac = w.state === 'play' ? w.tide.fraction(w.runT) : 0;
    this.ui.updateTide(frac, frac > 0.8 || d.danger > 0.05);
    this.ui.updateBag(w.player.weight, w.m.st.capacity);
    this.ui.setDanger(d.danger);
    const below = w.islandTop - (w.camY + screen.bh);
    const dist = Math.max(0, Math.round((w.islandTop - w.player.y) / T));
    this.ui.updateArrow(below > -8 && dist > 2 && w.state === 'play', dist, d.danger > 0 || w.slack < 4);
    // music tension follows the tide and the danger
    const tension = clamp((frac - 0.45) / 0.4, 0, 1) * 0.8 + d.danger * 0.6;
    setLayer(1, clamp(tension, 0, 1), 0.6);
    // heartbeat when the water is at your feet
    const now = performance.now();
    if (d.danger > 0.08 && now - this.lastHeart > 900 - d.danger * 450) {
      this.lastHeart = now;
      this.buzz('heartbeat');
      this.sfx('heartbeat', { vol: 0.25 + d.danger * 0.5 });
    }
    if (!this.warned && w.state === 'play' && frac > 0.5 && w.player.bag.length && (this.currentLevel.hintReturn || this.save.stats.runs < 3)) {
      // first tides: a clear cue when the sea turns
      const near = w.slack < 6;
      if (near) { this.warned = true; this.ui.toast(t('run.tide_coming'), 1500); this.sfx('tide_turn', { vol: 0.7 }); }
    }
  }

  finishRun(res) {
    this.runsThisSession++;
    const lv = this.currentLevel;
    const sum = eco.applyRun(this.save, this.levelN, res, track, { daily: this.isDaily, levelData: lv });
    track('run_end', {
      level: this.isDaily ? 'daily' : this.levelN, result: res.success ? 'returned' : 'swept', seconds: Math.round(res.time),
      tide_pct: Math.round(res.tideFraction * 100), items: Object.values(res.counts).reduce((a, b) => a + b, 0),
      weight: this.world.player.weight, furthest: res.furthest, close_call: res.closeCall ? 1 : 0,
      cause: res.success ? (sum.bits & 1 ? 'clear' : 'goal_short') : (res.analysis ? res.analysis.kind : 'none'),
    });
    // tutorial guarantee: the first building always stands right after the first tide
    let toppedUp = false;
    if (!this.save.tutorial.firstBuild && !this.save.buildings.boardwalk) {
      const nb = eco.nextBuild(this.save, 'boardwalk');
      const miss = eco.missing(this.save, nb.cost);
      if (Object.keys(miss).length) { eco.grant(this.save, miss, 'tutorial_topup', track); toppedUp = true; }
    }
    if (!this.save.tutorial.done) { this.save.tutorial.done = true; track('tutorial_complete', { seconds_since_install: Math.round((Date.now() - this.save.firstOpen) / 1000) }); }
    const buildable = eco.anyBuildable(this.save);
    this.persist(true);
    this.mode = 'results';
    if (res.success) setMusic(['island'], 1.5);
    this.sfx(res.success ? 'results' : 'results_soft', { vol: 0.8 });
    this.ui.showResults(res, sum, { level: lv, daily: this.isDaily, buildable, toppedUp });
    track('screen_view', { screen: 'results' });
  }

  // ---------- building ----------
  buildFromResults(id) {
    this.toIsland();
    setTimeout(() => this.build(id), 250);
  }

  build(id) {
    const prevBoard = this.save.buildings.boardwalk;
    const lv = eco.doBuild(this.save, id, track);
    if (!lv) return;
    if (id === 'boardwalk') this.save.tutorial.firstBuild = true;
    this.persist(true);
    // rebuild the world with the new upgrades and play the construction
    this.loadLevel();
    this.world.setupVillagers();
    const pos = this.world.playBuild(id, lv);
    if (id === 'boardwalk') this.world.boardAnim = { from: [0, 12, 28, 43][prevBoard], t: 0 };
    this.sfx('build', { vol: 0.9 });
    this.buzz('build');
    this.ui.hideHome();
    // the reveal finishes on its own, or at once on a tap
    const finish = () => {
      if (this.buildFinish !== finish) return;
      this.buildFinish = null;
      clearTimeout(timer);
      if (this.world.boardAnim) this.world.boardAnim.t = 99;
      this.sfx('fanfare', { vol: 0.9 });
      this.world.fx.burst(pos.x, (BUILD.list[id].flats ? 0 : this.world.islandTop) + BUILD.list[id].anchor[1] - 16, 26, { speed: 70, life: 1, gravity: 90, sprites: ['fx_petal0', 'fx_petal1', 'fx_petal2', 'fx_petal3', 'fx_petal4'] });
      this.ui.toast(t('b.done_title', { b: t('b.' + id) }) + '\n' + t('b.next_run'), 2200);
      const vk = BUILD.list[id].villager;
      if (vk && lv === 1) this.ui.later(() => { if (this.mode === 'island') this.ui.toast(t('v.' + vk), 1800, true); }, 2300);
      this.ui.showHome();
      // nudge toward the next tide once the first building stands
      this.pulseGo = true;
      const st = eco.levelState(this.save, this.levelN);
      if (st.state === 'cleared' && this.levelN < this.save.unlocked) { this.levelN = this.save.unlocked; this.persist(); this.loadLevel(); this.world.enterIsland(); }
      this.ui.refreshHome();
    };
    this.buildFinish = finish;
    const timer = setTimeout(finish, 1700);
  }

  placeDecor(k) {
    if (!eco.buildDecor(this.save, k, track)) return;
    this.persist(true);
    this.sfx('build', { vol: 0.6, rate: 1.2 });
    this.buzz('ui');
    const i = this.save.decor.length - 1;
    const slot = BUILD.decor.slots[i];
    this.world.fx.burst(slot[0], this.world.islandTop + slot[1] - 8, 12, { speed: 50, life: 0.7, gravity: 90, sprites: ['fx_petal0', 'fx_petal1', 'fx_petal3'] });
    this.ui.refreshHome();
  }

  fulfil(i) {
    if (eco.fulfilRequest(this.save, i, track)) {
      this.sfx('star', { vol: 0.8 });
      this.buzz('ui');
      this.persist(true);
    }
  }

  collectGift(g) {
    const i = this.world.gifts.indexOf(g);
    if (i < 0) return;
    this.world.gifts.splice(i, 1);
    eco.grant(this.save, { [g.type]: 1 }, 'daily_gift', track);
    this.world.fx.fly(ITEMS[g.type].sprite, g.x, g.y, { x: g.x, y: g.y - 30 }, 0.4);
    this.world.fx.floater(g.x, g.y, null, '+1');
    this.sfx(ITEMS[g.type].sfx, { vol: 0.9 });
    this.buzz('tick');
    if (!this.world.gifts.length) {
      this.save.daily.giftTaken = true;
      track('daily_gift', { streak: this.save.streak.count, items: this.save.daily.gift.length });
    }
    this.persist();
    this.ui.refreshHome();
  }

  // world taps in island mode: plots and gifts
  onTap(cx, cy) {
    if (this.buildFinish) { this.buildFinish(); return; }
    if (this.mode !== 'island' || this.popupOpen) {
      if (this.mode === 'run' && (this.world.state === 'arrive' || this.world.state === 'swept')) this.world.hurry();
      if (this.mode === 'run' && this.world.state === 'intro') this.world.skipIntro();
      return;
    }
    const k = screen.bw / screen.cssW;
    const wx = cx * k + this.world.camX, wy = cy * k + this.world.camY;
    for (const g of this.world.gifts) if (Math.hypot(g.x - wx, g.y - wy) < 16) return this.collectGift(g);
    const id = this.world.pick(wx, wy);
    if (id) this.ui.openBuilding(id);
  }

  // ---------- settings ----------
  setSetting(k, v) {
    const st = this.save.settings;
    st[k] = v;
    if (k === 'music' || k === 'sfx') setVolumes(st.music, st.sfx);
    if (k === 'vibrate') { setHaptics(v); if (v) this.buzz('pick_heavy'); }
    if (k === 'lang') { setLang(v); this.ui.closeAll(); this.ui.relabel(); this.ui.openSettings(); }
    if (k === 'quality') this.applyQuality();
    this.persist();
    track('settings_change', { key: k, value: String(v) });
  }

  applyQuality() {
    const low = this.save.settings.quality === 'low' || this.autoLow;
    this.world.quality = low ? 0.5 : 1;
    this.world.fx.quality = low ? 0.5 : 1;
    this.targetFps = this.save.settings.quality === 'low' ? 30 : 60;
  }

  // frame rate couldn't keep up: lighter water and particles for the rest of the session (setting unchanged)
  lighten(fps) {
    this.autoLow = true;
    this.applyQuality();
    track('perf_downgrade', { fps });
  }

  resetAll() {
    clearSave();
    this.save = freshSave();
    eco.refreshPlots(this.save);
    eco.dailyRefresh(this.save, track);
    this.levelN = 1;
    this.persist(true);
    location.reload();
  }

  // ---------- per frame ----------
  update(dt) {
    if (this.paused) return;
    for (const f of this.preUpdate) f(dt);
    this.world.update(dt);
    if (this.mode === 'island') {
      // gifts picked up by walking over them
      const p = this.world.player;
      for (const g of this.world.gifts.slice()) if (Math.hypot(g.x - p.x, g.y - (p.y - 4)) < 11) this.collectGift(g);
    }
    if (this.world.boardAnim) {
      this.world.boardAnim.t += dt;
      if (this.world.boardAnim.t > 1.4) this.world.boardAnim = null;
    }
  }

  render(ctx) {
    this.world.render(ctx);
  }
}
