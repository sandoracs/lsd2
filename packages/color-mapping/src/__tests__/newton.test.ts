import { describe, it, expect } from 'vitest';
import { newtonScheme } from '../newton.js';

describe('newtonScheme', () => {
  it('maps C to hue 0 (red)', () => {
    expect(newtonScheme(261.63, 0.8).h).toBe(0);
  });

  it('maps D to hue 51 (orange)', () => {
    expect(newtonScheme(293.66, 0.8).h).toBe(51);
  });

  it('maps G to hue 206 (cyan-blue)', () => {
    expect(newtonScheme(392.0, 0.8).h).toBe(206);
  });

  it('maps C# to interpolated hue between C and D', () => {
    const { h } = newtonScheme(277.18, 0.8); // C#4
    expect(h).toBe(25); // midpoint of C(0) and D(51)
  });

  it('saturation is always 85', () => {
    expect(newtonScheme(440, 0).s).toBe(85);
    expect(newtonScheme(440, 1).s).toBe(85);
  });

  it('applies octave-based lightness (same as chromatic)', () => {
    const oct4 = newtonScheme(261.63, 0.8).l;
    const oct5 = newtonScheme(523.25, 0.8).l;
    expect(oct5).toBeGreaterThan(oct4);
  });

  it('returns a valid HSL triple for every note in octave 4', () => {
    const freqs = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.0, 415.3, 440, 466.16, 493.88];
    for (const f of freqs) {
      const { h, s, l } = newtonScheme(f, 0.8);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(s).toBe(85);
      expect(l).toBeGreaterThanOrEqual(20);
      expect(l).toBeLessThanOrEqual(80);
    }
  });
});
