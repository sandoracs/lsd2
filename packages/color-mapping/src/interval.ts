import type { HSLColor } from '@lsd2/protocol';
import { frequencyToNoteInfo } from './note-utils.js';

// Maps notes by their interval distance from a tonic using the circle of fifths.
// Harmonically close intervals share adjacent colors; the tritone is opposite (180°).
//
// Circle of fifths position for each chromatic semitone interval:
// Unison(0)→0, m2(1)→7, M2(2)→2, m3(3)→9, M3(4)→4, P4(5)→11,
// TT(6)→6, P5(7)→1, m6(8)→8, M6(9)→3, m7(10)→10, M7(11)→5
const COF_FROM_INTERVAL: number[] = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

export function intervalScheme(
  frequency: number,
  amplitude: number,
  tonicSemitone: number,
): HSLColor {
  const { semitone, octave } = frequencyToNoteInfo(frequency);
  const intervalSemitones = ((semitone - tonicSemitone) + 12) % 12;
  const cofStep = COF_FROM_INTERVAL[intervalSemitones] ?? 0;
  const h = cofStep * 30; // 12 steps × 30° = full 360°
  const l = Math.max(20, Math.min(80, 50 + (octave - 4) * 6));
  return { h, s: 85, l };
}
