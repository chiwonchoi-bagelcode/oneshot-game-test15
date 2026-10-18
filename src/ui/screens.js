// All DOM screens. Built once and updated in place so nothing pops in late.
import BAL from '../data/balance.json';
import ITEMS from '../data/items.json';
import BUILD from '../data/buildings.json';
import COLL from '../data/collection.json';
import { h, icon, iconStyle, btn, onTap, clear, busy } from './dom.js';
import { t, i18n, itemCount, joinItems } from './i18n.js';
import { screen } from '../core/screen.js';
import { frame, assets } from '../core/assets.js';
import { T } from '../game/model.js';
import {
  MATS, nextBuild, canAfford, canBuildNow, buildingLevel, levelState, levelById, levelCount, starCount,
  clearedCount, decorUnlocked, decorCost, decorSlotsLeft, totalStars, plotAvailable, collectionUnlocked,
  calendarUnlocked, dailyTideUnlocked, requirementsMet,
} from '../meta/economy.js';

const BNAME = (id) => t('b.' + id);
// effect text filled from the balance data so numbers never drift from the game
function bdesc(id, lv) {
  const cap = BAL.bag.capacity, mud = BAL.sled.mud, len = BAL.boardwalk.length;
  const v = {
    boardwalk: { len: len[lv], fast: Math.round((BAL.move.board - 1) * 100) },
    cottage: { a: cap[lv - 1], b: cap[lv] },
    shed: { a: Math.round(mud[lv - 1] * 100), b: Math.round(mud[lv] * 100) },
  }[id] || {};
  return t(`b.${id}.${lv}`, v);
}
// what a finished building does right now
function bnow(id, lv) {
  const v = { len: BAL.boardwalk.length[lv], fast: Math.round((BAL.move.board - 1) * 100), b: id === 'cottage' ? BAL.bag.capacity[lv] : Math.round(BAL.sled.mud[lv] * 100) };
  return id === 'lighthouse' && lv >= 2 ? t('b.now.lighthouse.2', v) : t('b.now.' + id, v);
}
const REQ_NAME = { boardwalk: 'boardwalk', bag: 'cottage', sled: 'shed', light: 'lighthouse', stilt: 'stilt', requests: 'haenyeo' };

