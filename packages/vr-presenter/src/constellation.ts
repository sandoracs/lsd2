import * as THREE from 'three';
import type { ColorFrame, ColoredNote } from '@lsd2/protocol';

const DISTANCE = 7;
const BAND_Y_BASE = 1.6;
const FADE_IN_MS = 100;
const FADE_OUT_MS = 600;
const ATTACK_THRESHOLD = 0.08;
const ATTACK_DECAY_MS = 180;
const BEAT_FLASH_MS = 350;

interface Star {
  mesh: THREE.Mesh;
  spawnedAt: number;
  expiresAt: number;
  peakAlpha: number;
  amplitude: number;
  attackAt: number;
  attackStrength: number;
}

function starKey(note: ColoredNote): string {
  return `${note.note}${note.octave}`;
}

export class ConstellationScene {
  private group = new THREE.Group();
  private stars = new Map<string, Star>();
  private decayMs = 3000;
  private beatFlashAt = 0;
  private beatFlashStrength = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
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
      const key = starKey(note);
      const azimuth = (note.color.h / 360) * Math.PI * 2;
      const elevation = (note.octave - 4) * 0.28; // radians; keeps oct 3–6 in FOV
      const r = DISTANCE * Math.cos(elevation);
      const x = Math.sin(azimuth) * r;
      const y = BAND_Y_BASE + Math.sin(elevation) * DISTANCE;
      const z = -Math.cos(azimuth) * r;

      const isFundamental = note === frame.fundamental;
      const baseRadius = isFundamental ? 0.18 : 0.10;
      const peakAlpha = Math.max(0.35, Math.min(1, note.amplitude * 1.4));

      const existing = this.stars.get(key);
      if (existing) {
        const delta = note.amplitude - existing.amplitude;
        if (delta > ATTACK_THRESHOLD) {
          existing.attackAt = now;
          existing.attackStrength = Math.min(1, delta / 0.4);
        }
        existing.amplitude = note.amplitude;
        existing.expiresAt = now + this.decayMs;
        existing.peakAlpha = peakAlpha;
        const mat = existing.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100);
      } else {
        const geo = new THREE.SphereGeometry(baseRadius, 14, 10);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.group.add(mesh);
        this.stars.set(key, {
          mesh, spawnedAt: now, expiresAt: now + this.decayMs,
          peakAlpha, amplitude: note.amplitude,
          attackAt: now, attackStrength: note.amplitude,
        });
      }
    }

    const beatAge = now - this.beatFlashAt;
    const beatContrib = beatAge < BEAT_FLASH_MS
      ? this.beatFlashStrength * 0.9 * Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35))
      : 0;

    for (const [key, star] of this.stars) {
      const mat = star.mesh.material as THREE.MeshBasicMaterial;
      const remaining = star.expiresAt - now;

      if (remaining <= 0) {
        this.group.remove(star.mesh);
        mat.dispose();
        star.mesh.geometry.dispose();
        this.stars.delete(key);
        continue;
      }

      const fadeIn = Math.min(1, (now - star.spawnedAt) / FADE_IN_MS);
      const fadeOut = remaining < FADE_OUT_MS ? (remaining / FADE_OUT_MS) ** 2 : 1;
      const attackAge = now - star.attackAt;
      const flash = attackAge < ATTACK_DECAY_MS
        ? star.attackStrength * Math.exp(-attackAge / (ATTACK_DECAY_MS * 0.4))
        : 0;

      mat.opacity = Math.min(2, star.peakAlpha * fadeIn * fadeOut + flash + beatContrib);

      // Pulsing size: large on attack, breathes with amplitude
      const sizeScale = (0.5 + star.amplitude * 1.2) * (1 + flash * 0.6);
      star.mesh.scale.setScalar(sizeScale);
    }
  }

  dispose(): void {
    for (const star of this.stars.values()) {
      this.group.remove(star.mesh);
      (star.mesh.material as THREE.MeshBasicMaterial).dispose();
      star.mesh.geometry.dispose();
    }
    this.stars.clear();
  }
}
