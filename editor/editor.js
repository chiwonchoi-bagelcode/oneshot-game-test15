// 물때 섬 level editor (dev tool). Same model/renderer as the game.
// List | map (paint terrain, drag items, scrub the tide) | properties, validate, test play, import/export.
import { LEVELS } from '../src/data/levels/index.js';
import BAL from '../src/data/balance.json';
import ITEMS from '../src/data/items.json';
import { buildModel, T } from '../src/game/model.js';
import { bakeTerrain } from '../src/game/terrain.js';
import { Water } from '../src/game/water.js';
import { loadAssets, spr, sprC } from '../src/core/assets.js';
import { validateLevel } from '../tools/levels/validate-src.mjs';
import { prepare, plan, goalObjective } from '../src/game/solver.js';
import { earliest, pathTo } from '../src/game/model.js';
import KO from '../src/data/i18n/ko.json';

const STORE = 'lowtide.editor.levels';
const SCALE = 3;
const TERR = [['~', '바다'], ['c', '갯골'], ['m', '뻘'], ['s', '모래'], ['b', '모래톱'], ['r', '바위']];
const KINDS = ['easy', 'think', 'discover'];
const TYPES = Object.keys(ITEMS);

const st = {
  levels: [], cur: 0, tool: 'move', paint: 's', itemType: 'shell', drag: null, sel: null,
  scrub: 0, up: { boardwalk: 1, bag: 0, sled: 0, light: 0, stilt: 0 }, route: null, dirty: true, val: null,
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) { saved = null; }
  st.levels = LEVELS.map((l) => clone(saved && saved[l.id] ? saved[l.id] : l));
}
function persist() {
  const o = {};
  st.levels.forEach((l, i) => { if (JSON.stringify(l) !== JSON.stringify(LEVELS[i])) o[l.id] = l; });
  try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (_) { /* ignore */ }
}
const lv = () => st.levels[st.cur];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}

let canvas, ctx, water, model, terrainCv, listEl, propsEl, valEl, scrubEl, scrubLbl;

function upFromState() {
  return { ...st.up, boardwalk: Math.max(st.up.boardwalk, lv().requires?.boardwalk || 0) };
}

function rebuild() {
  model = buildModel(lv(), upFromState());
  terrainCv = bakeTerrain(model);
  canvas.width = model.Wp; canvas.height = model.Hp;
  canvas.style.width = model.Wp * SCALE + 'px';
  canvas.style.height = model.Hp * SCALE + 'px';
  water.resize(model.Wp, model.Hp);
  st.dirty = false;
}

function tideLevel() {
  const t = lv().tide;
  const u = Math.min(1, st.scrub / t.duration);
  return t.low + ((t.high ?? 100) - t.low) * Math.pow(u, t.curve ?? BAL.tide.curve);
}

function draw() {
  if (st.dirty) rebuild();
  const L = lv();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(terrainCv, 0, 0);
  for (const it of L.items) {
    sprC(ctx, ITEMS[it.t].sprite, it.x * T, it.y * T);
  }
  const level = tideLevel();
  ctx.drawImage(water.render(model, level, 0, 0, 0), 0, 0);
  // boardwalk
  const len = model.st.boardLen;
  for (let k = 0; k < len; k++) spr(ctx, 'board_mid', BAL.boardwalk.column * T, (model.F - 1 - k) * T);
  // fog line
  if (L.fog) { ctx.fillStyle = 'rgba(236,244,246,0.35)'; ctx.fillRect(0, 0, model.Wp, L.fog * T); }
  // selection
  if (st.sel != null && L.items[st.sel]) {
    const it = L.items[st.sel];
    ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(it.x * T) - 8.5, Math.round(it.y * T) - 8.5, 17, 17);
  }
  // solver route
  if (st.route) {
    ctx.strokeStyle = 'rgba(255,215,94,0.95)';
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    st.route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // zone guides
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '8px monospace';
  for (const [y, name] of [[44, 'A'], [28, 'B'], [13, 'C'], [2, 'D']]) ctx.fillText(name, 1, y * T + 8);
  scrubLbl.textContent = `물 높이 ${level.toFixed(1)} · ${st.scrub.toFixed(1)}s / ${L.tide.duration}s`;
}

function worldPos(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / SCALE, (e.clientY - r.top) / SCALE];
}

function hitItem(x, y) {
  const L = lv();
  let best = -1, bd = 9;
  L.items.forEach((it, i) => { const d = Math.hypot(it.x * T - x, it.y * T - y); if (d < bd) { bd = d; best = i; } });
  return best;
}

