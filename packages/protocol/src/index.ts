export type ColorSchemeName =
  | 'chromatic'
  | 'newton'
  | 'scriabin'
  | 'frequency'
  | 'interval'
  | 'custom';

export interface HSLColor {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
}

export interface PitchData {
  frequency: number;  // Hz
  amplitude: number;  // 0.0–1.0
  note: string;       // "A", "C#", etc.
  octave: number;     // 0–8
  cents: number;      // -50 to +50
}

export interface NoteFrame {
  type: 'note_frame';
  timestamp: number;
  sessionId: string;
  silence: boolean;
  fundamental: PitchData;
  overtones: PitchData[];
  maxOvertones: number;
  beat: boolean;
  chord: string | null;
  key: string | null;
}

export interface ColoredNote extends PitchData {
  color: HSLColor;
}

export interface ColorFrame {
  type: 'color_frame';
  timestamp: number;
  sessionId: string;
  silence: boolean;
  colorScheme: ColorSchemeName;
  fundamental: ColoredNote;
  overtones: ColoredNote[];
  beat: boolean;
  chord: string | null;
  key: string | null;
}

export interface SessionConfig {
  colorScheme: ColorSchemeName;
  maxOvertones: number;
  noiseGateDb: number;
  colorDecayMs: number;
  smoothingWindow: number;                          // 1 = no smoothing, 3–5 = typical
  intervalTonic: string | null;                    // "C", "A#", etc. null = auto-detect
  customMapping: Record<string, HSLColor> | null;  // required when colorScheme = 'custom'
}
