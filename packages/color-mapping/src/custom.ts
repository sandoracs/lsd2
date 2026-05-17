import type { HSLColor } from '@lsd2/protocol';
import { frequencyToNoteInfo } from './note-utils.js';
import { chromaticScheme } from './chromatic.js';

// User-defined mapping: note name → HSL color.
// Octave shifts lightness (same as other schemes); saturation is fixed from the table.
export function customScheme(
  frequency: number,
  amplitude: number,
  mapping: Record<string, HSLColor> | null | undefined,
): HSLColor {
  if (!mapping) return chromaticScheme(frequency, amplitude);
  const { note, octave } = frequencyToNoteInfo(frequency);
  const base = mapping[note];
  if (!base) return chromaticScheme(frequency, amplitude);
  const l = Math.max(20, Math.min(80, base.l + (octave - 4) * 6));
  return { h: base.h, s: base.s, l };
}
