import type { ColorFrame } from '@lsd2/protocol';
import type { Scene2D } from '../scene.js';

const FADE_IN_MS = 100;
const FADE_OUT_MS = 600;
const ATTACK_THRESHOLD = 0.08;
const ATTACK_DECAY_MS = 180;
const BEAT_FLASH_MS = 350;

interface Star {
  nx: number; ny: number; // normalised 0-1
  h: number; s: number; l: number;
  amplitude: number; spawnedAt: number; expiresAt: number;
  peakAlpha: number; attackAt: number; attackStrength: number;
  isFundamental: boolean;
}

export class Constellation2D implements Scene2D {
  private stars = new Map<string, Star>();
  private decayMs = 3000;
  private beatFlashAt = 0;
  private beatFlashStrength = 0;

  setDecayMs(ms: number): void { this.decayMs = ms; }
  onBeat(i: number): void { this.beatFlashAt = performance.now(); this.beatFlashStrength = i; }

  update(frame: ColorFrame): void {
    const now = performance.now();
    const notes = frame.silence ? [] : [frame.fundamental, ...frame.overtones];
    for (const note of notes) {
      const key = `${note.note}${note.octave}`;
      // x: hue → left-to-right; y: octave → top-to-bottom (high=top)
      const nx = note.color.h / 360;
      const ny = 1 - Math.min(1, Math.max(0, (note.octave - 2) / 6));
      const peakAlpha = Math.max(0.4, Math.min(1, note.amplitude * 1.4));
      const existing = this.stars.get(key);
      if (existing) {
        const d = note.amplitude - existing.amplitude;
        if (d > ATTACK_THRESHOLD) { existing.attackAt = now; existing.attackStrength = Math.min(1, d / 0.4); }
        existing.amplitude = note.amplitude; existing.expiresAt = now + this.decayMs;
        existing.peakAlpha = peakAlpha; existing.h = note.color.h; existing.s = note.color.s; existing.l = note.color.l;
      } else {
        this.stars.set(key, {
          nx, ny, h: note.color.h, s: note.color.s, l: note.color.l,
          amplitude: note.amplitude, spawnedAt: now, expiresAt: now + this.decayMs,
          peakAlpha, attackAt: now, attackStrength: note.amplitude,
          isFundamental: note === frame.fundamental,
        });
      }
    }
    for (const [k, s] of this.stars) if (now >= s.expiresAt) this.stars.delete(k);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const now = performance.now();
    const beatAge = now - this.beatFlashAt;
    const beatBoost = beatAge < BEAT_FLASH_MS
      ? this.beatFlashStrength * 0.8 * Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35)) : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.stars.values()) {
      const remaining = star.expiresAt - now;
      if (remaining <= 0) continue;
      const fadeIn  = Math.min(1, (now - star.spawnedAt) / FADE_IN_MS);
      const fadeOut = remaining < FADE_OUT_MS ? (remaining / FADE_OUT_MS) ** 2 : 1;
      const attackAge = now - star.attackAt;
      const flash = attackAge < ATTACK_DECAY_MS ? star.attackStrength * Math.exp(-attackAge / (ATTACK_DECAY_MS * 0.4)) : 0;
      const alpha = Math.min(1.5, star.peakAlpha * fadeIn * fadeOut + flash + beatBoost);
      const sizeScale = (0.5 + star.amplitude * 1.2) * (1 + flash * 0.6);
      const baseR = (star.isFundamental ? 0.022 : 0.013) * Math.min(w, h);
      const r = baseR * sizeScale;
      const x = star.nx * w;
      const y = star.ny * h;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      grad.addColorStop(0,   `hsla(${star.h},${star.s}%,${star.l}%,${Math.min(1, alpha).toFixed(3)})`);
      grad.addColorStop(0.4, `hsla(${star.h},${star.s}%,${star.l}%,${(Math.min(1, alpha) * 0.4).toFixed(3)})`);
      grad.addColorStop(1,   `hsla(${star.h},${star.s}%,${star.l}%,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  dispose(): void { this.stars.clear(); }
}