function paintAt(x, y) {
  const L = lv();
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (ty < 0 || ty >= L.terrain.length || tx < 0 || tx >= BAL.worldW) return;
  if (st.tool === 'paint') {
    const row = L.terrain[ty].split('');
    if (row[tx] === st.paint) return;
    row[tx] = st.paint;
    L.terrain[ty] = row.join('');
  } else if (st.tool === 'raise' || st.tool === 'lower') {
    L.heights = L.heights || {};
    const k = `${tx},${ty}`;
    L.heights[k] = (L.heights[k] || 0) + (st.tool === 'raise' ? 2 : -2);
    if (!L.heights[k]) delete L.heights[k];
  }
  st.dirty = true;
  touched();
}

function touched() { persist(); renderList(); st.route = null; }

function onDown(e) {
  e.preventDefault();
  const [x, y] = worldPos(e);
  const L = lv();
  if (e.button === 2) {
    const h = hitItem(x, y);
    if (h >= 0) { L.items.splice(h, 1); st.sel = null; touched(); renderProps(); }
    return;
  }
  if (st.tool === 'paint' || st.tool === 'raise' || st.tool === 'lower') { st.drag = { paint: true }; paintAt(x, y); return; }
  let h = hitItem(x, y);
  if (h < 0 && st.tool === 'item') {
    L.items.push({ t: st.itemType, x: +(x / T).toFixed(2), y: +(y / T).toFixed(2) });
    h = L.items.length - 1;
    touched(); renderProps();
  }
  st.sel = h >= 0 ? h : null;
  if (h >= 0) st.drag = { item: h };
}
function onMove(e) {
  if (!st.drag) return;
  const [x, y] = worldPos(e);
  if (st.drag.paint) { paintAt(x, y); return; }
  const it = lv().items[st.drag.item];
  it.x = +Math.max(0.3, Math.min(BAL.worldW - 0.3, x / T)).toFixed(2);
  it.y = +Math.max(0.3, Math.min(lv().terrain.length - 0.3, y / T)).toFixed(2);
}
function onUp() { if (st.drag) { st.drag = null; touched(); renderProps(); } }

function renderList() {
  listEl.innerHTML = '';
  let ch = 0;
  st.levels.forEach((L, i) => {
    if (L.chapter !== ch) { ch = L.chapter; listEl.append(el('div', { class: 'chap', text: KO['cal.chapter.' + ch] || `Chapter ${ch}` })); }
    const changed = JSON.stringify(L) !== JSON.stringify(LEVELS[i]);
    listEl.append(el('div', { class: 'lv' + (i === st.cur ? ' cur' : ''), onclick: () => { st.cur = i; st.sel = null; st.dirty = true; st.route = null; st.val = null; st.scrub = 0; scrubEl.value = 0; renderAll(); } },
      el('span', { class: 'n', text: String(L.n) }), el('span', { text: KO['level.' + L.id] || L.key }), el('span', { class: 'st', text: (changed ? '● ' : '') + L.kind })));
  });
}

function numInput(obj, key, step = 1, onChange) {
  const i = el('input', { type: 'number', step: String(step), value: obj[key] ?? '' });
  i.addEventListener('change', () => { obj[key] = i.value === '' ? null : +i.value; st.dirty = true; touched(); if (onChange) onChange(); });
  return i;
}

