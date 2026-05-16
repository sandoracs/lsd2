const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const NOTE_TO_PC: Record<string, number> = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,
  'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,
};

interface Template { suffix: string; intervals: number[] }

// Most common chord types first — used to break ties in score
const TEMPLATES: Template[] = [
  { suffix: '',      intervals: [0, 4, 7] },
  { suffix: 'm',     intervals: [0, 3, 7] },
  { suffix: '7',     intervals: [0, 4, 7, 10] },
  { suffix: 'maj7',  intervals: [0, 4, 7, 11] },
  { suffix: 'm7',    intervals: [0, 3, 7, 10] },
  { suffix: 'add9',  intervals: [0, 2, 4, 7] },
  { suffix: '6',     intervals: [0, 4, 7, 9] },
  { suffix: 'm6',    intervals: [0, 3, 7, 9] },
  { suffix: 'sus2',  intervals: [0, 2, 7] },
  { suffix: 'sus4',  intervals: [0, 5, 7] },
  { suffix: '°',     intervals: [0, 3, 6] },
  { suffix: '+',     intervals: [0, 4, 8] },
  { suffix: '°7',    intervals: [0, 3, 6, 9] },
  { suffix: 'ø7',    intervals: [0, 3, 6, 10] },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
  { suffix: '5',     intervals: [0, 7] },
];

export interface ChordResult {
  label: string;  // e.g. "C", "Am", "G7"
  score: number;  // 0–1
}

export function detectChord(noteNames: string[]): ChordResult | null {
  if (noteNames.length < 2) return null;

  // Collect unique pitch classes
  const pcs = new Set<number>();
  for (const n of noteNames) {
    const pc = NOTE_TO_PC[n];
    if (pc !== undefined) pcs.add(pc);
  }
  if (pcs.size < 2) return null;

  const detected = [...pcs];
  let best: ChordResult | null = null;
  let bestScore = 0;
  // Slight tiebreak bonus for earlier (more common) templates
  const templateCount = TEMPLATES.length;

  for (let root = 0; root < 12; root++) {
    for (let ti = 0; ti < TEMPLATES.length; ti++) {
      const { suffix, intervals } = TEMPLATES[ti];

      let matched = 0;
      for (const interval of intervals) {
        if (pcs.has((root + interval) % 12)) matched++;
      }
      if (matched < 2) continue;

      const coverage  = matched / intervals.length;
      const precision = matched / detected.length;
      // Composite: rewards more matched notes; tiebreak favors common templates
      const score = coverage * precision * matched - (ti / templateCount) * 0.001;

      if (score > bestScore) {
        bestScore = score;
        best = { label: `${NOTE_NAMES[root]}${suffix}`, score: coverage * precision };
      }
    }
  }

  return best && best.score >= 0.5 ? best : null;
}
