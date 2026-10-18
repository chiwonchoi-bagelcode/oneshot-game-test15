// Particles, floating pickups, footprints and screen shake. Pooled and capped so big moments stay smooth.
import { spr, sprC } from '../core/assets.js';

const rmq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduceMotion = () => !!(rmq && rmq.matches);

const MAX_PARTS = 220;

export class FX {
  constructor() {
    this.parts = [];
    this.floaters = [];
    this.prints = [];
    this.flyers = [];
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.quality = 1; // 1 = high, 0.5 = low (fewer particles)
  }
  clear() {
    this.parts.length = 0;
    this.floaters.length = 0;
    this.prints.length = 0;
    this.flyers.length = 0;
    this.shakeAmp = 0;
  }
  add(p) {
    if (this.parts.length >= MAX_PARTS * this.quality) this.parts.shift();
    p.age = 0;
    this.parts.push(p);
    return p;
  }
  burst(x, y, n, opts = {}) {
    n = Math.max(1, Math.round(n * this.quality));
    for (let i = 0; i < n; i++) {
      const a = (opts.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (opts.spread ?? Math.PI * 2);
      const s = (opts.speed ?? 40) * (0.5 + Math.random() * 0.7);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        g: opts.gravity ?? 120, life: (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        sprite: opts.sprites ? opts.sprites[(Math.random() * opts.sprites.length) | 0] : null,
        color: opts.colors ? opts.colors[(Math.random() * opts.colors.length) | 0] : '#ffffff',
        size: opts.size ?? 1, drag: opts.drag ?? 0.9, anim: opts.anim || null, fade: opts.fade ?? true,
      });
    }
  }
  anim(x, y, frames, fps, opts = {}) {
    return this.add({ x, y, vx: 0, vy: 0, g: 0, life: frames.length / fps, anim: frames, fps, sprite: null, drag: 1, fade: false, front: opts.front ?? true });
  }
  floater(x, y, icon, text, color = '#ffffff') {
    this.floaters.push({ x, y, icon, text, color, age: 0, life: 0.9 });
    if (this.floaters.length > 14) this.floaters.shift();
  }
  // item that flies from world pos to a target (the sack)
  fly(sprite, x, y, target, dur = 0.32) {
    this.flyers.push({ sprite, x0: x, y0: y, target, age: 0, dur });
  }
  footprint(x, y, kind, flip) {
    this.prints.push({ x, y, kind, flip, age: 0 });
    if (this.prints.length > 160) this.prints.shift();
  }
  shake(amp, time = 0.25) {
    // the OS "reduce motion" setting keeps only a hint of the shake
    if (reduceMotion()) amp *= 0.25;
    this.shakeAmp = Math.max(this.shakeAmp, amp * this.quality + (1 - this.quality) * amp * 0.5);
    this.shakeT = Math.max(this.shakeT, time);
  }
  shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    const a = this.shakeAmp * Math.min(1, this.shakeT * 4);
    return [Math.round((Math.random() - 0.5) * 2 * a), Math.round((Math.random() - 0.5) * 2 * a)];
  }
  update(dt) {
    this.shakeT = Math.max(0, this.shakeT - dt);
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt;
      const dr = Math.pow(p.drag, dt * 60);
      p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += dt;
      if (f.age >= f.life) this.floaters.splice(i, 1);
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.age += dt;
      if (f.age >= f.dur) this.flyers.splice(i, 1);
    }
    for (const p of this.prints) p.age += dt;
  }
  drawPrints(ctx, cx, cy) {
    for (const p of this.prints) {
      if (p.age > 24) continue;
      const a = p.age < 16 ? 0.7 : 0.7 * (1 - (p.age - 16) / 8);
      spr(ctx, p.kind === 'mud' ? 'footprint_mud' : 'footprint', p.x - 3 - cx, p.y - 2 - cy, p.flip, a);
    }
  }
  drawParts(ctx, cx, cy, front) {
    for (const p of this.parts) {
      if (!!p.front !== front && p.anim) continue;
      const k = p.age / p.life;
      if (p.anim) {
        const fi = Math.min(p.anim.length - 1, (p.age * p.fps) | 0);
        sprC(ctx, p.anim[fi], p.x - cx, p.y - cy);
        continue;
      }
      if (!front) continue;
      const alpha = p.fade ? Math.max(0, 1 - k * k) : 1;
      if (p.sprite) {
        sprC(ctx, p.sprite, p.x - cx, p.y - cy, false, alpha);
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), s, s);
        ctx.globalAlpha = 1;
      }
    }
  }
  drawFlyers(ctx, cx, cy) {
    for (const f of this.flyers) {
      const k = f.age / f.dur;
      const tx = f.target.x, ty = f.target.y - 14;
      const x = f.x0 + (tx - f.x0) * k;
      const y = f.y0 + (ty - f.y0) * k - Math.sin(k * Math.PI) * 18;
      sprC(ctx, f.sprite, x - cx, y - cy, false, 1 - k * 0.3);
    }
  }
  drawFloaters(ctx, cx, cy, drawText) {
    for (const f of this.floaters) {
      const k = f.age / f.life;
      const y = f.y - 10 - k * 14 - cy;
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      drawText(ctx, f.text, f.x - cx, y, f.color, a, f.icon);
    }
  }
}