function renderProps() {
  const L = lv();
  propsEl.innerHTML = '';
  const counts = {};
  for (const it of L.items) counts[it.t] = (counts[it.t] || 0) + 1;
  const kind = el('select', {}, ...KINDS.map((k) => el('option', { value: k, text: k })));
  kind.value = L.kind;
  kind.addEventListener('change', () => { L.kind = kind.value; touched(); });
  const hint = el('input', { type: 'checkbox' });
  hint.checked = !!L.hintReturn;
  hint.addEventListener('change', () => { L.hintReturn = hint.checked; touched(); });
  const req = (k, max) => {
    const s = el('select', {}, ...Array.from({ length: max + 1 }, (_, v) => el('option', { value: v, text: String(v) })));
    s.value = String(L.requires?.[k] || 0);
    s.addEventListener('change', () => { L.requires = L.requires || {}; if (+s.value) L.requires[k] = +s.value; else delete L.requires[k]; st.dirty = true; touched(); });
    return s;
  };
  const goals = el('div');
  (L.goals || []).forEach((g, i) => {
    const s = el('select', {}, ...TYPES.map((t) => el('option', { value: t, text: KO['mat.' + t] || t })));
    s.value = g.t;
    s.addEventListener('change', () => { g.t = s.value; touched(); renderProps(); });
    const n = numInput(g, 'n', 1, renderProps);
    goals.append(el('div', { class: 'goal' }, el('span', { text: i === 0 ? '목표' : `별 ${i + 1}` }), s, n, el('span', { class: (counts[g.t] || 0) >= g.n ? 'ok' : 'bad', text: `/${counts[g.t] || 0}` })));
  });
  const sel = st.sel != null ? L.items[st.sel] : null;
  propsEl.append(...[
    el('h3', { text: `${L.id} · ${KO['level.' + L.id] || L.key}` }),
    el('label', {}, el('span', { text: '종류' }), kind),
    el('label', {}, el('span', { text: '돌아갈 때 알림' }), hint),
    el('h3', { text: '물때' }),
    el('label', {}, el('span', { text: '썰물 높이(low)' }), numInput(L.tide, 'low', 1)),
    el('label', {}, el('span', { text: '길이(초)' }), numInput(L.tide, 'duration', 1)),
    el('label', {}, el('span', { text: '곡선(curve)' }), numInput(L.tide, 'curve', 0.05)),
    el('label', {}, el('span', { text: '안개 줄(fog)' }), numInput(L, 'fog', 1)),
    el('h3', { text: '필요한 건물' }),
    el('label', {}, el('span', { text: '데크길' }), req('boardwalk', 3)),
    el('label', {}, el('span', { text: '등대' }), req('light', 2)),
    el('label', {}, el('span', { text: '장대 쉼터' }), req('stilt', 1)),
    el('h3', { text: '목표와 별' }), goals,
    el('h3', { text: `물건 ${L.items.length}개` }),
    el('div', { text: Object.entries(counts).map(([k, v]) => `${KO['mat.' + k] || k} ${v}`).join(' · ') }),
    sel ? el('div', { class: 'hint', text: `선택: ${KO['mat.' + sel.t]} (${sel.x}, ${sel.y}) — 끌어서 옮기고, 오른쪽 클릭으로 지워요.` }) : null,
    el('h3', { text: '검증 · 시험 (업그레이드 가정)' }),
    el('label', {}, el('span', { text: '데크길' }), upSel('boardwalk', 3)),
    el('label', {}, el('span', { text: '오두막(자루)' }), upSel('bag', 3)),
    el('label', {}, el('span', { text: '뻘배' }), upSel('sled', 2)),
    el('label', {}, el('span', { text: '등대' }), upSel('light', 2)),
    el('label', {}, el('span', { text: '장대 쉼터' }), upSel('stilt', 1)),
    el('div', { style: 'display:flex;gap:6px;margin:8px 0' },
      el('button', { class: 'primary', onclick: runValidate, text: '검증하기' }),
      el('button', { onclick: testPlay, text: '시험 플레이' })),
    valEl = el('div', { id: 'val', text: st.val || '검증 결과가 여기에 나와요.' }),
    el('div', { class: 'hint', text: '검증: 사람 속도 85%로 목표를 이루고 돌아올 수 있는지, 별 목표가 모두 가능한지 봐요. 노란 점선은 목표를 위한 경로예요.' }),
  ].filter(Boolean));
}

function upSel(k, max) {
  const s = el('select', {}, ...Array.from({ length: max + 1 }, (_, v) => el('option', { value: v, text: String(v) })));
  s.value = String(st.up[k] || 0);
  s.addEventListener('change', () => { st.up[k] = +s.value; st.dirty = true; });
  return s;
}

function runValidate() {
  valEl.textContent = '검증 중…';
  setTimeout(() => {
    const L = lv();
    const t0 = performance.now();
    const r = validateLevel(L);
    const lines = [];
    lines.push(r.errors.length ? '문제 있음' : '통과');
    r.stars.forEach((s, i) => lines.push(`${i === 0 ? '목표' : '별 ' + (i + 1)} ${s.goal}: ${s.ok ? '가능' : '불가'}${s.returnAt != null ? ` (귀환 ${s.returnAt}s)` : ''}`));
    for (const e of r.errors) lines.push('· ' + e);
    const m = r.metrics || {};
    if (m.naive) lines.push(`봇 귀환: ${m.naive} (S=성공, x=휩쓸림) · 목표 달성 ${m.naiveGoal}`);
    if (m.botWhy) lines.push(`봇이 멈춘 이유: ${m.botWhy} (f=가방 가득, w=물, n=더 없음, 숫자=물때 %)`);
    if (m.turn != null) lines.push(`가장 먼 목표 물건에서 늦어도 물때 ${Math.round(m.turn * 100)}%에는 떠나야 해요`);
    lines.push(`${((performance.now() - t0) / 1000).toFixed(1)}초`);
    st.val = lines.join('\n');
    valEl.textContent = st.val;
    valEl.className = r.errors.length ? 'bad' : 'ok';
    // draw the route for the main goal
    try {
      const P = prepare(L, upFromState());
      const best = plan(P, { scale: 0.92, beam: 20, objective: goalObjective(L.goals[0]) });
      if (best) {
        const pts = [[P.start.x, P.start.y]];
        let x = P.start.x, y = P.start.y, t = 0, w = 0;
        for (const id of best.picked) {
          const it = P.items.find((q) => q.i === id);
          const rr = earliest(P.nav, P.m, P.tide, x, y, t, w, 0.92, false);
          pts.push(...pathTo(rr, P.nav, it.cell));
          t = rr.times[it.cell]; x = it.x; y = it.y; w += it.w;
        }
        const back = earliest(P.nav, P.m, P.tide, x, y, t, w, 0.92);
        if (back.goal >= 0) pts.push(...pathTo(back, P.nav, back.goal));
        st.route = pts;
      }
    } catch (e) { console.warn(e); }
  }, 30);
}

