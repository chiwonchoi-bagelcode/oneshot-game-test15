// Entry: loading screen, boot, main loop.
import { initScreen, screen } from './core/screen.js';
import { initInput, input } from './core/input.js';
import { loadAssets } from './core/assets.js';
import { App } from './game/app.js';
import { initAudioLifecycle, loadPack, unlockAudio, tickAudio } from './audio/audio.js';
import { t } from './ui/i18n.js';


async function main() {
  const root = document.getElementById('root');
  const canvas = document.getElementById('game');
  const loading = document.getElementById('loading');
  const bar = loading.querySelector('.bar > i');
  const msg = loading.querySelector('.msg');
  initScreen(root, canvas);
  initAudioLifecycle();
  const app = new App(root);
  msg.textContent = t('loading');
  bar.style.width = '30%';
  await loadAssets();
  bar.style.width = '70%';
  if (document.fonts && document.fonts.load) {
    try { await Promise.race([document.fonts.load('15px Galmuri11'), new Promise((r) => setTimeout(r, 800))]); } catch (_) { /* fonts optional */ }
  }
  bar.style.width = '100%';
  initInput(document.getElementById('touch'));
  input.onTap = (x, y) => app.onTap(x, y);
  // any first touch unlocks audio (mobile autoplay rules)
  const unlock = () => { unlockAudio(); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  // sounds stream in after the first frame; the game never waits for them
  setTimeout(() => { loadPack('assets/audio-sfx.js').then(() => loadPack('assets/audio-music.js')); }, 50);
  await app.boot();
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 500);
  window.__app = app;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const { initDebug } = await import('./debug/panel.js');
    initDebug(app);
  }
  // recording mode (dev only): the harness steps time explicitly, one frame per capture
  if (typeof __DEV__ !== 'undefined' && __DEV__ && new URLSearchParams(location.search).get('rec')) {
    window.__simTime = 0;
    window.__step = (n = 1, dt = 1 / 30) => {
      for (let i = 0; i < n; i++) { window.__simTime += dt; app.update(dt); }
      app.render(screen.ctx);
      return window.__simTime;
    };
    return;
  }
  // main loop: fixed max dt, optional 30fps cap (battery saver), stops while hidden
  let last = performance.now();
  let acc = 0;
  let slowEma = 1 / 60, slowT = 0;
  const ctx = screen.ctx;
  const frame = (now) => {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    const step = 1 / (app.targetFps || 60);
    acc += dt;
    if (app.targetFps === 30 && acc < step * 0.9) return;
    const d = Math.min(acc, 0.1);
    acc = 0;
    // safety net for slow phones: if a run can't hold ~45 fps for 3 s, lighten effects for this session
    if (app.mode === 'run' && !app.autoLow && app.targetFps !== 30) {
      slowEma = slowEma * 0.95 + d * 0.05;
      slowT = slowEma > 0.022 ? slowT + d : 0;
      if (slowT > 3) app.lighten(Math.round(1 / slowEma));
    }
    app.update(d);
    app.render(ctx);
    tickAudio(d, app.mode === 'island');
  };
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !(typeof __DEV__ !== 'undefined' && __DEV__)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main();
