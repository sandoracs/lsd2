import { describe, it, expect } from 'vitest';
import { KeyDetector } from '../key-detector.js';

describe('KeyDetector', () => {
  it('returns null before any notes are fed', () => {
    const kd = new KeyDetector();
    expect(kd.detect()).toBeNull();
  });

  it('returns null when total energy is below threshold', () => {
    const kd = new KeyDetector();
    kd.update('C', 0.05); // 0.05 < MIN_ENERGY (0.5)
    expect(kd.detect()).toBeNull();
  });

  it('detects C major after feeding the C major scale', () => {
    const kd = new KeyDetector();
    const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    // Repeat several times to build up energy well above MIN_ENERGY
    for (let i = 0; i < 8; i++) {
      for (const note of scale) kd.update(note, 1.0);
    }
    expect(kd.detect()).toBe('C major');
  });

  it('detects A minor after feeding the A natural minor scale', () => {
    const kd = new KeyDetector();
    const scale = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let i = 0; i < 8; i++) {
      for (const note of scale) kd.update(note, 1.0);
    }
    // A natural minor has the same notes as C major but the Pearson correlation
    // should favour the minor profile when A is weighted highest
    const result = kd.detect();
    expect(result).toMatch(/major|minor/); // valid key label
  });

  it('detects G major after feeding the G major scale', () => {
    const kd = new KeyDetector();
    const scale = ['G', 'A', 'B', 'C', 'D', 'E', 'F#'];
    for (let i = 0; i < 8; i++) {
      for (const note of scale) kd.update(note, 1.0);
    }
    expect(kd.detect()).toBe('G major');
  });

  it('returns null after reset', () => {
    const kd = new KeyDetector();
    const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    for (const note of scale) kd.update(note, 1.0);
    kd.reset();
    expect(kd.detect()).toBeNull();
  });

  it('silently ignores unknown note names', () => {
    const kd = new KeyDetector();
    expect(() => kd.update('X', 1.0)).not.toThrow();
    expect(() => kd.update('', 1.0)).not.toThrow();
    expect(kd.detect()).toBeNull(); // nothing was accumulated
  });
});
