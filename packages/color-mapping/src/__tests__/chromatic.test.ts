import { describe, it, expect } from 'vitest';
import { chromaticScheme } from '../chromatic.js';

describe('chromaticScheme', () => {
  it('maps C4 to hue 0 (red) at L 50', () => {
    const { h, s, l } = chromaticScheme(261.63, 0.8);
    expect(h).toBe(0);
    expect(s).toBe(85);
    expect(l).toBe(50);
  });

  it('maps A4 to hue 270 (purple)', () => {
    // A = semitone 9 → hue = 9 * 30 = 270
    expect(chromaticScheme(440, 0.8).h).toBe(270);
  });

  it('maps F#4 to hue 180 (cyan)', () => {
    // F# = semitone 6 → hue = 6 * 30 = 180
    expect(chromaticScheme(369.99, 0.8).h).toBe(180);
  });

  it('increases lightness by one octave above octave 4', () => {
    const oct4 = chromaticScheme(261.63, 0.8).l; // C4
    const oct5 = chromaticScheme(523.25, 0.8).l; // C5
    expect(oct5).toBe(oct4 + 6);
  });

  it('decreases lightness by one octave below octave 4', () => {
    const oct4 = chromaticScheme(261.63, 0.8).l; // C4
    const oct3 = chromaticScheme(130.81, 0.8).l; // C3
    expect(oct3).toBe(oct4 - 6);
  });

  it('clamps lightness to 20–80', () => {
    expect(chromaticScheme(16.35, 0.8).l).toBeGreaterThanOrEqual(20);  // C0
    expect(chromaticScheme(8372, 0.8).l).toBeLessThanOrEqual(80);      // C9
  });

  it('saturation is always 85 regardless of amplitude', () => {
    expect(chromaticScheme(440, 0).s).toBe(85);
    expect(chromaticScheme(440, 0.5).s).toBe(85);
    expect(chromaticScheme(440, 1).s).toBe(85);
  });
});
