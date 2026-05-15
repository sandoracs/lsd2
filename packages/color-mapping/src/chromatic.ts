import type { HSLColor } from '@lsd2/protocol';
import { frequencyToNoteInfo } from './note-utils.js';

export function chromaticScheme(frequency: number, amplitude: number): HSLColor {
  const { semitone, octave } = frequencyToNoteInfo(frequency);
  const h = semitone * 30;
  // Octave 4 = L 50%; each octave shifts ±6%, clamped to 20–80
  const l = Math.max(20, Math.min(80, 50 + (octave - 4) * 6));
  const s = Math.round(Math.min(100, amplitude * 100));
  return { h, s, l };
}
