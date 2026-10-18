// Sprite atlas loading and drawing helpers.
import WORLD from '../data/atlas_world.json';

export const assets = { world: null, frames: WORLD, ready: false };

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('image failed: ' + src));
    img.src = src;
  });
}

export async function loadAssets(base = '') {
  assets.world = await loadImage(base + 'assets/world.png');
  assets.ready = true;
}

export function frame(name) {
  return assets.frames[name];
}

// draw sprite with its top-left at (x, y)
export function spr(ctx, name, x, y, flipX = false, alpha = 1) {
  const f = assets.frames[name];
  if (!f) return;
  const [sx, sy, w, h] = f;
  x = Math.round(x); y = Math.round(y);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flipX) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(assets.world, sx, sy, w, h, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(assets.world, sx, sy, w, h, x, y, w, h);
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// draw sprite anchored at bottom-centre
export function sprB(ctx, name, x, y, flipX = false, alpha = 1) {
  const f = assets.frames[name];
  if (!f) return;
  spr(ctx, name, x - (f[2] >> 1), y - f[3], flipX, alpha);
}

// draw sprite centred
export function sprC(ctx, name, x, y, flipX = false, alpha = 1) {
  const f = assets.frames[name];
  if (!f) return;
  spr(ctx, name, x - (f[2] >> 1), y - (f[3] >> 1), flipX, alpha);
}

// draw a sub-rectangle of a sprite (used for the rising construction reveal)
export function sprPart(ctx, name, x, y, cut) {
  const f = assets.frames[name];
  if (!f) return;
  const [sx, sy, w, h] = f;
  const vis = Math.max(0, Math.min(h, Math.round(h * cut)));
  if (!vis) return;
  ctx.drawImage(assets.world, sx, sy + h - vis, w, vis, Math.round(x - (w >> 1)), Math.round(y - vis), w, vis);
}
