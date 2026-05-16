import type { ColorFrame } from '@lsd2/protocol';
import type { Scene2D } from '../scene.js';

const FADE_MS = 600;
const BEAT_FLASH_MS = 350;

interface OrbState {
  h: number; s: number; l: number;
  rings: Array<{ h: number; s: number; l: number; angle: number; speed: number; radius: number }>;
  createdAt: number;
  fadingAt: number | null;
}

export class Orbital2D implements Scene2D {
  private current: OrbState | null = null;
  private fading: OrbState[] = [];
  private decayMs = 3000;
  private lastKey = '';
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private beatFlashAt = 0;
  private beatFlashStrength = 0;
  private lastTime = performance.now();

  setDecayMs(ms: number): void { this.decayMs = ms; }
  onBeat(i: number): void { this.beatFlashAt = performance.now(); this.beatFlashStrength = i; }

  update(frame: ColorFrame): void {
    const key = frame.silence ? '' : `${frame.fundamental.note}${frame.fundamental.octave}`;
    if (frame.silence) {
      if (this.current && !this.current.fadingAt && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => this.fadeCurrent(), this.decayMs);
      }
    } else {
      if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
      if (key !== this.lastKey) {
        this.fadeCurrent();
        const notes = [frame.fundamental, ...frame.overtones].slice(0, 5);
        const speeds = [0.4, 0.7, 1.1, 1.6, 2.1];
        const radii  = [0.14, 0.22, 0.30, 0.39, 0.48]; // fraction of minDim
        this.current = {
          h: frame.fundamental.color.h, s: frame.fundamental.color.s, l: frame.fundamental.color.l,
          rings: notes.map((n, i) => ({
            h: n.color.h, s: n.color.s, l: n.color.l,
            angle: Math.random() * Math.PI * 2, speed: speeds[i], radius: radii[i],
          })),
          createdAt: performance.now(), fadingAt: null,
        };
        this.lastKey = key;
      }
    }
  }

  private fadeCurrent(): void {
    if (!this.current) return;
    this.current.fadingAt = performance.now();
    this.fading.push(this.current);
    this.current = null; this.lastKey = '';
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const cx = w / 2, cy = h / 2;
    const minD = Math.min(w, h);
    const beatAge = now - this.beatFlashAt;
    const beatScale = beatAge < BEAT_FLASH_MS
      ? 1 + this.beatFlashStrength * 0.25 * Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35)) : 1;

    const drawOrb = (orb: OrbState, alpha: number) => {
      const scale = alpha * beatScale;
      const coreR = minD * 0.04 * scale;
      // Glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 4);
      grd.addColorStop(0, `hsla(${orb.h},${orb.s}%,${orb.l}%,${(alpha * 0.4).toFixed(3)})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, coreR * 4, 0, Math.PI * 2); ctx.fill();
      // Core disc
      ctx.fillStyle = `hsla(${orb.h},${orb.s}%,${orb.l}%,${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
      // Rings
      for (const ring of orb.rings) {
        ring.angle += ring.speed * dt;
        const r = minD * ring.radius * scale;
        const ox = Math.cos(ring.angle) * r * 0.18;
        const oy = Math.sin(ring.angle) * r * 0.18;
        ctx.strokeStyle = `hsla(${ring.h},${ring.s}%,${ring.l}%,${(alpha * 0.7).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, minD * 0.005);
        ctx.beginPath(); ctx.ellipse(cx + ox * 0.2, cy + oy * 0.2, r, r * 0.35, ring.angle * 0.3, 0, Math.PI * 2); ctx.stroke();
      }
    };

    if (this.current) drawOrb(this.current, 1);

    this.fading = this.fading.filter(orb => {
      const elapsed = now - orb.fadingAt!;
      const alpha = Math.max(0, 1 - elapsed / FADE_MS);
      if (alpha > 0) { drawOrb(orb, alpha); return true; }
      return false;
    });
  }

  dispose(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.current = null; this.fading = [];
  }
}
