import { describe, it, expect } from 'vitest';
import { frequencyToNoteInfo, noteNameToSemitone } from '../note-utils.js';

describe('frequencyToNoteInfo', () => {
  it('identifies A4 at 440 Hz', () => {
    const { note, octave, cents } = frequencyToNoteInfo(440);
    expect(note).toBe('A');
    expect(octave).toBe(4);
    expect(cents).toBe(0);
  });

  it('identifies C4 at 261.63 Hz', () => {
    const { note, octave, cents } = frequencyToNoteInfo(261.63);
    expect(note).toBe('C');
    expect(octave).toBe(4);
    expect(Math.abs(cents)).toBeLessThan(2);
  });

  it('identifies A5 at 880 Hz', () => {
    const { note, octave } = frequencyToNoteInfo(880);
    expect(note).toBe('A');
    expect(octave).toBe(5);
  });

  it('identifies A3 at 220 Hz', () => {
    const { note, octave } = frequencyToNoteInfo(220);
    expect(note).toBe('A');
    expect(octave).toBe(3);
  });

  it('returns cents near ±50 for a note halfway between semitones', () => {
    // 50 cents flat of A4
    const flat = 440 * Math.pow(2, -50 / 1200);
    const { cents } = frequencyToNoteInfo(flat);
    expect(Math.abs(cents)).toBeLessThanOrEqual(50);
  });

  it('returns correct semitone index', () => {
    expect(frequencyToNoteInfo(440).semitone).toBe(9);  // A
    expect(frequencyToNoteInfo(261.63).semitone).toBe(0); // C
  });
});

describe('noteNameToSemitone', () => {
  it('maps all 12 chromatic notes', () => {
    const expected: Record<string, number> = {
      C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
      'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
    };
    for (const [name, semitone] of Object.entries(expected)) {
      expect(noteNameToSemitone(name)).toBe(semitone);
    }
  });

  it('returns null for an unknown note name', () => {
    expect(noteNameToSemitone('X')).toBeNull();
    expect(noteNameToSemitone('Bb')).toBeNull(); // flat spelling not in the list
    expect(noteNameToSemitone('')).toBeNull();
  });
});