export class Screens {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.layers = {};
    for (const n of ['hud', 'home', 'fx', 'results', 'popup']) {
      const el = h('div', { class: 'layer', id: 'L-' + n });
      root.appendChild(el);
      this.layers[n] = el;
    }
    this.vignette = h('div', { id: 'vignette' });
    this.wipeEl = h('div', { id: 'wipe' });
    root.insertBefore(this.vignette, this.layers.hud);
    root.appendChild(this.wipeEl);
    this.popupStack = [];
    this.buildHud();
    this.buildHome();
  }

  // ---------- run HUD ----------
  buildHud() {
    const L = this.layers.hud;
    this.hudGoals = h('div', { class: 'chips' });
    this.tideFill = h('div', { class: 'fill' });
    this.tideWave = icon('wave', 24, 'wave');
    this.tideEl = h('div', { class: 'tide', role: 'img', 'aria-label': 'tide' }, this.tideFill, this.tideWave, icon('home', 24, 'home'));
    const pause = btn('', 'plain square', () => this.app.pause(), { icon: 'pause', iconSize: 24, aria: t('pause.title') });
    pause.style.width = '48px'; pause.style.height = '48px'; pause.style.minHeight = '48px';
    pause.style.borderWidth = '10px 10px 14px 10px'; pause.style.borderImageWidth = '10px 10px 14px 10px';
    this.pauseBtn = pause;
    this.hudTop = h('div', { class: 'topbar' }, this.hudGoals, this.tideEl, pause);
    this.bagMeter = h('i');
    this.bagText = h('span', { text: '0/10' });
    this.bagEl = h('div', { class: 'bagbar' }, icon('bag', 24), h('div', { class: 'meter' }, this.bagMeter), this.bagText);
    this.arrowTxt = h('span');
    const arr = h('div', { class: 'arr' });
    iconStyle(arr, 'arrow_home', 28);
    arr.style.width = '28px'; arr.style.height = '24px';
    this.homeArrow = h('div', { class: 'homearrow hidden' }, arr, this.arrowTxt);
    L.append(this.hudTop, this.bagEl, this.homeArrow);
    L.classList.add('hidden');
    this.hudCache = {};
  }

  showHud(level, isDaily) {
    const L = this.layers.hud;
    L.classList.remove('hidden');
    clear(this.hudGoals);
    this.goalChips = [];
    const goals = level.goals || [];
    if (goals[0]) {
      const g = goals[0];
      const num = h('span', { text: `0/${g.n}` });
      const chip = h('div', { class: 'chip' }, icon(g.t, 24), num);
      this.hudGoals.appendChild(chip);
      this.goalChips.push({ chip, num, g });
    }
    this.hudCache = {};
    this.updateBag(0, this.app.world.m.st.capacity);
    this.updateTide(0, false);
  }
  hideHud() { this.layers.hud.classList.add('hidden'); this.homeArrow.classList.add('hidden'); this.vignette.style.opacity = 0; }

  updateGoals(counts) {
    for (const c of this.goalChips || []) {
      const have = counts[c.g.t] || 0;
      const txt = `${Math.min(have, c.g.n)}/${c.g.n}`;
      if (c.num.textContent !== txt) {
        c.num.textContent = txt;
        c.chip.classList.remove('bump'); void c.chip.offsetWidth; c.chip.classList.add('bump');
        c.chip.classList.toggle('done', have >= c.g.n);
      }
    }
  }

  updateBag(weight, cap) {
    const f = Math.min(1, weight / cap);
    const key = weight + '/' + cap;
    if (this.hudCache.bag === key) return;
    this.hudCache.bag = key;
    this.bagMeter.style.width = (f * 100).toFixed(0) + '%';
    this.bagText.textContent = `${weight}/${cap}`;
    this.bagEl.classList.toggle('heavy', f >= 0.6 && f < 1);
    this.bagEl.classList.toggle('full', f >= 1);
  }

  updateTide(frac, hot) {
    const k = Math.round(frac * 200);
    if (this.hudCache.tide !== k) {
      this.hudCache.tide = k;
      const w = this.tideEl.clientWidth || 120;
      const x = 12 + frac * (w - 40);
      this.tideFill.style.width = x + 'px';
      this.tideWave.style.transform = `translateX(${x}px)`;
    }
    if (this.hudCache.hot !== hot) { this.hudCache.hot = hot; this.tideEl.classList.toggle('hot', hot); }
  }

  updateArrow(show, meters, urgent) {
    if (this.hudCache.arrowShow !== show) { this.hudCache.arrowShow = show; this.homeArrow.classList.toggle('hidden', !show); }
    if (!show) return;
    const txt = t('run.home_dist', { n: meters });
    if (this.arrowTxt.textContent !== txt) this.arrowTxt.textContent = txt;
    if (this.hudCache.urgent !== urgent) { this.hudCache.urgent = urgent; this.homeArrow.classList.toggle('urgent', urgent); }
  }

  setDanger(d) {
    const v = d <= 0 ? 0 : Math.min(0.85, 0.2 + d * 0.8);
    const k = Math.round(v * 20);
    if (this.hudCache.vig !== k) { this.hudCache.vig = k; this.vignette.style.opacity = (k / 20).toFixed(2); }
  }

  levelCard(level, isDaily, assist) {
    const L = this.layers.fx;
    const goals = (level.goals || []).map((g, i) => h('span', { class: 'goal' },
      i > 0 ? icon('star_empty', 16, 'star') : null, icon(g.t, 24), `${g.n}`));
    const card = h('div', { class: 'levelcard panel' },
      h('div', { class: 'n', text: isDaily ? t('home.daily') : t('home.tide_n', { n: level.n }) }),
      h('div', { class: 'name', text: isDaily ? t('daily.mod.' + level.mod) : t('level.' + level.id) }),
      h('div', { class: 'goals' }, ...goals),
      assist ? h('div', { class: 'n', style: { marginTop: '4px', color: '#2c638e' }, text: t('run.assist_on') }) : null);
    L.appendChild(card);
    setTimeout(() => { card.style.transition = 'opacity 0.3s'; card.style.opacity = '0'; }, 1900);
    setTimeout(() => card.remove(), 2300);
  }

  dragHint(on) {
    if (on && !this.drag) {
      this.drag = h('div', { class: 'draghint' }, h('div', { class: 'hand' }), h('div', { text: t('run.drag') }));
      this.layers.fx.appendChild(this.drag);
    } else if (!on && this.drag) { this.drag.remove(); this.drag = null; }
  }

  clearToasts() {
    for (const tm of this.toastTimers || []) clearTimeout(tm);
    this.toastTimers = [];
    if (this.toastEl) { this.toastEl.remove(); this.toastEl = null; }
  }

  later(fn, ms) {
    this.toastTimers = this.toastTimers || [];
    this.toastTimers.push(setTimeout(fn, ms));
  }

  toast(text, ms = 1500, small = false) {
    if (this.toastEl) this.toastEl.remove();
    const el = h('div', { class: 'toast' + (small ? ' small' : ''), text });
    this.layers.fx.appendChild(el);
    this.toastEl = el;
    setTimeout(() => { if (this.toastEl === el) { el.style.transition = 'opacity 0.25s'; el.style.opacity = '0'; } }, ms);
    setTimeout(() => { if (el.parentNode) el.remove(); }, ms + 300);
  }

  title(on) {
    if (on) {
      this.titleEl = h('div', { class: 'titlelogo' }, h('img', { src: 'assets/logo.png', alt: t('title') }));
      this.layers.fx.appendChild(this.titleEl);
    } else if (this.titleEl) {
      const el = this.titleEl;
      el.style.transition = 'opacity 0.5s'; el.style.opacity = '0';
      setTimeout(() => { el.remove(); if (this.titleEl === el) this.titleEl = null; }, 600);
    }
  }

  wipe() { this.wipeEl.classList.remove('on'); void this.wipeEl.offsetWidth; this.wipeEl.classList.add('on'); }

  // ---------- home (island) ----------
  buildHome() {
    const L = this.layers.home;
    this.matChips = {};
    const chips = h('div', { class: 'chips' });
    for (const m of MATS) {
      const n = h('span', { text: '0' });
      const c = h('div', { class: 'chip', title: t('mat.' + m) }, icon(m, screen.cssW < 380 ? 20 : 24), n);
      this.matChips[m] = { c, n };
      chips.appendChild(c);
    }
    const gear = btn('', 'plain square', () => this.openSettings(), { icon: 'gear', iconSize: 28, aria: t('home.settings') });
    gear.style.width = '48px'; gear.style.height = '48px'; gear.style.minHeight = '48px';
    gear.style.borderWidth = '10px 10px 14px 10px'; gear.style.borderImageWidth = '10px 10px 14px 10px';
    this.homeTop = h('div', { class: 'topbar' }, chips, gear);
    // side buttons
    const side = (ic, cap, fn) => {
      const b = btn('', 'plain square', fn, { icon: ic, iconSize: 32, aria: cap });
      const badge = h('span', { class: 'badge hidden', text: '!' });
      b.appendChild(badge);
      const wrap = h('div', { class: 'side-btn' }, b, h('span', { class: 'cap', text: cap }));
      wrap.badge = badge;
      wrap.capEl = wrap.lastChild;
      return wrap;
    };
    this.sbCal = side('calendar', t('home.calendar'), () => this.openCalendar());
    this.sbDaily = side('wave', t('home.daily'), () => this.openDaily());
    this.sbBook = side('book', t('home.book'), () => this.openBook());
    this.sbReq = side('letter', t('home.requests'), () => this.openRequests());
    this.sbDecor = side('flag', t('home.decor'), () => this.openDecor());
    this.sideL = h('div', { class: 'home-side left' }, this.sbCal, this.sbDaily);
    this.sideR = h('div', { class: 'home-side right' }, this.sbBook, this.sbReq, this.sbDecor);
    // next tide card + go
    this.ncN = h('span', { class: 'n' });
    this.ncName = h('span', { class: 'name' });
    this.ncGoals = h('div', { class: 'goals' });
    this.ncNote = h('div', { class: 'note hidden' });
    this.nextCard = h('div', { class: 'panel nextcard' }, h('div', { class: 'row1' }, this.ncName, this.ncN), this.ncGoals, this.ncNote);
    onTap(this.nextCard, () => { if (calendarUnlocked(this.app.save)) this.openCalendar(); }, { sound: 'tap' });
    this.goBtn = btn(t('home.go'), 'go big', () => this.app.onGo(), { icon: 'play', iconSize: 28 });
    this.homeBottom = h('div', { class: 'home-bottom' }, this.nextCard, this.goBtn);
    L.append(this.homeTop, this.sideL, this.sideR, this.homeBottom);
    L.classList.add('hidden');
  }

  showHome() {
    this.layers.home.classList.remove('hidden');
    this.refreshHome();
  }
  hideHome() { this.layers.home.classList.add('hidden'); }

  refreshHome() {
    const s = this.app.save;
    for (const m of MATS) {
      const v = String(s.mats[m] || 0);
      if (this.matChips[m].n.textContent !== v) this.matChips[m].n.textContent = v;
    }
    // side buttons appear step by step
    this.sbCal.classList.toggle('hidden', !calendarUnlocked(s));
    this.sbDaily.classList.toggle('hidden', !dailyTideUnlocked(s));
    this.sbDaily.badge.classList.toggle('hidden', s.daily.tideDone);
    this.sbBook.classList.toggle('hidden', !collectionUnlocked(s));
    this.sbReq.classList.toggle('hidden', !buildingLevel(s, 'haenyeo'));
    const reqOpen = (s.daily.requests || []).some((r) => !r.done && (s.mats[r.mat] || 0) >= r.n);
    this.sbReq.badge.classList.toggle('hidden', !reqOpen);
    this.sbDecor.classList.toggle('hidden', !decorUnlocked(s));
    // side columns sit just under the top bar, over the sea; the island stays clear
    const topH = (this.homeTop.offsetHeight || 48) + 6;
    this.sideL.style.top = topH + 'px';
    this.sideR.style.top = topH + 'px';
    // tell the camera how much of the screen the UI covers
    const k = screen.bw / screen.cssW;
    this.app.world.uiBottom = Math.round(((this.homeBottom.offsetHeight || 160) + 8) * k);
    // next tide card
    const n = this.app.levelN;
    const lv = levelById(n);
    const st = levelState(s, n);
    this.ncN.textContent = t('home.tide_n', { n });
    this.ncName.textContent = t('level.' + lv.id);
    clear(this.ncGoals);
    const rec = s.levels[lv.id];
    (lv.goals || []).forEach((g, i) => {
      const got = rec && (rec.stars >> i) & 1;
      this.ncGoals.appendChild(h('span', { class: 'goalpill' }, icon(got ? 'star' : 'star_empty', 16, 'st'), icon(g.t, 24), `${g.n}`));
    });
    const lbl = this.goBtn.querySelector('.lbl');
    this.goBtn.classList.remove('pulse');
    if (st.state === 'needs') {
      const [k, v] = st.miss[0];
      this.ncNote.textContent = t('home.needs', { b: BNAME(REQ_NAME[k]), lv: v });
      this.ncNote.classList.remove('hidden');
      lbl.textContent = t('home.build_first');
      this.goBtn.className = 'btn primary big';
    } else {
      this.ncNote.classList.add('hidden');
      lbl.textContent = t('home.go');
      this.goBtn.className = 'btn go big';
      if (this.app.pulseGo) this.goBtn.classList.add('pulse');
    }
  }

  // ---------- results ----------
  showResults(res, sum, ctx) {
    const L = this.layers.results;
    clear(L);
    const app = this.app;
    const s = app.save;
    const level = ctx.level;
    const kids = [];
    let stamp = null;
    if (res.success) {
      kids.push(h('h2', { text: res.byBoat ? t('res.by_boat') : t('res.made_it') }));
      if (res.closeCall) stamp = h('div', { class: 'stamp', text: t('res.close_call') });
    } else {
      kids.push(h('h2', { text: t('res.swept') }));
      kids.push(h('div', { class: 'sub', text: Object.keys(res.counts).length ? t('res.kept_half') : t('res.empty') }));
    }
    // goals -> stars
    const goals = level.goals || [];
    const starRow = h('div', { class: 'rstars' });
    const starEls = goals.map((g, i) => {
      const gs = sum.goalState[i];
      const have = gs ? gs.have : 0;
      const ic = icon('star_empty', 36);
      const el = h('div', { class: 'rstar' }, ic, h('div', { class: 'g' }, icon(g.t, 20), `${Math.min(have, g.n)}/${g.n}`));
      el.ic = ic; el.ok = gs && gs.ok; el.prev = ((s.levels[level.id] || {}).stars >> i) & 1 && !(sum.newBits >> i & 1);
      starRow.appendChild(el);
      return el;
    });
    if (goals.length) kids.push(starRow);
    // haul
    const counts = res.counts;
    const haul = h('div', { class: 'haul' });
    const haulEls = [];
    for (const k of Object.keys(ITEMS)) {
      if (!counts[k]) continue;
      const num = h('span', { text: '0' });
      haul.appendChild(h('div', { class: 'it' }, icon(k, 28), num));
      haulEls.push({ num, n: counts[k] });
    }
    const lostKinds = !res.success ? Object.keys(res.lostCounts) : [];
    if (lostKinds.length) {
      // swept: what you kept and what the sea took, side by side
      const lost = h('div', { class: 'haul lost' });
      for (const [k, v] of Object.entries(res.lostCounts)) lost.appendChild(h('div', { class: 'it' }, icon(k, 28), String(v)));
      // columns share the width by how many chips each holds, so neither wraps early
      kids.push(h('div', { class: 'haulpair' },
        h('div', { style: { flex: String(Math.max(1, haulEls.length)) } }, h('div', { class: 'rsec', text: t('res.got') }), haulEls.length ? haul : h('div', { class: 'sub', text: '-' })),
        h('div', { style: { flex: String(lostKinds.length) } }, h('div', { class: 'rsec', text: t('res.lost') }), lost)));
    } else if (haulEls.length) { kids.push(h('div', { class: 'rsec', text: t('res.got') })); kids.push(haul); }
    else if (res.success) kids.push(h('div', { class: 'sub', text: t('res.empty') }));
    // chests, treasures, letters
    for (const c of sum.chests) {
      const line = h('div', { class: 'chestline' }, icon('chest', 24), '→');
      for (const [k, v] of Object.entries(c.contents)) line.append(icon(k, 24), `${v} `);
      kids.push(line);
      if (c.treasure) kids.push(h('div', { class: 'sub', text: `${t('res.treasure')}: ${t('t.' + c.treasure)}` }));
    }
    for (const l of sum.letters) kids.push(h('div', { class: 'why' }, h('div', { class: 'rsec', style: { textAlign: 'left', marginTop: 0 }, text: t('res.letter') }), t('letter.' + l)));
    if (ctx.daily && sum.dailyReward) kids.push(h('div', { class: 'sub', text: t('res.daily_reward') }));
    if (sum.record) kids.push(h('div', { class: 'sub', text: t('res.new_record', { n: sum.furthest }) }));
    // why it went wrong + minimap
    if (!res.success && res.analysis) {
      const why = h('div', { class: 'why', text: this.whyText(res.analysis) });
      const mm = this.minimap(res);
      // a tall, narrow map sits beside the explanation so both fit on short phones
      if (mm && mm.narrow) kids.push(h('div', { class: 'whyrow' }, mm.el, h('div', { class: 'whycol' }, why, mm.key)));
      else { kids.push(why); if (mm) kids.push(mm.el, mm.key); }
      if (buildingLevel(s, 'haenyeo') && sum.fails >= 2) kids.push(h('div', { class: 'sub', text: t('res.granny_tip') }));
    }
    if (ctx.toppedUp) kids.push(h('div', { class: 'sub', text: t('res.topped_up') }));
    // build suggestion
    const bid = ctx.buildable;
    if (bid) {
      const nb = nextBuild(s, bid);
      const bb = btn(t('res.build_now'), 'primary pulse', () => app.buildFromResults(bid), { icon: 'hammer', iconSize: 24 });
      bb.style.minHeight = '48px'; bb.style.fontSize = '15px'; bb.style.paddingLeft = bb.style.paddingRight = '8px';
      kids.push(h('div', { class: 'buildcard' }, icon('hammer', 28), h('div', { class: 't', text: t('res.build_ready', { b: BNAME(bid) }) + (nb.level > 1 ? ` (${t('b.level', { lv: nb.level }).replace(/ /g, '\u00a0')})` : '') }), bb));
    }
    // assist offer after repeated misses
    if (!sum.bits && sum.fails >= BAL.assist.afterFails && !ctx.daily) {
      const ab = btn(t('res.assist'), 'sea', () => app.retry(true), { icon: 'clock', iconSize: 24 });
      ab.style.width = '100%';
      kids.push(h('div', { style: { marginTop: '8px' } }, ab, h('div', { class: 'skiphint', text: t('res.assist_note') })));
      app.track('assist_offered', { level: level.n, fails: sum.fails });
    }
    // buttons
    const btns = h('div', { class: 'rbtns' });
    const retry = btn('', 'plain square', () => app.retry(false), { icon: 'retry', iconSize: 28, aria: t('res.retry') });
    const home = btn(t('res.island'), 'wood', () => app.toIsland(), { icon: 'home', iconSize: 24 });
    const cleared = sum.bits & 1;
    const nextN = ctx.daily ? 0 : level.n + 1;
    const nextOk = nextN && nextN <= levelCount() && levelState(s, nextN).state !== 'locked';
    if (ctx.daily) {
      btns.append(home, btn(t('res.retry'), 'go', () => app.retry(false), { icon: 'retry', iconSize: 24 }));
    } else if (cleared && nextOk && levelState(s, nextN).state !== 'needs') {
      btns.append(retry, home, btn(t('res.next'), 'go', () => app.nextLevel(), { icon: 'play', iconSize: 24 }));
    } else if (cleared) {
      btns.append(retry, home);
      if (!bid) home.classList.add('pulse');
    } else {
      btns.append(home, btn(t('res.retry'), 'go', () => app.retry(false), { icon: 'retry', iconSize: 24 }));
    }
    const panel = h('div', { class: 'panel', style: { position: 'relative' } }, stamp, h('div', { class: 'rbody' }, ...kids), btns);
    const wrap = h('div', { class: 'results' }, panel);
    L.appendChild(wrap);
    L.classList.remove('hidden');
    // animate: stars pop, numbers count up; tap to finish instantly
    const steps = [];
    let delay = 250;
    starEls.forEach((el) => {
      if (el.prev) { iconStyle(el.ic, 'star', 36); el.style.opacity = '0.45'; return; }
      if (!el.ok) return;
      steps.push(setTimeout(() => { iconStyle(el.ic, 'star', 36); el.classList.add('pop'); app.sfx('star', { rate: 1 + steps.length * 0.06 }); app.buzz('ui'); }, delay));
      delay += 320;
    });
    const countDur = 600;
    const t0 = performance.now() + 150;
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / countDur);
      for (const e of haulEls) e.num.textContent = String(Math.round(e.n * Math.max(0, k)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const finish = () => {
      steps.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      for (const e of haulEls) e.num.textContent = String(e.n);
      starEls.forEach((el) => { if (el.ok || el.prev) iconStyle(el.ic, 'star', 36); });
    };
    wrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); finish(); });
    busy(450);
  }

  hideResults() { clear(this.layers.results); }

  whyText(a) {
    if (a.kind === 'greedy') {
      const byType = {};
      for (const p of a.greedy) byType[p.type] = (byType[p.type] || 0) + 1;
      const parts = Object.entries(byType).map(([k, v]) => itemCount(k, v));
      return t('res.why_greedy', { items: joinItems(parts) });
    }
    if (a.kind === 'late') {
      const sec = Math.max(1, Math.round(a.secondsLate));
      return sec === 1 ? t('res.why_late_1') : t('res.why_late', { s: sec });
    }
    return t('res.why_none');
  }

  minimap(res) {
    const w = this.app.world;
    const m = w.m;
    if (!res.trace || !res.trace.length) return null;
    const a = res.analysis;
    // show the stretch that explains the miss: from where you should have turned back (or were swept) down to the island
    const keyYs = [a && a.turnAt ? a.turnAt.y : null, res.sweptAt ? res.sweptAt.y : null].filter((v) => v !== null);
    const top = keyYs.length ? Math.min(...keyYs) : Math.min(...res.trace.map((p) => p.y));
    const minY = Math.max(0, top - 40);
    const maxY = Math.min(m.Hp, w.islandTop + 32);
    // drawn at display size so the marks stay crisp and readable
    const maxH = Math.max(110, Math.min(220, Math.round(window.innerHeight * 0.24)));
    const sc = Math.min(1, maxH / (maxY - minY), 150 / m.Wp);
    const W = Math.round(m.Wp * sc), H = Math.round((maxY - minY) * sc);
    const cv = h('canvas', { class: 'minimap', width: W, height: H });
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(w.terrain, 0, minY, m.Wp, maxY - minY, 0, 0, W, H);
    // water at the moment of being swept
    const lv = w.tide.at(res.sweptAt ? res.sweptAt.t : res.time);
    ctx.fillStyle = 'rgba(63,141,176,0.75)';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = Math.min(m.Hp - 1, Math.round(minY + y / sc)) * m.Wp + Math.min(m.Wp - 1, Math.round(x / sc));
        if (lv > m.floodPx[k]) ctx.fillRect(x, y, 1, 1);
      }
    }
    const P = (x, y) => [x * sc, (y - minY) * sc];
    // your path, then the way home you could have taken
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff6e0';
    ctx.beginPath();
    res.trace.forEach((p, i) => { const [x, y] = P(p.x, p.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    if (a && a.path && a.path.length) {
      ctx.strokeStyle = '#ffd75e';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      a.path.forEach(([px, py], i) => { const [x, y] = P(px, py); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (a && a.turnAt) { // turn back here: a square
      const [x, y] = P(a.turnAt.x, a.turnAt.y);
      ctx.fillStyle = '#2b1d14'; ctx.fillRect(Math.round(x) - 5, Math.round(y) - 5, 11, 11);
      ctx.fillStyle = '#ffd75e'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 7, 7);
    }
    if (res.sweptAt) { // swept here: an X
      const [fx, fy] = P(res.sweptAt.x, res.sweptAt.y);
      const x = Math.round(fx), y = Math.round(fy);
      ctx.fillStyle = '#2b1d14';
      for (let i = -4; i <= 4; i++) { ctx.fillRect(x + i - 1, y + i - 1, 3, 3); ctx.fillRect(x + i - 1, y - i - 1, 3, 3); }
      ctx.fillStyle = '#ffffff';
      for (let i = -3; i <= 3; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + i, y - i, 1, 1); }
    }
    const key = h('div', { class: 'mapkey' },
      h('span', {}, h('i', { style: { background: '#ffd75e' } }), t('res.map_turn')),
      h('span', {}, h('i', { style: { background: '#fff', transform: 'rotate(45deg)' } }), t('res.map_swept')));
    return { el: cv, key, narrow: W < 160 };
  }

  // ---------- popups ----------
  openPopup(title, body, foot, opts = {}) {
    if (this.popupStack.length && opts.single !== false) {
      const top = this.popupStack[this.popupStack.length - 1];
      if (top.key && top.key === opts.key) return top; // already open: ignore repeated taps
    }
    const close = () => this.closePopup(rec);
    const x = btn('', 'plain x', close, { icon: 'close', iconSize: 24, aria: t('common.close'), always: true });
    const bodyEl = h('div', { class: 'body' }, body);
    const pop = h('div', { class: 'popup panel', role: 'dialog', 'aria-label': title }, h('div', { class: 'head' }, h('h2', { text: title }), x), bodyEl, foot ? h('div', { class: 'foot' }, foot) : null);
    const scrim = h('div', { class: 'scrim' }, pop);
    scrim.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === scrim && !opts.modal) close(); });
    this.layers.popup.appendChild(scrim);
    const rec = { scrim, key: opts.key, onClose: opts.onClose, body: bodyEl };
    this.popupStack.push(rec);
    this.app.onPopup(true);
    busy(200);
    return rec;
  }
  closePopup(rec) {
    rec = rec || this.popupStack[this.popupStack.length - 1];
    if (!rec) return;
    const i = this.popupStack.indexOf(rec);
    if (i < 0) return;
    this.popupStack.splice(i, 1);
    rec.scrim.remove();
    if (rec.onClose) rec.onClose();
    if (!this.popupStack.length) this.app.onPopup(false);
  }
  closeAll() { while (this.popupStack.length) this.closePopup(); }
  get popupOpen() { return this.popupStack.length > 0; }

  costRow(cost) {
    const s = this.app.save;
    return h('div', { class: 'costs' }, ...Object.entries(cost).map(([k, v]) => {
      const have = s.mats[k] || 0;
      const ok = have >= v;
      return h('span', { class: 'cost ' + (ok ? 'ok' : 'no'), title: t('mat.' + k) }, icon(k, 24), ok ? `${v}` : `${have}/${v}`, icon(ok ? 'check' : 'close', 16, 'mark'));
    }));
  }

  openBuilding(id) {
    const s = this.app.save;
    const def = BUILD.list[id];
    const lv = buildingLevel(s, id);
    const nb = nextBuild(s, id);
    const title = BNAME(id) + (lv ? ` · ${t('b.level', { lv })}` : '');
    const body = h('div');
    const prevLv = nb ? nb.level : lv;
    body.appendChild(this.buildPreview(id, prevLv));
    let foot = null;
    if (!nb) {
      // fully built: say what it does now, not just that it's done
      body.appendChild(h('p', { text: bnow(id, lv) }));
      body.appendChild(h('div', { class: 'maxnote' }, icon('check', 20), t('b.max')));
    } else if (!plotAvailable(s, id)) {
      body.appendChild(h('p', { text: bdesc(id, nb.level) }));
      body.appendChild(h('p', { text: t('b.locked', { n: def.unlockCleared - clearedCount(s) }) }));
    } else {
      body.appendChild(h('p', { text: bdesc(id, nb.level) }));
      body.appendChild(h('div', { class: 'rsec', style: { textAlign: 'left' }, text: t('b.need') }));
      body.appendChild(this.costRow(nb.cost));
      const ok = canAfford(s, nb.cost);
      const b = btn(lv ? t('b.upgrade') : t('b.build'), ok ? 'go big' : 'plain big disabled', () => { this.closeAll(); this.app.build(id); }, {
        icon: 'hammer', iconSize: 28, onDisabled: () => this.toast(t('b.not_enough'), 1200, true),
      });
      b.style.width = '100%';
      foot = b;
    }
    this.openPopup(title, body, foot, { key: 'b-' + id });
  }

  buildPreview(id, lv) {
    const wrap = h('div', { class: 'bprev' });
    const def = BUILD.list[id];
    let name = null;
    if (def.sprite) name = def.sprite[Math.max(0, Math.min(def.sprite.length, lv) - 1)];
    else if (id === 'boardwalk') name = 'board_end';
    const f = name && frame(name);
    if (!f) return wrap;
    const scale = Math.max(1, Math.min(4, Math.floor(110 / Math.max(f[2], f[3]))));
    const cv = h('canvas', { width: f[2], height: f[3] });
    cv.style.width = f[2] * scale + 'px';
    cv.style.height = f[3] * scale + 'px';
    const ctx = cv.getContext('2d');
    ctx.drawImage(assets.world, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    if (id === 'boardwalk') {
      cv.height = 48; cv.style.height = 48 * scale + 'px';
      const c2 = cv.getContext('2d');
      const mid = frame('board_mid'), end = frame('board_end');
      c2.drawImage(assets.world, end[0], end[1], 16, 16, 0, 0, 16, 16);
      c2.drawImage(assets.world, mid[0], mid[1], 16, 16, 0, 16, 16, 16);
      c2.drawImage(assets.world, mid[0], mid[1], 16, 16, 0, 32, 16, 16);
    }
    wrap.appendChild(cv);
    return wrap;
  }

  openCalendar() {
    const s = this.app.save;
    const list = h('div', { class: 'list' });
    let chap = 0;
    let curRow = null;
    for (let n = 1; n <= levelCount(); n++) {
      const lv = levelById(n);
      if (lv.chapter !== chap) { chap = lv.chapter; list.appendChild(h('div', { class: 'chap', text: t('cal.chapter.' + chap) })); }
      const st = levelState(s, n);
      const stars = h('div', { class: 'stars' });
      for (let i = 0; i < 3; i++) stars.appendChild(icon(st.stars && (st.stars >> i) & 1 ? 'star' : 'star_empty', 18));
      let sub = t('cal.kind.' + lv.kind);
      if (st.state === 'locked') sub = t('cal.locked');
      else if (st.state === 'needs') { const [k, v] = st.miss[0]; sub = t('home.needs', { b: BNAME(REQ_NAME[k]), lv: v }); }
      const row = h('div', { class: 'lrow' + (st.state === 'locked' ? ' locked' : '') + (n === this.app.levelN ? ' cur' : '') },
        h('div', { class: 'num', text: String(n) }),
        h('div', { class: 'mid' }, h('div', { class: 'ttl', text: st.state === 'locked' ? '???' : t('level.' + lv.id) }), h('div', { class: 'sub', text: sub })),
        st.state === 'locked' ? icon('lock', 24) : stars);
      if (st.state !== 'locked') onTap(row, () => { this.app.selectLevel(n); this.closeAll(); });
      if (n === this.app.levelN) curRow = row;
      list.appendChild(row);
    }
    const head = h('div', { class: 'sub', style: { textAlign: 'right', marginBottom: '6px' }, text: t('cal.stars', { n: totalStars(s), m: levelCount() * 3 }) });
    const rec = this.openPopup(t('cal.title'), h('div', {}, head, list), null, { key: 'cal' });
    // keep the current tide in view without jumping
    if (curRow && rec) requestAnimationFrame(() => { rec.body.scrollTop = Math.max(0, curRow.offsetTop - rec.body.clientHeight / 2); });
  }

  openBook() {
    const s = this.app.save;
    const grid = h('div', { class: 'grid' });
    for (const id of COLL.treasures) {
      const got = s.collection.treasures[id];
      grid.appendChild(h('div', { class: 'cell' + (got ? '' : ' unknown') }, icon(got ? 'tr_' + id : 'chest', 40),
        h('div', { class: 'nm', text: got ? t('t.' + id) : '???' }), h('div', { class: 'ds', text: got ? t('t.' + id + '.d') : t('book.unknown') })));
    }
    const letters = h('div', { class: 'list' });
    for (const id of COLL.letters) {
      const got = s.collection.letters[id];
      letters.appendChild(h('div', { class: 'letter' + (got ? '' : ' unknown'), text: got ? t('letter.' + id) : t('book.unknown') }));
    }
    const nT = Object.keys(s.collection.treasures).length, nL = Object.keys(s.collection.letters).length;
    const body = h('div', {},
      h('div', { class: 'chap', text: `${t('book.treasures')} ${t('book.count', { n: nT, m: COLL.treasures.length })}` }), grid,
      h('div', { class: 'chap', text: `${t('book.letters')} ${t('book.count', { n: nL, m: COLL.letters.length })}` }), letters);
    this.openPopup(t('book.title'), body, null, { key: 'book' });
  }

  openRequests() {
    const s = this.app.save;
    const render = () => {
      const list = h('div', { class: 'list' });
      s.daily.requests.forEach((r, i) => {
        const have = s.mats[r.mat] || 0;
        const right = r.done ? h('div', { class: 'goalpill', style: { color: '#3c7d2c' } }, icon('check', 24), t('req.done'))
          : btn(t('req.give'), have >= r.n ? 'go' : 'plain disabled', () => { this.app.fulfil(i); rerender(); }, { onDisabled: () => this.toast(t('req.need_more', { n: r.n - have }), 1200, true) });
        if (right.classList.contains('btn')) { right.style.minHeight = '48px'; right.style.fontSize = '15px'; }
        list.appendChild(h('div', { class: 'lrow', style: { cursor: 'default' } },
          h('div', { class: 'goalpill' }, icon(r.mat, 28), `${Math.min(have, r.n)}/${r.n}`),
          h('div', { class: 'mid', style: { textAlign: 'center' } }, '→'),
          h('div', { class: 'goalpill' }, ...Object.entries(r.reward).map(([k, v]) => h('span', { class: 'goalpill' }, icon(k, 24), String(v)))),
          right));
      });
      list.appendChild(h('div', { class: 'sub', text: t('req.tomorrow') }));
      return list;
    };
    let rec = null;
    const rerender = () => { if (rec) { clear(rec.body); rec.body.appendChild(render()); } this.refreshHome(); };
    rec = this.openPopup(t('req.title'), render(), null, { key: 'req' });
  }

  openDecor() {
    const s = this.app.save;
    const render = () => {
      const grid = h('div', { class: 'grid' });
      for (const [k, d] of Object.entries(BUILD.decor.catalog)) {
        const cost = decorCost(s, k);
        const ok = canAfford(s, cost) && decorSlotsLeft(s) > 0;
        const cv = this.spriteCanvas(d.sprite, 2);
        const b = btn(t('decor.place'), ok ? 'go' : 'plain disabled', () => { this.app.placeDecor(k); rerender(); }, { onDisabled: () => this.toast(decorSlotsLeft(s) ? t('b.not_enough') : t('decor.full'), 1200, true) });
        b.style.minHeight = '44px'; b.style.fontSize = '14px';
        grid.appendChild(h('div', { class: 'cell' }, cv, h('div', { class: 'nm', text: t('decor.' + k) }), this.costRow(cost), b));
      }
      return h('div', {}, h('div', { class: 'sub', style: { marginBottom: '6px' }, text: t('decor.count', { n: s.decor.length, m: BUILD.decor.slots.length }) }), grid);
    };
    let rec = null;
    const rerender = () => { if (rec) { clear(rec.body); rec.body.appendChild(render()); } };
    rec = this.openPopup(t('decor.title'), render(), null, { key: 'decor' });
  }

  spriteCanvas(name, scale) {
    const f = frame(name);
    const cv = h('canvas', { width: f ? f[2] : 1, height: f ? f[3] : 1 });
    if (!f) return cv;
    cv.style.width = f[2] * scale + 'px'; cv.style.height = f[3] * scale + 'px';
    cv.style.imageRendering = 'pixelated';
    cv.getContext('2d').drawImage(assets.world, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    return cv;
  }

  openDaily() {
    const s = this.app.save;
    const d = this.app.dailyLevel();
    const body = h('div', {},
      h('p', { style: { fontFamily: 'var(--font-b)', fontSize: '17px' }, text: t('daily.mod.' + d.mod) }),
      h('div', { class: 'nextcard', style: { padding: 0 } }, h('div', { class: 'goals' }, ...(d.goals || []).map((g) => h('span', { class: 'goalpill' }, icon(g.t, 24), `${g.n}`)))),
      h('p', { style: { marginTop: '8px' }, text: s.daily.tideDone ? t('daily.done') : t('daily.desc') }));
    const go = btn(t('home.go'), 'go big', () => { this.closeAll(); this.app.startDaily(); }, { icon: 'play', iconSize: 28 });
    go.style.width = '100%';
    this.openPopup(t('daily.title'), body, go, { key: 'daily' });
  }

  openSettings() {
    const s = this.app.save;
    const st = s.settings;
    const seg = (opts, cur, fn) => {
      const wrap = h('div', { class: 'seg' });
      for (const [v, label] of opts) {
        const b = btn(label, 'plain' + (v === cur ? ' on' : ''), () => { fn(v); for (const c of wrap.children) c.classList.remove('on'); b.classList.add('on'); });
        wrap.appendChild(b);
      }
      return wrap;
    };
    const slider = (val, fn) => {
      const r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(val * 100), 'aria-label': 'volume' });
      r.addEventListener('input', () => fn(r.value / 100));
      r.addEventListener('pointerdown', (e) => e.stopPropagation());
      return r;
    };
    const vibOk = typeof navigator.vibrate === 'function';
    const body = h('div', {},
      h('div', { class: 'setrow' }, h('div', { class: 'k' }, icon('music', 24), t('set.music')), slider(st.music, (v) => this.app.setSetting('music', v))),
      h('div', { class: 'setrow' }, h('div', { class: 'k' }, icon('sound', 24), t('set.sfx')), slider(st.sfx, (v) => this.app.setSetting('sfx', v))),
      h('div', { class: 'setrow' }, h('div', { class: 'k' }, icon('vibrate', 24), t('set.vibrate')),
        vibOk ? seg([[true, t('set.on')], [false, t('set.off')]], st.vibrate, (v) => this.app.setSetting('vibrate', v)) : h('span', { class: 'sub', style: { maxWidth: '50%', textAlign: 'right' }, text: t('set.vibrate_unsupported') })),
      h('div', { class: 'setrow' }, h('div', { class: 'k' }, icon('globe', 24), t('set.lang')), seg([['ko', '한국어'], ['en', 'English']], i18n.lang, (v) => this.app.setSetting('lang', v))),
      h('div', { class: 'setrow' }, h('div', { class: 'k' }, icon('info', 24), t('set.quality')), seg([['high', t('set.q_high')], ['low', t('set.q_low')]], st.quality, (v) => this.app.setSetting('quality', v))),
      h('div', { class: 'setrow', style: { borderBottom: 'none', justifyContent: 'center', paddingTop: '8px' } }, btn(t('set.reset'), 'plain', () => this.confirmReset())),
      h('div', { class: 'credits' }, h('b', { text: t('set.credits') }), '\n', t('set.credits_text')));
    this.openPopup(t('set.title'), body, null, { key: 'settings' });
  }

  confirmReset() {
    const body = h('p', { text: t('set.reset_confirm') });
    const foot = h('div', { style: { display: 'flex', gap: '8px', width: '100%' } },
      btn(t('set.cancel'), 'plain', () => this.closePopup()),
      btn(t('set.reset_yes'), 'primary', () => { this.closeAll(); this.app.resetAll(); }));
    for (const b of foot.children) b.style.flex = '1';
    this.openPopup(t('set.reset'), body, foot, { key: 'reset', modal: true });
  }

  openPause() {
    const body = h('div', {}, h('p', { class: 'sub', text: t('pause.giveup_note') }));
    const foot = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' } },
      btn(t('pause.resume'), 'go big', () => this.closePopup(), { icon: 'play', iconSize: 28 }),
      btn(t('pause.giveup'), 'wood', () => { this.closeAll(); this.app.giveUp(); }, { icon: 'home', iconSize: 24 }));
    this.openPopup(t('pause.title'), body, foot, { key: 'pause', onClose: () => this.app.resume() });
  }

  relabel() {
    // language switch: rebuild static screens in place
    const showHome = !this.layers.home.classList.contains('hidden');
    clear(this.layers.home); clear(this.layers.hud);
    this.buildHud(); this.buildHome();
    if (showHome) this.showHome();
  }
}
