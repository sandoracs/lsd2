import type { HSLColor } from '@lsd2/protocol';
import { frequencyToNoteInfo } from './note-utils.js';

// Scriabin's "Prometheus" synesthetic color system (circle of fifths based).
// C → Red, G → Orange, D → Yellow, A → Green, E → Sky Blue, B → Pale Yellow,
// F# → Bright Blue, C# → Violet, G# → Purple, D# → Steel, A# → Steel, F → Dark Red
const SCRIABIN_HUES: number[] = [
  0,    // C  → Red
  280,  // C# → Violet
  55,   // D  → Yellow
  210,  // D# → Steel Blue (metallic)
  200,  // E  → Sky Blue
  350,  // F  → Dark Red / Crimson
  220,  // F# → Bright Blue
  20,   // G  → Orange-Red
  300,  // G# → Purple / Rose
  120,  // A  → Green
  210,  // A# → Steel (same family as D#)
  55,   // B  → Pale Yellow (same hue as D, lighter via octave)
];

export function scrabinScheme(frequency: number, amplitude: number): HSLColor {
  const { semitone, octave } = frequencyToNoteInfo(frequency);
  const h = SCRIABIN_HUES[semitone] ?? 0;
  const l = Math.max(20, Math.min(80, 50 + (octave - 4) * 6));
  return { h, s: 85, l };
}