function testPlay() {
  try { localStorage.setItem('lowtide.editor.test', JSON.stringify({ level: lv(), up: upFromState() })); } catch (_) { /* ignore */ }
  window.open('../dev.html?test=1', '_blank');
}

function download(name, text) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); a.remove();
}

function importFile() {
  const inp = el('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const arr = Array.isArray(data) ? data : [data];
      let n = 0;
      for (const L of arr) {
        const i = st.levels.findIndex((q) => q.id === L.id);
        if (i >= 0 && Array.isArray(L.terrain) && Array.isArray(L.items)) { st.levels[i] = L; n++; }
      }
      persist(); st.dirty = true; renderAll();
      alert(`${n}개 레벨을 가져왔어요.`);
    } catch (e) { alert('JSON을 읽을 수 없어요: ' + e.message); }
  });
  inp.click();
}

function buildUI() {
  const app = document.getElementById('app');
  const tb = (label, tool, extra) => el('button', { 'data-tool': tool + (extra ? ':' + extra : ''), onclick: (e) => { st.tool = tool; if (tool === 'paint') st.paint = extra; if (tool === 'item') st.itemType = extra; markTools(); }, text: label });
  const tools = el('div', { id: 'tools' },
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: '선택' }), tb('옮기기', 'move')),
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: '땅' }), ...TERR.map(([c, n]) => tb(n, 'paint', c)), tb('높이+', 'raise'), tb('높이−', 'lower')),
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: '물건' }), ...TYPES.map((t) => tb(KO['mat.' + t] || t, 'item', t))),
  );
  canvas = el('canvas', { id: 'map' });
  ctx = canvas.getContext('2d');
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel != null && document.activeElement === document.body) {
      lv().items.splice(st.sel, 1); st.sel = null; touched(); renderProps();
    }
  });
  scrubEl = el('input', { type: 'range', min: 0, max: 1000, value: 0 });
  scrubEl.addEventListener('input', () => { st.scrub = scrubEl.value / 1000 * lv().tide.duration; });
  scrubLbl = el('span');
  const center = el('div', { id: 'center' }, tools, el('div', { id: 'mapwrap' }, canvas), el('div', { id: 'scrub' }, el('span', { text: '물때 미리보기' }), scrubEl, scrubLbl));
  listEl = el('aside', { id: 'list' });
  propsEl = el('section', { id: 'props' });
  const header = el('header', {},
    el('h1', { text: '물때 섬 레벨 편집기' }),
    el('button', { onclick: () => download(`${lv().id}.json`, JSON.stringify(lv(), null, 1)), text: '이 레벨 내보내기' }),
    el('button', { onclick: () => download('levels-all.json', JSON.stringify(st.levels, null, 1)), text: '모두 내보내기' }),
    el('button', { onclick: importFile, text: '가져오기' }),
    el('button', { onclick: () => { if (confirm('이 레벨의 편집 내용을 버리고 원래대로 돌릴까요?')) { st.levels[st.cur] = clone(LEVELS[st.cur]); persist(); st.dirty = true; renderAll(); } }, text: '원래대로' }),
    el('span', { class: 'sp' }),
    el('span', { class: 'hint', text: '편집 내용은 이 브라우저에 자동 저장돼요. 내보낸 파일을 src/data/levels/에 넣으면 게임에 반영돼요.' }));
  app.append(header, listEl, center, propsEl);
  markTools();
}

function markTools() {
  const key = st.tool === 'paint' ? 'paint:' + st.paint : st.tool === 'item' ? 'item:' + st.itemType : st.tool;
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === key));
}

function renderAll() { renderList(); renderProps(); }

async function main() {
  load();
  await loadAssets('../');
  water = new Water();
  buildUI();
  renderAll();
  const loop = () => { draw(); requestAnimationFrame(loop); };
  loop();
  window.__editor = st;
}
main();
