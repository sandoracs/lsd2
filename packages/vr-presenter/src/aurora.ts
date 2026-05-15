import * as THREE from 'three';
import type { ColorFrame, ColoredNote } from '@lsd2/protocol';

const AURORA_DISTANCE = 8;
const BAND_BASE_WIDTH = 3.5;
const BAND_BASE_HEIGHT = 3.0;
const BAND_Y_BASE = 1.6;
const FADE_IN_MS = 80;
const FADE_OUT_MS = 600;
const ATTACK_THRESHOLD = 0.08; // amplitude delta that triggers a flash
const ATTACK_DECAY_MS = 180;   // how long the attack flash lasts

interface AuroraBand {
  mesh: THREE.Mesh;
  spawnedAt: number;
  expiresAt: number;
  peakAlpha: number;
  amplitude: number;
  attackAt: number;
  attackStrength: number; // 0–1, how hard the attack hit
}

function makeGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0,    'rgba(255,255,255,0)');
  grad.addColorStop(0.15, 'rgba(255,255,255,1)');
  grad.addColorStop(0.85, 'rgba(255,255,255,1)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(canvas);
}

function bandKey(note: ColoredNote): string {
  return `${note.note}${note.octave}`;
}

const BEAT_FLASH_MS = 350;

export class AuroraScene {
  private group = new THREE.Group();
  private bands = new Map<string, AuroraBand>();
  private gradientTex: THREE.CanvasTexture;
  private decayMs = 3000;
  private beatFlashAt = 0;
  private beatFlashStrength = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.gradientTex = makeGradientTexture();
  }

  setDecayMs(ms: number): void { this.decayMs = ms; }

  onBeat(intensity: number): void {
    this.beatFlashAt = performance.now();
    this.beatFlashStrength = intensity;
  }

  update(frame: ColorFrame): void {
    const now = performance.now();
    const allNotes = frame.silence ? [] : [frame.fundamental, ...frame.overtones];

    for (const note of allNotes) {
      const key = bandKey(note);
      const azimuth = (note.color.h / 360) * Math.PI * 2;
      const isOvertone = note !== frame.fundamental;
      const idx = isOvertone ? frame.overtones.indexOf(note) + 1 : 0;

      const widthScale  = isOvertone ? Math.max(0.25, 0.8 / (idx * 0.5 + 1)) : 1;
      const heightScale = isOvertone ? Math.max(0.25, 0.7 / (idx * 0.4 + 1)) : 1;
      const yOffset = (note.octave - 4) * 0.35;
      const peakAlpha = Math.max(0.3, Math.min(1, note.amplitude * 1.4));

      const existing = this.bands.get(key);
      if (existing) {
        const ampDelta = note.amplitude - existing.amplitude;
        if (ampDelta > ATTACK_THRESHOLD) {
          existing.attackAt = now;
          existing.attackStrength = Math.min(1, ampDelta / 0.5);
        }
        existing.amplitude = note.amplitude;
        existing.expiresAt = now + this.decayMs;
        existing.peakAlpha = peakAlpha;
        const mat = existing.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100);
      } else {
        const geo = new THREE.PlaneGeometry(
          BAND_BASE_WIDTH * widthScale,
          BAND_BASE_HEIGHT * heightScale,
        );
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100),
          map: this.gradientTex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const y = BAND_Y_BASE + yOffset;
        mesh.position.set(
          Math.sin(azimuth) * AURORA_DISTANCE,
          y,
          -Math.cos(azimuth) * AURORA_DISTANCE,
        );
        mesh.lookAt(0, y, 0);
        this.group.add(mesh);
        this.bands.set(key, {
          mesh,
          spawnedAt: now,
          expiresAt: now + this.decayMs,
          peakAlpha,
          amplitude: note.amplitude,
          // Treat spawning as a full attack
          attackAt: now,
          attackStrength: note.amplitude,
        });
      }
    }

    // Beat flash: uniform brightness boost across all bands
    const beatAge = now - this.beatFlashAt;
    const beatContrib = beatAge < BEAT_FLASH_MS
      ? this.beatFlashStrength * 0.9 * Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35))
      : 0;

    // Update every band's scale and opacity each frame
    for (const [key, band] of this.bands) {
      const mat = band.mesh.material as THREE.MeshBasicMaterial;
      const remaining = band.expiresAt - now;

      if (remaining <= 0) {
        this.group.remove(band.mesh);
        mat.dispose();
        band.mesh.geometry.dispose();
        this.bands.delete(key);
        continue;
      }

      // Fade-in
      const age = now - band.spawnedAt;
      const fadeIn = Math.min(1, age / FADE_IN_MS);

      // Fade-out: quadratic ease once inside the fade window
      const fadeOut = remaining < FADE_OUT_MS ? (remaining / FADE_OUT_MS) ** 2 : 1;

      // Attack flash: exponential overshoot that burns bright then decays
      const attackAge = now - band.attackAt;
      const flash = attackAge < ATTACK_DECAY_MS
        ? band.attackStrength * Math.exp(-attackAge / (ATTACK_DECAY_MS * 0.4))
        : 0;

      mat.opacity = Math.min(2, band.peakAlpha * fadeIn * fadeOut + flash + beatContrib);

      // Width breathes with amplitude (0.4–1.0 × base); height is steadier (0.7–1.0)
      const w = 0.4 + band.amplitude * 0.6;
      const h = 0.7 + band.amplitude * 0.3;
      band.mesh.scale.set(w, h, 1);
    }
  }

  dispose(): void {
    for (const band of this.bands.values()) {
      this.group.remove(band.mesh);
      (band.mesh.material as THREE.MeshBasicMaterial).dispose();
      band.mesh.geometry.dispose();
    }
    this.bands.clear();
    this.gradientTex.dispose();
  }
}
