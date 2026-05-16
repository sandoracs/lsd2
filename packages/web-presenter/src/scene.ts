import type { ColorFrame } from '@lsd2/protocol';

export interface Scene2D {
  update(frame: ColorFrame): void;
  onBeat(intensity: number): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  setDecayMs(ms: number): void;
  dispose(): void;
}
