import * as THREE from 'three';
import type { ColorFrame } from '@lsd2/protocol';

const AURORA_DISTANCE = 8;
const BAND_BASE_WIDTH = 3.5;
const BAND_BASE_HEIGHT = 2.5;
const BAND_Y_BASE = 1.6;

interface AuroraBand {
  mesh: THREE.Mesh;
  expiresAt: number;
}

function makeGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.3, 'rgba(255,255,255,1)');
  grad.addColorStop(0.7, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(canvas);
}

export class AuroraScene {
  private group = new THREE.Group();
  private bands = new Map<string, AuroraBand>();
  private gradientTex: THREE.CanvasTexture;
  private decayMs = 3000;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.gradientTex = makeGradientTexture();
  }

  setDecayMs(ms: number): void {
    this.decayMs = ms;
  }

  update(frame: ColorFrame): void {
    const now = performance.now();
    const allNotes = frame.silence ? [] : [frame.fundamental, ...frame.overtones];

    for (const note of allNotes) {
      const key = `${note.note}${note.octave}`;
      const azimuth = (note.color.h / 360) * Math.PI * 2;
      const isOvertone = note !== frame.fundamental;
      const idx = isOvertone ? frame.overtones.indexOf(note) + 1 : 0;

      const existing = this.bands.get(key);
      if (existing) {
        existing.expiresAt = now + this.decayMs;
        const mat = existing.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100);
      } else {
        const width = BAND_BASE_WIDTH * (isOvertone ? 0.6 / (idx * 0.4 + 1) : 1);
        const height = BAND_BASE_HEIGHT * (isOvertone ? 0.7 / (idx * 0.3 + 1) : 1);
        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100),
          map: this.gradientTex,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const yOffset = isOvertone ? idx * (BAND_BASE_HEIGHT * 0.5) : 0;
        mesh.position.set(
          Math.sin(azimuth) * AURORA_DISTANCE,
          BAND_Y_BASE + yOffset,
          -Math.cos(azimuth) * AURORA_DISTANCE,
        );
        mesh.lookAt(0, BAND_Y_BASE + yOffset, 0);
        this.group.add(mesh);
        this.bands.set(key, { mesh, expiresAt: now + this.decayMs });
      }
    }

    // fade & remove expired bands
    for (const [key, band] of this.bands) {
      const remaining = band.expiresAt - now;
      if (remaining <= 0) {
        this.group.remove(band.mesh);
        (band.mesh.material as THREE.MeshBasicMaterial).dispose();
        band.mesh.geometry.dispose();
        this.bands.delete(key);
      } else {
        const alpha = Math.min(1, remaining / 400);
        (band.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
      }
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
