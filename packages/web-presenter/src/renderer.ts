import type { ColorFrame } from '@lsd2/protocol';

interface ColorState {
  h: number;
  s: number;
  l: number;
  amplitude: number;
}

interface RenderState {
  fundamental: ColorState;
  overtones: ColorState[];
  lastUpdate: number;
}

export interface Renderer {
  render(frame: ColorFrame): void;
  start(): void;
  stop(): void;
  setDecayMs(ms: number): void;
}

export function createRenderer(canvas: HTMLCanvasElement, initialDecayMs = 3000): Renderer {
  const ctx = canvas.getContext('2d')!;
  let state: RenderState | null = null;
  let rafId = 0;
  let running = false;
  let colorDecayMs = initialDecayMs;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function drawFrame() {
    const { width, height } = canvas;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    if (!state) return;

    const elapsed = Math.max(0, Date.now() - state.lastUpdate);
    const decayFactor = Math.max(0, 1 - elapsed / colorDecayMs);

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const baseR = minDim * 0.12;
    const ringStep = minDim * 0.065;

    // Overtone rings — outermost first so fundamental is always on top
    for (let i = state.overtones.length - 1; i >= 0; i--) {
      const o = state.overtones[i];
      const s = o.s * decayFactor;
      if (s < 1) continue;

      const radius = baseR + (i + 1) * ringStep;
      const lineWidth = Math.max(1.5, 14 * o.amplitude * decayFactor);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(${o.h}, ${s.toFixed(0)}%, ${o.l}%)`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // Fundamental disc + glow
    const fs = state.fundamental.s * decayFactor;
    if (fs > 0.5) {
      const radius = Math.max(6, baseR * state.fundamental.amplitude);

      const glowR = radius * 2.5;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, `hsla(${state.fundamental.h}, ${fs.toFixed(0)}%, ${state.fundamental.l}%, 0.35)`);
      grd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${state.fundamental.h}, ${fs.toFixed(0)}%, ${state.fundamental.l}%)`;
      ctx.fill();
    }
  }

  function loop() {
    if (!running) return;
    drawFrame();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  return {
    render(frame: ColorFrame) {
      if (frame.silence) { state = null; return; }
      state = {
        fundamental: {
          h: frame.fundamental.color.h,
          s: frame.fundamental.color.s,
          l: frame.fundamental.color.l,
          amplitude: frame.fundamental.amplitude,
        },
        overtones: frame.overtones.map(o => ({
          h: o.color.h,
          s: o.color.s,
          l: o.color.l,
          amplitude: o.amplitude,
        })),
        lastUpdate: Date.now(),
      };
    },

    start() {
      running = true;
      resize();
      loop();
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },

    setDecayMs(ms: number) {
      colorDecayMs = ms;
    },
  };
}
