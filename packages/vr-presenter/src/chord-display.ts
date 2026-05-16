import * as THREE from 'three';

const CANVAS_W = 512;
const CANVAS_H = 176;
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
  private currentKey   = '';
  private lastChordAt  = 0;
  private lastTime     = performance.now();
  private decayMs      = 3000;

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
    this.mesh.position.set(0, 2.1, -2.8);
    this.mesh.lookAt(0, 1.6, 0);
    scene.add(this.mesh);
  }

  setDecayMs(ms: number): void { this.decayMs = ms; }

  update(chord: string | null, key: string | null): void {
    const now = performance.now();
    const dt  = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const needsRedraw = chord !== this.currentChord || (key ?? '') !== this.currentKey;

    if (chord !== null) {
      this.lastChordAt = now;
      this.targetOpacity = 1;
    } else if (now - this.lastChordAt > this.decayMs) {
      this.targetOpacity = key ? 1 : 0;  // stay visible if we have a key
    }

    // Also show if we have a key even without a chord
    if (!chord && key) this.targetOpacity = 1;

    if (needsRedraw) {
      this.currentChord = chord ?? '';
      this.currentKey   = key ?? '';
      this.draw();
      this.texture.needsUpdate = true;
    }

    if (this.opacity < this.targetOpacity) {
      this.opacity = Math.min(this.targetOpacity, this.opacity + FADE_IN * dt);
    } else {
      this.opacity = Math.max(this.targetOpacity, this.opacity - FADE_OUT * dt);
    }
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = this.opacity;
  }

  private draw(): void {
    const { canvas, ctx } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hasChord = this.currentChord !== '';
    const hasKey   = this.currentKey   !== '';
    if (!hasChord && !hasKey) return;

    // Dark pill background
    const pad = 10;
    ctx.fillStyle = 'rgba(5, 5, 30, 0.88)';
    ctx.beginPath();
    const r = 18;
    ctx.roundRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, r);
    ctx.fill();

    if (hasChord) {
      // Chord label — upper ~65% of canvas
      const chordAreaH = hasKey ? Math.floor(canvas.height * 0.62) : canvas.height;
      let fontSize = Math.floor(chordAreaH * 0.68);
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      const tw = ctx.measureText(this.currentChord).width;
      if (tw > canvas.width - 60) {
        fontSize = Math.floor(fontSize * (canvas.width - 60) / tw);
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      }
      ctx.fillStyle = '#d8d8ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentChord, canvas.width / 2, chordAreaH / 2 + pad / 2);
    }

    if (hasKey) {
      // Key label — lower row, smaller
      const keyY = hasChord ? Math.floor(canvas.height * 0.78) : canvas.height / 2;
      const keyFontSize = Math.floor(canvas.height * 0.2);
      ctx.font = `600 ${keyFontSize}px system-ui, sans-serif`;
      ctx.fillStyle = '#88ffcc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.currentKey.toUpperCase(), canvas.width / 2, keyY);
    }
  }

  dispose(): void {
    this.texture.dispose();
    (this.mesh.material as THREE.MeshBasicMaterial).dispose();
    this.mesh.geometry.dispose();
  }
}
