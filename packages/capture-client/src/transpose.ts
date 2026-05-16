import type { PitchData } from '@lsd2/protocol';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export function transposePitch(p: PitchData, semitones: number): PitchData {
  if (semitones === 0) return p;
  const newFreq = p.frequency * Math.pow(2, semitones / 12);
  const midi    = 12 * Math.log2(newFreq / 440) + 69;
  const rounded = Math.round(midi);
  return {
    frequency: newFreq,
    amplitude: p.amplitude,
    note:   NOTE_NAMES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    cents:  Math.round((midi - rounded) * 100),
  };
}
