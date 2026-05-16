import type { HSLColor } from '@lsd2/protocol';

// Maps audio frequency log-linearly to the visible light spectrum.
// Low notes → warm (red/orange), high notes → cool (violet).
// This mirrors the physics: low-frequency light is red, high-frequency is violet.

const F_MIN = 20;    // Hz — lowest audible frequency
const F_MAX = 20000; // Hz — highest audible frequency

export function frequencyScheme(frequency: number, amplitude: number): HSLColor {
  const normalized = Math.log(frequency / F_MIN) / Math.log(F_MAX / F_MIN);
  const clamped = Math.max(0, Math.min(1, normalized));
  // 0 (bass) → H:0° (red), 1 (treble) → H:270° (violet)
  const h = Math.round(clamped * 270);
  return { h, s: 85, l: 50 };
}
