import type { ColorFrame } from '@lsd2/protocol';
import type { Scene2D } from '../scene.js';

const FADE_IN_MS = 80;
const FADE_OUT_MS = 600;
const ATTACK_THRESHOLD = 0.08;
const ATTACK_DECAY_MS = 180;
const BEAT_FLASH_MS = 350;
const BAND_W_FRAC = 0.09;

interface Band {
  x: number; h: number; s: number; l: number;
  amplitude: number; spawnedAt: number; expiresAt: number;
  peakAlpha: number; attackAt: number; attackStrength: number;
}

export class Aurora2D implements Scene2D {
  private bands = new Map<string, Band>();
  private decayMs = 3000;
  private beatFlashAt = 0;
  private beatFlashStrength = 0;

  setDecayMs(ms: number): void { this.decayMs = ms; }
  onBeat(intensity: number): void { this.beatFlashAt = performance.now(); this.beatFlashStrength = intensity; }

  update(frame: ColorFrame): void {
    const now = performance.now();
    const notes = frame.silence ? [] : [frame.fundamental, ...frame.overtones];
    for (const note of notes) {
      const key = `${note.note}${note.octave}`;
      const peakAlpha = Math.max(0.3, Math.min(1, note.amplitude * 1.4));
      const existing = this.bands.get(key);
      if (existing) {
        const d = note.amplitude - existing.amplitude;
        if (d > ATTACK_THRESHOLD) { existing.attackAt = now; existing.attackStrength = Math.min(1, d / 0.5); }
        existing.amplitude = note.amplitude; existing.expiresAt = now + this.decayMs;
        existing.peakAlpha = peakAlpha; existing.h = note.color.h; existing.s = note.color.s; existing.l = note.color.l;
      } else {
        this.bands.set(key, {
          x: note.color.h / 360, h: note.color.h, s: note.color.s, l: note.color.l,
          amplitude: note.amplitude, spawnedAt: now, expiresAt: now + this.decayMs,
          peakAlpha, attackAt: now, attackStrength: note.amplitude,
        });
      }
    }
    for (const [k, b] of this.bands) if (now >= b.expiresAt) this.bands.delete(k);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const now = performance.now();
    const beatAge = now - this.beatFlashAt;
    const beatBoost = beatAge < BEAT_FLASH_MS
      ? this.beatFlashStrength * 0.5 * Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35)) : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bands.values()) {
      const remaining = b.expiresAt - now;
      if (remaining <= 0) continue;
      const fadeIn  = Math.min(1, (now - b.spawnedAt) / FADE_IN_MS);
      const fadeOut = remaining < FADE_OUT_MS ? (remaining / FADE_OUT_MS) ** 2 : 1;
      const attackAge = now - b.attackAt;
      const flash = attackAge < ATTACK_DECAY_MS ? b.attackStrength * Math.exp(-attackAge / (ATTACK_DECAY_MS * 0.4)) : 0;
      const alpha = Math.min(0.85, b.peakAlpha * fadeIn * fadeOut + flash * 0.35 + beatBoost * 0.3);
      const bw = w * BAND_W_FRAC * (0.4 + b.amplitude * 0.6);
      const cx = b.x * w;
      const grad = ctx.createLinearGradient(cx, 0, cx, h);
      const c = `hsla(${b.h},${b.s}%,${b.l}%,`;
      grad.addColorStop(0,    `${c}0)`);
      grad.addColorStop(0.12, `${c}${alpha.toFixed(3)})`);
      grad.addColorStop(0.88, `${c}${alpha.toFixed(3)})`);
      grad.addColorStop(1,    `${c}0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - bw / 2, 0, bw, h);
    }
    ctx.restore();
  }

  dispose(): void { this.bands.clear(); }
}
