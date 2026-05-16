import * as THREE from 'three';
import type { ColorFrame } from '@lsd2/protocol';

const MAX_PARTICLES = 2000;
const RING_INNER = 0.7;
const RING_OUTER = 2.2;
const BASE_Y = 0.0;
const MAX_HEIGHT = 4.5;
const SPAWN_RATE = 110; // particles/sec at full amplitude
const BEAT_BURST = 220;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number;
  maxAge: number;
  hue: number;
}

function makeSpotTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.45,'rgba(255,255,255,0.6)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

export class FireScene {
  private group = new THREE.Group();
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;
  private tex: THREE.CanvasTexture;
  private decayMs = 3000;
  private lastTime = performance.now();
  private spawnAccum = 0;
  private amplitude = 0;
  private noteHue = 30;
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);

    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors    = new Float32Array(MAX_PARTICLES * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color',    new THREE.BufferAttribute(this.colors,    3));

    this.tex = makeSpotTexture();
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: this.tex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, mat);
    this.group.add(this.points);
  }

  setDecayMs(ms: number): void { this.decayMs = ms; }

  onBeat(intensity: number): void {
    const count = Math.floor(BEAT_BURST * (0.4 + intensity * 0.6));
    for (let i = 0; i < count; i++) this.spawnOne(true, intensity);
  }

  private spawnOne(burst = false, burstStr = 0): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const angle = Math.random() * Math.PI * 2;
    const r = RING_INNER + Math.random() * (RING_OUTER - RING_INNER);
    const riseSpeed = 0.5 + Math.random() * 0.9 + this.amplitude * 1.5 + (burst ? burstStr * 2.5 : 0);
    this.particles.push({
      x: Math.cos(angle) * r,
      y: BASE_Y,
      z: Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.45,
      vy: riseSpeed,
      vz: (Math.random() - 0.5) * 0.45,
      age: 0,
      maxAge: (1.0 + Math.random() * 1.2) / (0.4 + this.amplitude * 0.35),
      hue: this.noteHue,
    });
  }

  update(frame: ColorFrame): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (!frame.silence) {
      this.amplitude = frame.fundamental.amplitude;
      this.noteHue   = frame.fundamental.color.h;
    } else {
      this.amplitude = Math.max(0, this.amplitude - dt);
    }

    // Spawn
    this.spawnAccum += SPAWN_RATE * (0.25 + this.amplitude * 0.75) * dt;
    while (this.spawnAccum >= 1) { this.spawnOne(); this.spawnAccum -= 1; }

    // Simulate and rebuild buffer in one pass
    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.maxAge || p.y > MAX_HEIGHT) continue;

      // Turbulent sideways drift
      p.vx += (Math.random() - 0.5) * 0.18;
      p.vz += (Math.random() - 0.5) * 0.18;
      p.vx *= 0.95;
      p.vz *= 0.95;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.z  += p.vz * dt;

      // Color gradient: white-hot base → orange mid → note-hued fading tip
      const t = p.age / p.maxAge;
      let h: number, s: number, l: number;
      if (t < 0.2) {
        h = 55;
        s = 0.7;
        l = THREE.MathUtils.lerp(0.98, 0.75, t / 0.2);
      } else if (t < 0.6) {
        const st = (t - 0.2) / 0.4;
        h = THREE.MathUtils.lerp(45, p.hue, st);
        s = 1.0;
        l = THREE.MathUtils.lerp(0.70, 0.45, st);
      } else {
        const st = (t - 0.6) / 0.4;
        h = p.hue;
        s = 0.85;
        l = THREE.MathUtils.lerp(0.38, 0.02, st);
      }

      this.tmpColor.setHSL(h / 360, s, l);

      const b3 = writeIdx * 3;
      this.positions[b3]     = p.x;
      this.positions[b3 + 1] = p.y;
      this.positions[b3 + 2] = p.z;
      this.colors[b3]        = this.tmpColor.r;
      this.colors[b3 + 1]    = this.tmpColor.g;
      this.colors[b3 + 2]    = this.tmpColor.b;

      // Compact alive particle in-place
      if (writeIdx !== i) this.particles[writeIdx] = p;
      writeIdx++;
    }
    this.particles.length = writeIdx;

    this.geometry.setDrawRange(0, writeIdx);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate    = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
    this.tex.dispose();
    this.particles = [];
  }
}
