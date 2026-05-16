import { describe, it, expect } from 'vitest';
import { scrabinScheme } from '../scriabin.js';

describe('scrabinScheme', () => {
  it('maps C to hue 0 (red)', () => {
    expect(scrabinScheme(261.63, 0.8).h).toBe(0);
  });

  it('maps A to hue 120 (green)', () => {
    expect(scrabinScheme(440, 0.8).h).toBe(120);
  });

  it('maps C# to hue 280 (violet)', () => {
    expect(scrabinScheme(277.18, 0.8).h).toBe(280);
  });

  it('saturation is always 85', () => {
    expect(scrabinScheme(440, 0).s).toBe(85);
    expect(scrabinScheme(440, 1).s).toBe(85);
  });

  it('applies octave-based lightness', () => {
    const oct4 = scrabinScheme(261.63, 0.8).l;
    const oct5 = scrabinScheme(523.25, 0.8).l;
    expect(oct5).toBeGreaterThan(oct4);
  });

  it('returns a valid HSL triple for every chromatic note', () => {
    const freqs = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.0, 415.3, 440, 466.16, 493.88];
    for (const f of freqs) {
      const { h, s, l } = scrabinScheme(f, 0.8);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(s).toBe(85);
      expect(l).toBeGreaterThanOrEqual(20);
      expect(l).toBeLessThanOrEqual(80);
    }
  });
});
