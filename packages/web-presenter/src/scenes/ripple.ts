import type { ColorFrame } from '@lsd2/protocol';
import type { Scene2D } from '../scene.js';

const ATTACK_THRESHOLD = 0.08;

interface Ring {
  h: number; s: number; l: number;
  spawnedAt: number; lifetime: number; amplitude: number;
  isBeat: boolean;
}

export class Ripple2D implements Scene2D {
  private rings: Ring[] = [];
  private decayMs = 3000;
  private lastKey = '';
  private lastSilence = true;
  private lastAmplitude = 0;

  setDecayMs(ms: number): void { this.decayMs = ms; }

  onBeat(intensity: number): void {
    this.rings.push({
      h: 60, s: 20, l: 90, amplitude: intensity,
      spawnedAt: performance.now(), lifetime: 600 + intensity * 400, isBeat: true,
    });
  }

  update(frame: ColorFrame): void {
    const now = performance.now();
    if (!frame.silence) {
      const key = `${frame.fundamental.note}${frame.fundamental.octave}`;
      const amp = frame.fundamental.amplitude;
      const isNew = this.lastSilence || key !== this.lastKey;
      const isAttack = !isNew && (amp - this.lastAmplitude) > ATTACK_THRESHOLD;
      if (isNew || isAttack) {
        const notes = [frame.fundamental, ...frame.overtones.slice(0, 5)];
        for (const note of notes) {
          this.rings.push({
            h: note.color.h, s: note.color.s, l: note.color.l,
            amplitude: note.amplitude, spawnedAt: now,
            lifetime: this.decayMs * (0.4 + note.amplitude * 0.6), isBeat: false,
          });
        }
      }
      this.lastKey = key; this.lastAmplitude = amp; this.lastSilence = false;
    } else {
      this.lastSilence = true; this.lastAmplitude = 0;
    }
    this.rings = this.rings.filter(r => performance.now() - r.spawnedAt < r.lifetime);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const now = performance.now();
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ring of this.rings) {
      const t = (now - ring.spawnedAt) / ring.lifetime;
      const r = (ring.isBeat ? 0 : 20) + t * maxR;
      const alpha = ((1 - t) ** 1.5) * ring.amplitude * 0.8;
      const lw = ring.isBeat ? 4 : Math.max(1, 12 * ring.amplitude * (1 - t));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${ring.h},${ring.s}%,${ring.l}%,${alpha.toFixed(3)})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  }

  dispose(): void { this.rings = []; }
}
