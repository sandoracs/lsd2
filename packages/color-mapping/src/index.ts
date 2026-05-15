import type { HSLColor, ColorSchemeName } from '@lsd2/protocol';
import { chromaticScheme } from './chromatic.js';
import { newtonScheme } from './newton.js';
import { scrabinScheme } from './scriabin.js';
import { frequencyScheme } from './frequency-scheme.js';
import { intervalScheme } from './interval.js';
import { customScheme } from './custom.js';

export { frequencyToNoteInfo, noteNameToSemitone, NOTE_NAMES } from './note-utils.js';
export type { NoteInfo } from './note-utils.js';
export { extractOvertones } from './overtone.js';
export type { OvertoneData } from './overtone.js';

export interface SchemeOptions {
  intervalTonicSemitone?: number;
  customMapping?: Record<string, HSLColor> | null;
}

export function mapFrequencyToColor(
  frequency: number,
  amplitude: number,
  scheme: ColorSchemeName = 'chromatic',
  options: SchemeOptions = {},
): HSLColor {
  switch (scheme) {
    case 'newton':    return newtonScheme(frequency, amplitude);
    case 'scriabin':  return scrabinScheme(frequency, amplitude);
    case 'frequency': return frequencyScheme(frequency, amplitude);
    case 'interval':  return intervalScheme(frequency, amplitude, options.intervalTonicSemitone ?? 0);
    case 'custom':    return customScheme(frequency, amplitude, options.customMapping);
    case 'chromatic':
    default:          return chromaticScheme(frequency, amplitude);
  }
}
