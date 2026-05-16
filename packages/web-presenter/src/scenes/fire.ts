import type { ColorFrame } from '@lsd2/protocol';
import type { Scene2D } from '../scene.js';

const MAX_P = 1800;
const SPAWN_RATE = 90;
const BEAT_BURST = 180;

interface P { x: number; y: number; vx: number; vy: number; age: number; maxAge: number; hue: number }

export class Fire2D implements Scene2D {
  private ps: P[] = [];
  private decayMs = 3000;
  private lastTime = performance.now();
  private spawnAccum = 0;
  private amplitude = 0;
  private noteHue = 30;

  setDecayMs(ms: number): void { this.decayMs = ms; }

  onBeat(intensity: number): void {
    const count = Math.floor(BEAT_BURST * (0.4 + intensity * 0.6));
    for (let i = 0; i < count; i++) this.spawnOne(true, intensity);
  }

  private spawnOne(burst = false, burstStr = 0, w = 1, h = 1): void {
    if (this.ps.length >= MAX_P) return;
    const vy = -(0.4 + Math.random() * 0.6 + this.amplitude * 1.2 + (burst ? burstStr * 1.8 : 0)) * h * 0.4;
    this.ps.push({
      x: w * (0.2 + Math.random() * 0.6),
      y: h,
      vx: (Math.random() - 0.5) * w * 0.04,
      vy,
      age: 0,
      maxAge: (1.0 + Math.random() * 1.2) / (0.4 + this.amplitude * 0.3),
      hue: this.noteHue,
    });
  }

  update(frame: ColorFrame): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (!frame.silence) { this.amplitude = frame.fundamental.amplitude; this.noteHue = frame.fundamental.color.h; }
    else { this.amplitude = Math.max(0, this.amplitude - dt); }
    this.spawnAccum += SPAWN_RATE * (0.25 + this.amplitude * 0.75) * dt;
    // We don't know canvas size here — use normalised coords; scale in draw()
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);

    while (this.spawnAccum >= 1) { this.spawnOne(false, 0, w, h); this.spawnAccum -= 1; }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    let writeIdx = 0;
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      p.age += dt;
      if (p.age >= p.maxAge || p.y < 0) continue;
      p.vx += (Math.random() - 0.5) * w * 0.012;
      p.vx *= 0.94;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      const t = p.age / p.maxAge;
      let hue: number, s: number, l: number;
      if (t < 0.2)       { hue = 55;  s = 0.7;  l = 0.97 - t / 0.2 * 0.25; }
      else if (t < 0.6)  { const st = (t - 0.2) / 0.4; hue = 45 + st * (p.hue - 45); s = 1; l = 0.68 - st * 0.22; }
      else               { const st = (t - 0.6) / 0.4; hue = p.hue; s = 0.85; l = 0.4 - st * 0.38; }
      const r = Math.max(2, (1 - t) * 6);
      ctx.fillStyle = `hsla(${hue},${(s * 100).toFixed(0)}%,${(l * 100).toFixed(0)}%,${(0.7 * (1 - t)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      if (writeIdx !== i) this.ps[writeIdx] = p;
      writeIdx++;
    }
    this.ps.length = writeIdx;
    ctx.restore();
  }

  dispose(): void { this.ps = []; }
}
