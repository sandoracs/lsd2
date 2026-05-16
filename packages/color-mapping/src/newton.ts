import type { HSLColor } from '@lsd2/protocol';
import { frequencyToNoteInfo } from './note-utils.js';

// Newton's rainbow: 7 natural notes evenly spaced across the hue wheel.
// Sharps/flats interpolate between their neighbors.
const NATURAL_HUES: Record<string, number> = {
  C: 0,   // red
  D: 51,  // orange
  E: 103, // yellow
  F: 154, // green
  G: 206, // cyan-blue
  A: 257, // indigo
  B: 309, // violet
};

const SHARP_HUES: Record<string, number> = {
  'C#': 25,
  'D#': 77,
  'F#': 180,
  'G#': 231,
  'A#': 283,
};

export function newtonScheme(frequency: number, amplitude: number): HSLColor {
  const { note, octave } = frequencyToNoteInfo(frequency);
  const h = NATURAL_HUES[note] ?? SHARP_HUES[note] ?? 0;
  const l = Math.max(20, Math.min(80, 50 + (octave - 4) * 6));
  return { h, s: 85, l };
}
