import { describe, it, expect } from 'vitest';
import { intervalScheme } from '../interval.js';

// COF_FROM_INTERVAL = [0,7,2,9,4,11,6,1,8,3,10,5]
// hue = cofStep * 30

describe('intervalScheme', () => {
  it('maps unison (tonic played as C) to hue 0', () => {
    // C4 (semitone 0) with tonic = 0 → interval 0 → COF step 0 → hue 0
    expect(intervalScheme(261.63, 0.8, 0).h).toBe(0);
  });

  it('maps perfect 5th above C (G4) to hue 30', () => {
    // G4 = semitone 7, interval from C = 7, COF step = 1, hue = 30
    expect(intervalScheme(392.0, 0.8, 0).h).toBe(30);
  });

  it('maps tritone (F#4 from C) to hue 180', () => {
    // F#4 = semitone 6, interval = 6, COF step = 6, hue = 180
    expect(intervalScheme(369.99, 0.8, 0).h).toBe(180);
  });

  it('maps unison relative to a non-C tonic', () => {
    // A4 with tonic A (semitone 9) → interval = 0 → hue 0
    expect(intervalScheme(440, 0.8, 9).h).toBe(0);
  });

  it('maps perfect 5th relative to A tonic (E)', () => {
    // E4 = semitone 4; interval from A (9) = (4 - 9 + 12) % 12 = 7 → hue 30
    expect(intervalScheme(329.63, 0.8, 9).h).toBe(30);
  });

  it('saturation is always 85', () => {
    expect(intervalScheme(440, 0, 0).s).toBe(85);
    expect(intervalScheme(440, 1, 0).s).toBe(85);
  });

  it('applies octave-based lightness', () => {
    const oct4 = intervalScheme(261.63, 0.8, 0).l;
    const oct5 = intervalScheme(523.25, 0.8, 0).l;
    expect(oct5).toBeGreaterThan(oct4);
  });
});
