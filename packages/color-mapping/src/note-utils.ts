export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface NoteInfo {
  note: string;
  octave: number;
  semitone: number;
  cents: number;
}

export function frequencyToNoteInfo(frequency: number): NoteInfo {
  const midi = 12 * Math.log2(frequency / 440) + 69;
  const rounded = Math.round(midi);
  const semitone = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const cents = Math.round((midi - rounded) * 100);
  return { note: NOTE_NAMES[semitone], octave, semitone, cents };
}

export function noteNameToSemitone(note: string): number | null {
  const idx = (NOTE_NAMES as readonly string[]).indexOf(note);
  return idx >= 0 ? idx : null;
}
