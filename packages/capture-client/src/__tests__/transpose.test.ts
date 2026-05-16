import { describe, it, expect } from 'vitest';
import type { PitchData } from '@lsd2/protocol';
import { transposePitch } from '../transpose.js';

const A4: PitchData = { frequency: 440, amplitude: 0.5, note: 'A', octave: 4, cents: 0 };
const C4: PitchData = { frequency: 261.63, amplitude: 0.7, note: 'C', octave: 4, cents: 0 };

describe('transposePitch', () => {
  it('returns the identical object for 0 semitones', () => {
    expect(transposePitch(A4, 0)).toBe(A4);
  });

  it('shifts A4 up 2 semitones to B4', () => {
    const result = transposePitch(A4, 2);
    expect(result.note).toBe('B');
    expect(result.octave).toBe(4);
    expect(result.frequency).toBeCloseTo(440 * Math.pow(2, 2 / 12), 1);
  });

  it('shifts A4 down 12 semitones to A3', () => {
    const result = transposePitch(A4, -12);
    expect(result.note).toBe('A');
    expect(result.octave).toBe(3);
    expect(result.frequency).toBeCloseTo(220, 1);
  });

  it('shifts A4 up 9 semitones to F#5', () => {
    const result = transposePitch(A4, 9);
    expect(result.note).toBe('F#');
    expect(result.octave).toBe(5);
  });

  it('shifts C4 up 7 semitones (F key) to G4', () => {
    const result = transposePitch(C4, 7);
    expect(result.note).toBe('G');
    expect(result.octave).toBe(4);
  });

  it('preserves amplitude unchanged', () => {
    expect(transposePitch(A4, 5).amplitude).toBe(A4.amplitude);
  });

  it('computes cents as 0 for exact equal-temperament note', () => {
    // A4 + 12 semitones = A5 exactly
    expect(transposePitch(A4, 12).cents).toBe(0);
  });

  it('handles negative octave crossing', () => {
    // A4 down 21 semitones = C3
    const result = transposePitch(A4, -21);
    expect(result.note).toBe('C');
    expect(result.octave).toBe(3);
  });
});
