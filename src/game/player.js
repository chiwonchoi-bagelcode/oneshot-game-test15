// The islander: movement, bag, animation state and drawing (with water covering the legs).
import BAL from '../data/balance.json';
import ITEMS from '../data/items.json';
import { spr, sprB, frame } from '../core/assets.js';
import { bagMultiplier, wadeMul, clamp } from './model.js';

export class Player {
  constructor() { this.reset(0, 0); }
  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.dir = 'up'; this.flip = false;
    this.anim = 0;
    this.state = 'idle';      // idle | walk | cheer | flail | sit | hidden
    this.face = 'normal';
    this.happyT = 0;
    this.bag = [];            // [{type, t}]
    this.weight = 0;
    this.stepT = 0;
    this.stepSide = 0;
    this.depth = -10;
    this.rot = 0;
    this.lift = 0;
    this.visible = true;
  }
  fill(capacity) { return clamp(this.weight / capacity, 0, 1); }
  sackLevel(capacity) {
    if (!this.bag.length) return 0;
    const f = this.fill(capacity);
    return f < 0.3 ? 1 : f < 0.6 ? 2 : f < 0.9 ? 3 : 4;
  }
  addItem(type, t) {
    this.bag.push({ type, t });
    this.weight += ITEMS[type].weight;
    this.happyT = 0.6;
  }
  // input vector (vx, vy in -1..1), returns distance moved this frame
  move(dt, ix, iy, m, level, onStep) {
    const cap = m.st.capacity;
    const depth = m.depth(this.x, this.y, level);
    this.depth = depth;
    const sp = BAL.player.speed * m.terrainMul(this.x, this.y) * wadeMul(depth) * bagMultiplier(this.weight, cap);
    const tvx = ix * sp, tvy = iy * sp;
    const acc = (ix || iy) ? BAL.player.accel : BAL.player.decel;
    const ax = tvx - this.vx, ay = tvy - this.vy;
    const al = Math.hypot(ax, ay);
    const step = acc * dt;
    if (al <= step) { this.vx = tvx; this.vy = tvy; } else { this.vx += ax / al * step; this.vy += ay / al * step; }
    const r = BAL.player.radius;
    let nx = this.x + this.vx * dt;
    if (m.isBlocked(nx + Math.sign(this.vx) * r, this.y) || m.isBlocked(nx + Math.sign(this.vx) * r, this.y - 3)) { nx = this.x; this.vx = 0; }
    let ny = this.y + this.vy * dt;
    if (m.isBlocked(nx, ny + Math.sign(this.vy) * r) || m.isBlocked(nx, ny - 3 + Math.sign(this.vy) * r)) { ny = this.y; this.vy = 0; }
    ny = clamp(ny, 6, m.Hp - 4);
    const moved = Math.hypot(nx - this.x, ny - this.y);
    this.x = nx; this.y = ny;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 4) {
      this.state = 'walk';
      if (Math.abs(this.vy) > Math.abs(this.vx) * 0.8) { this.dir = this.vy < 0 ? 'up' : 'down'; }
      else { this.dir = 'side'; this.flip = this.vx < 0; }
      // heavier = slower animation cadence
      const cadence = 8 * (0.55 + 0.45 * (speed / BAL.player.speed));
      this.anim += dt * cadence;
      this.stepT += moved;
      if (this.stepT > 7) { this.stepT = 0; this.stepSide ^= 1; if (onStep) onStep(this.stepSide); }
    } else {
      if (this.state === 'walk') this.state = 'idle';
      this.anim += dt * 2;
    }
    this.happyT = Math.max(0, this.happyT - dt);
    return moved;
  }
  pickFace(capacity, danger) {
    if (this.state === 'flail') return 'panic';
    if (danger > 0.55) return 'panic';
    if (danger > 0.05) return 'worried';
    if (this.happyT > 0) return 'happy';
    if (this.fill(capacity) >= 0.7 && this.state === 'walk') return 'strain';
    return 'normal';
  }
  frameName() {
    const s = this.state;
    if (s === 'cheer') return `p_cheer${(this.anim * 4 | 0) % 2}`;
    if (s === 'flail') return `p_flail${(this.anim * 6 | 0) % 2}`;
    if (s === 'sit') return `p_sit${this.face === 'happy' ? 1 : 0}`;
    const walk = s === 'walk';
    const fi = walk ? (this.anim | 0) % 4 : (this.anim | 0) % 2;
    const kind = walk ? 'walk' : 'idle';
    if (this.dir === 'up') return `p_up_${kind}${fi}`;
    const face = this.dir === 'side' && this.face === 'worried' ? 'normal' : this.face;
    return `p_${this.dir === 'down' ? 'down' : 'side'}_${kind}${fi}_${face}`;
  }
  draw(ctx, cx, cy, capacity, level) {
    if (!this.visible) return;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy - this.lift);
    const sack = this.sackLevel(capacity);
    const name = this.frameName();
    const depth = this.depth;
    const submerge = depth > 0 ? Math.min(13, Math.round(2 + depth * 1.6)) : 0;
    // shadow
    if (!submerge && this.state !== 'hidden') spr(ctx, 'shadow', x - 6, y - 2, false, 1);
    const drawBody = () => {
      if (this.dir !== 'up' && this.state !== 'sit' && sack) {
        // sack peeks out behind the body
        const sn = `sack${sack}`;
        const f = frame(sn);
        const ox = this.dir === 'side' ? (this.flip ? 3 : -3) : -5;
        sprB(ctx, sn, x + ox, y - 7 + (sack > 2 ? 1 : 0), false);
        if (f && this.dir === 'down' && sack >= 3) sprB(ctx, sn, x + 5, y - 8, true);
      }
      sprB(ctx, name, x, y, this.dir === 'side' && this.flip);
      if (this.dir === 'up' && sack && this.state !== 'sit') sprB(ctx, `sack${sack}`, x, y - 4 + (sack >= 3 ? 2 : 0));
    };
    if (this.rot) {
      ctx.save();
      ctx.translate(x, y - 10);
      ctx.rotate(this.rot);
      ctx.translate(-x, -(y - 10));
      drawBody();
      ctx.restore();
    } else if (submerge) {
      // draw the top part normally and the legs faint, as if under water
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 16, y - 40, 32, 40 - submerge);
      ctx.clip();
      drawBody();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 16, y - submerge, 32, submerge + 2);
      ctx.clip();
      ctx.globalAlpha = 0.28;
      drawBody();
      ctx.restore();
      ctx.globalAlpha = 1;
      spr(ctx, (this.anim | 0) % 2 ? 'ripple0' : 'ripple1', x - 7, y - submerge - 2, false, 0.9);
    } else {
      drawBody();
    }
  }
}
