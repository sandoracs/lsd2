import type { ColorFrame } from '@lsd2/protocol';
import type { Scene2D } from './scene.js';
import { Aurora2D } from './scenes/aurora.js';
import { Constellation2D } from './scenes/constellation.js';
import { Ripple2D } from './scenes/ripple.js';
import { Orbital2D } from './scenes/orbital.js';
import { Fire2D } from './scenes/fire.js';

export type MetaphorName = 'aurora' | 'constellation' | 'ripple' | 'orbital' | 'fire';

export interface Renderer {
  render(frame: ColorFrame): void;
  start(): void;
  stop(): void;
  setDecayMs(ms: number): void;
  setMetaphor(name: MetaphorName): void;
}

function makeScene(name: MetaphorName, decayMs: number): Scene2D {
  const s = name === 'aurora'        ? new Aurora2D()
          : name === 'constellation' ? new Constellation2D()
          : name === 'ripple'        ? new Ripple2D()
          : name === 'orbital'       ? new Orbital2D()
          : new Fire2D();
  s.setDecayMs(decayMs);
  return s;
}

export function createRenderer(canvas: HTMLCanvasElement, initialDecayMs = 3000): Renderer {
  const ctx = canvas.getContext('2d')!;
  let decayMs = initialDecayMs;
  let metaphor: MetaphorName = 'aurora';
  let scene: Scene2D = makeScene(metaphor, decayMs);
  let lastFrame: ColorFrame | null = null;
  let lastBeatTs = 0;
  let running = false;
  let rafId = 0;

  // Chord overlay state
  let chordLabel = '';
  let chordOpacity = 0;
  let chordTargetOpacity = 0;
  let chordLastAt = 0;
  let prevLoopTime = performance.now();

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function drawChord(now: number, dt: number) {
    if (chordLabel && now - chordLastAt < decayMs) chordTargetOpacity = 1;
    else chordTargetOpacity = 0;
    chordOpacity += (chordTargetOpacity - chordOpacity) * Math.min(1, dt * 6);
    if (chordOpacity < 0.01) return;

    const { width: w, height: h } = canvas;
    const fontSize = Math.round(Math.min(w, h) * 0.08);
    ctx.save();
    ctx.globalAlpha = chordOpacity;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(chordLabel).width;
    const pad = fontSize * 0.5;
    const bw = tw + pad * 2, bh = fontSize * 1.4;
    const bx = w / 2 - bw / 2, by = h * 0.08 - bh / 2;
    ctx.fillStyle = 'rgba(5,5,30,0.8)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#d8d8ff';
    ctx.fillText(chordLabel, w / 2, h * 0.08);
    ctx.restore();
  }

  function loop() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - prevLoopTime) / 1000, 0.05);
    prevLoopTime = now;

    canvas.width = window.innerWidth;   // keeps canvas synced without a resize listener race
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (lastFrame) scene.update(lastFrame);
    scene.draw(ctx, canvas.width, canvas.height);
    drawChord(now, dt);

    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  return {
    render(frame: ColorFrame) {
      lastFrame = frame;
      if (frame.beat && frame.timestamp !== lastBeatTs) {
        lastBeatTs = frame.timestamp;
        scene.onBeat(Math.min(1, frame.fundamental.amplitude * 1.2));
      }
      if (frame.chord) { chordLabel = frame.chord; chordLastAt = performance.now(); }
      else if (frame.silence) { /* keep showing last chord until decay */ }
    },

    start() { running = true; resize(); loop(); },
    stop()  { running = false; cancelAnimationFrame(rafId); },

    setDecayMs(ms: number) {
      decayMs = ms;
      scene.setDecayMs(ms);
    },

    setMetaphor(name: MetaphorName) {
      if (name === metaphor) return;
      scene.dispose();
      metaphor = name;
      scene = makeScene(name, decayMs);
    },
  };
}
