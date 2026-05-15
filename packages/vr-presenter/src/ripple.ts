import * as THREE from 'three';
import type { ColorFrame } from '@lsd2/protocol';

const BAND_Y_BASE = 1.6;
const START_RADIUS = 0.25;
const MAX_RADIUS = 9;
const ATTACK_THRESHOLD = 0.08;

interface Ring {
  mesh: THREE.Mesh;
  spawnedAt: number;
  lifetime: number;
}

export class RippleScene {
  private group = new THREE.Group();
  private rings: Ring[] = [];
  private decayMs = 3000;
  private lastKey = '';
  private lastSilence = true;
  private lastAmplitude = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  setDecayMs(ms: number): void { this.decayMs = ms; }

  onBeat(intensity: number): void {
    const now = performance.now();
    const lifetime = 600 + intensity * 400;
    const geo = new THREE.TorusGeometry(START_RADIUS * 0.5, 0.025, 6, 100);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      opacity: Math.min(1, 0.5 + intensity * 0.5),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = BAND_Y_BASE;
    this.group.add(mesh);
    this.rings.push({ mesh, spawnedAt: now, lifetime });
  }

  update(frame: ColorFrame): void {
    const now = performance.now();

    if (!frame.silence) {
      const key = `${frame.fundamental.note}${frame.fundamental.octave}`;
      const amp = frame.fundamental.amplitude;
      const isNewNote = this.lastSilence || key !== this.lastKey;
      const isAttack = !isNewNote && (amp - this.lastAmplitude) > ATTACK_THRESHOLD;

      if (isNewNote || isAttack) {
        const allNotes = [frame.fundamental, ...frame.overtones.slice(0, 5)];
        allNotes.forEach((note, i) => {
          const lifetime = this.decayMs * (0.4 + note.amplitude * 0.6);
          const geo = new THREE.TorusGeometry(START_RADIUS + i * 0.05, 0.012, 6, 80);
          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(note.color.h / 360, note.color.s / 100, note.color.l / 100),
            transparent: true,
            opacity: note.amplitude,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = Math.PI / 2; // lay flat in XZ plane
          mesh.position.y = BAND_Y_BASE;
          this.group.add(mesh);
          this.rings.push({ mesh, spawnedAt: now, lifetime });
        });
      }

      this.lastKey = key;
      this.lastAmplitude = amp;
      this.lastSilence = false;
    } else {
      this.lastSilence = true;
      this.lastAmplitude = 0;
    }

    // Animate rings: expand and fade
    this.rings = this.rings.filter(ring => {
      const elapsed = now - ring.spawnedAt;
      if (elapsed >= ring.lifetime) {
        this.group.remove(ring.mesh);
        (ring.mesh.material as THREE.MeshBasicMaterial).dispose();
        ring.mesh.geometry.dispose();
        return false;
      }
      const t = elapsed / ring.lifetime;
      const scale = 1 + t * (MAX_RADIUS / START_RADIUS - 1);
      ring.mesh.scale.set(scale, 1, scale); // expand radius only, keep tube thickness
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) ** 1.5;
      return true;
    });
  }

  dispose(): void {
    for (const ring of this.rings) {
      this.group.remove(ring.mesh);
      (ring.mesh.material as THREE.MeshBasicMaterial).dispose();
      ring.mesh.geometry.dispose();
    }
    this.rings = [];
  }
}
