import * as THREE from 'three';

const CANVAS_W = 512;
const CANVAS_H = 128;
const PLANE_W  = 1.2;
const PLANE_H  = PLANE_W * (CANVAS_H / CANVAS_W);
const FADE_IN  = 8.0;  // opacity/sec
const FADE_OUT = 2.0;

export class ChordDisplay {
  private mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private opacity = 0;
  private targetOpacity = 0;
  private currentChord = '';
  private lastChordAt = 0;
  private lastTime = performance.now();
  private decayMs = 3000;

  constructor(scene: THREE.Scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width  = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), mat);
    // Float slightly above eye level, 2.8 m ahead
    this.mesh.position.set(0, 2.1, -2.8);
    this.mesh.lookAt(0, 1.6, 0);
    scene.add(this.mesh);
  }

  setDecayMs(ms: number): void { this.decayMs = ms; }

  update(chord: string | null): void {
    const now = performance.now();
    const dt  = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (chord !== null) {
      this.lastChordAt = now;
      this.targetOpacity = 1;
      if (chord !== this.currentChord) {
        this.currentChord = chord;
        this.draw(chord);
        this.texture.needsUpdate = true;
      }
    } else if (now - this.lastChordAt > this.decayMs) {
      this.targetOpacity = 0;
    }

    if (this.opacity < this.targetOpacity) {
      this.opacity = Math.min(this.targetOpacity, this.opacity + FADE_IN * dt);
    } else {
      this.opacity = Math.max(this.targetOpacity, this.opacity - FADE_OUT * dt);
    }
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = this.opacity;
  }

  private draw(chord: string): void {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark pill background
    const pad = 10;
    ctx.fillStyle = 'rgba(5, 5, 30, 0.88)';
    ctx.beginPath();
    const r = CANVAS_H / 2 - pad;
    ctx.roundRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, r);
    ctx.fill();

    // Fit font to canvas width
    let fontSize = Math.floor(canvas.height * 0.58);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const w = ctx.measureText(chord).width;
    if (w > canvas.width - 60) {
      fontSize = Math.floor(fontSize * (canvas.width - 60) / w);
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    }

    ctx.fillStyle = '#d8d8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chord, canvas.width / 2, canvas.height / 2);
  }

  dispose(): void {
    this.texture.dispose();
    (this.mesh.material as THREE.MeshBasicMaterial).dispose();
    this.mesh.geometry.dispose();
  }
}
