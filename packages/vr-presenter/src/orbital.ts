import * as THREE from 'three';
import type { ColorFrame } from '@lsd2/protocol';

const SPHERE_POSITION = new THREE.Vector3(0, 1.6, -3);
const FADE_MS = 600;
const BEAT_FLASH_MS = 350;

interface OrbitalGroup {
  group: THREE.Group;
  light: THREE.PointLight;
  startedFadingAt: number | null;
}

function makeOrbitalGroup(frame: ColorFrame): { group: THREE.Group; light: THREE.PointLight } {
  const group = new THREE.Group();
  group.position.copy(SPHERE_POSITION);

  const { h, s, l } = frame.fundamental.color;
  const color = new THREE.Color().setHSL(h / 360, s / 100, l / 100);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 32, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }),
  );
  group.add(sphere);

  const speeds = [0.4, 0.7, 1.1, 1.6];
  const radii = [0.55, 0.8, 1.1, 1.45];
  const tiltAxes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0.7, 0.7, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0.5, 0.5, 0.7).normalize(),
  ];
  const notes = frame.silence ? [] : [frame.fundamental, ...frame.overtones].slice(0, 4);

  for (let i = 0; i < Math.min(notes.length, 4); i++) {
    const nc = notes[i].color;
    const ringColor = new THREE.Color().setHSL(nc.h / 360, nc.s / 100, nc.l / 100);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radii[i], 0.018, 8, 64),
      new THREE.MeshStandardMaterial({ color: ringColor, emissive: ringColor, emissiveIntensity: 0.3 }),
    );
    ring.setRotationFromAxisAngle(tiltAxes[i], (i * Math.PI) / 5);
    ring.userData['isRing'] = true;
    ring.userData['speed'] = speeds[i];
    group.add(ring);
  }

  const light = new THREE.PointLight(color, 1.5, 6);
  light.position.copy(SPHERE_POSITION);

  return { group, light };
}

export class OrbitalScene {
  private scene: THREE.Scene;
  private current: OrbitalGroup | null = null;
  private fading: OrbitalGroup[] = [];
  private lastKey = '';
  private decayMs = 3000;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private beatFlashAt = 0;
  private beatFlashStrength = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setDecayMs(ms: number): void { this.decayMs = ms; }

  onBeat(intensity: number): void {
    this.beatFlashAt = performance.now();
    this.beatFlashStrength = intensity;
  }

  update(frame: ColorFrame, delta: number): void {
    const key = frame.silence ? '' : `${frame.fundamental.note}${frame.fundamental.octave}`;

    if (frame.silence) {
      if (this.current && !this.current.startedFadingAt) {
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => this.startFadeCurrent(), this.decayMs);
        }
      }
    } else {
      if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
      if (key !== this.lastKey) {
        this.startFadeCurrent();
        const { group, light } = makeOrbitalGroup(frame);
        this.current = { group, light, startedFadingAt: null };
        this.scene.add(group);
        this.scene.add(light);
        this.lastKey = key;
      }
    }

    // Beat pulse: scale up the whole group on kick
    const beatAge = performance.now() - this.beatFlashAt;
    const beatScale = beatAge < BEAT_FLASH_MS
      ? 1 + this.beatFlashStrength * 0.35 * Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35))
      : 1;
    if (this.current && !this.current.startedFadingAt) {
      this.current.group.scale.setScalar(beatScale);
      const beatExpFactor = Math.exp(-beatAge / (BEAT_FLASH_MS * 0.35));
      this.current.light.intensity = 1.5 * (1 + this.beatFlashStrength * 1.5 * beatExpFactor);
    }

    // rotate rings on current group
    if (this.current && !this.current.startedFadingAt) {
      for (const child of this.current.group.children) {
        if (child.userData['isRing']) {
          child.rotation.z += child.userData['speed'] as number * delta;
        }
      }
    }

    // animate fading groups
    const now = performance.now();
    this.fading = this.fading.filter(og => {
      const elapsed = now - og.startedFadingAt!;
      const alpha = Math.max(0, 1 - elapsed / FADE_MS);
      og.group.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = alpha;
        }
      });
      og.light.intensity = alpha * 1.5;
      if (alpha <= 0) {
        this.disposeGroup(og);
        return false;
      }
      return true;
    });
  }

  private startFadeCurrent(): void {
    if (!this.current) return;
    this.current.startedFadingAt = performance.now();
    this.fading.push(this.current);
    this.current = null;
    this.lastKey = '';
  }

  private disposeGroup(og: OrbitalGroup): void {
    this.scene.remove(og.group);
    this.scene.remove(og.light);
    og.group.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
        ((obj as THREE.Mesh).material as THREE.Material).dispose();
      }
    });
  }

  dispose(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.current) this.disposeGroup(this.current);
    for (const og of this.fading) this.disposeGroup(og);
    this.fading = [];
    this.current = null;
  }
}
