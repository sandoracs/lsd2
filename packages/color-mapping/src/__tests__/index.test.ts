import { describe, it, expect } from 'vitest';
import { mapFrequencyToColor } from '../index.js';
import type { ColorSchemeName } from '@lsd2/protocol';

describe('mapFrequencyToColor', () => {
  it('defaults to chromatic scheme', () => {
    // A4 → chromatic → semitone 9 × 30° = 270
    expect(mapFrequencyToColor(440, 0.8).h).toBe(270);
  });

  it('routes to each named scheme without throwing', () => {
    const schemes: ColorSchemeName[] = ['chromatic', 'newton', 'scriabin', 'frequency', 'interval', 'custom'];
    for (const scheme of schemes) {
      expect(() => mapFrequencyToColor(440, 0.5, scheme)).not.toThrow();
    }
  });

  it('each scheme returns a valid HSL triple', () => {
    const schemes: ColorSchemeName[] = ['chromatic', 'newton', 'scriabin', 'frequency', 'interval'];
    for (const scheme of schemes) {
      const { h, s, l } = mapFrequencyToColor(440, 0.8, scheme);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(360);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(100);
    }
  });

  it('custom scheme falls back to chromatic when mapping is null', () => {
    const chromatic = mapFrequencyToColor(440, 0.8, 'chromatic');
    const custom    = mapFrequencyToColor(440, 0.8, 'custom', { customMapping: null });
    expect(custom.h).toBe(chromatic.h);
  });

  it('custom scheme applies user-defined mapping', () => {
    const mapping = { A: { h: 42, s: 90, l: 55 } };
    const { h } = mapFrequencyToColor(440, 1.0, 'custom', { customMapping: mapping });
    expect(h).toBe(42);
  });

  it('interval scheme respects tonicSemitone option', () => {
    // Playing C with tonic C → hue 0 (unison)
    const unison = mapFrequencyToColor(261.63, 0.8, 'interval', { intervalTonicSemitone: 0 });
    expect(unison.h).toBe(0);

    // Playing C with tonic A (semitone 9) → interval = (0 - 9 + 12) % 12 = 3
    // COF_FROM_INTERVAL[3] = 9 → hue = 270
    const notUnison = mapFrequencyToColor(261.63, 0.8, 'interval', { intervalTonicSemitone: 9 });
    expect(notUnison.h).not.toBe(0);
  });
});
