import { describe, it, expect } from 'vitest';
import { frequencyScheme } from '../frequency-scheme.js';

describe('frequencyScheme', () => {
  it('maps bass frequencies to warm hues (near 0)', () => {
    const { h } = frequencyScheme(40, 0.8);
    expect(h).toBeLessThan(30);
  });

  it('maps treble frequencies to cool hues (near 270)', () => {
    const { h } = frequencyScheme(12000, 0.8);
    expect(h).toBeGreaterThan(240);
  });

  it('hue increases monotonically with frequency', () => {
    const freqs = [80, 200, 440, 1000, 4000, 10000];
    const hues = freqs.map(f => frequencyScheme(f, 0.8).h);
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i]).toBeGreaterThanOrEqual(hues[i - 1]);
    }
  });

  it('saturation is fixed at 85', () => {
    expect(frequencyScheme(440, 0).s).toBe(85);
    expect(frequencyScheme(440, 1).s).toBe(85);
  });

  it('lightness is fixed at 50', () => {
    expect(frequencyScheme(440, 0.5).l).toBe(50);
    expect(frequencyScheme(4000, 0.5).l).toBe(50);
  });

  it('clamps hue to 0–270 range', () => {
    // Sub-bass edge
    const { h: low } = frequencyScheme(1, 0.8);
    expect(low).toBeGreaterThanOrEqual(0);
    // Ultra-high edge
    const { h: high } = frequencyScheme(50000, 0.8);
    expect(high).toBeLessThanOrEqual(270);
  });
});
