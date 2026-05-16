import { describe, it, expect } from 'vitest';
import { detectChord } from '../chord-detector.js';

describe('detectChord', () => {
  describe('triads', () => {
    it('identifies C major (C E G)', () => {
      expect(detectChord(['C', 'E', 'G'])?.label).toBe('C');
    });

    it('identifies A minor (A C E)', () => {
      expect(detectChord(['A', 'C', 'E'])?.label).toBe('Am');
    });

    it('identifies G major (G B D)', () => {
      expect(detectChord(['G', 'B', 'D'])?.label).toBe('G');
    });

    it('identifies F major (F A C)', () => {
      expect(detectChord(['F', 'A', 'C'])?.label).toBe('F');
    });

    it('identifies diminished triad (B D F)', () => {
      expect(detectChord(['B', 'D', 'F'])?.label).toBe('B°');
    });

    it('identifies augmented triad (C E G#)', () => {
      expect(detectChord(['C', 'E', 'G#'])?.label).toBe('C+');
    });
  });

  describe('seventh chords', () => {
    it('identifies G dominant 7 (G B D F)', () => {
      expect(detectChord(['G', 'B', 'D', 'F'])?.label).toBe('G7');
    });

    it('identifies C major 7 (C E G B)', () => {
      expect(detectChord(['C', 'E', 'G', 'B'])?.label).toBe('Cmaj7');
    });

    it('identifies A minor 7 (A C E G)', () => {
      expect(detectChord(['A', 'C', 'E', 'G'])?.label).toBe('Am7');
    });
  });

  describe('suspended chords', () => {
    it('identifies sus2 (C D G)', () => {
      expect(detectChord(['C', 'D', 'G'])?.label).toBe('Csus2');
    });

    it('resolves the ambiguous C-F-G set as Fsus2 (higher-priority template)', () => {
      // C, F, G satisfies both Csus4 [0,5,7] and Fsus2 [0,2,7] from F.
      // The detector scores them equally and breaks the tie in favour of sus2
      // (lower template index → smaller penalty).
      expect(detectChord(['C', 'F', 'G'])?.label).toBe('Fsus2');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input', () => {
      expect(detectChord([])).toBeNull();
    });

    it('returns null for a single note', () => {
      expect(detectChord(['C'])).toBeNull();
    });

    it('handles enharmonic spellings (Bb = A#)', () => {
      // Bb major: Bb D F — stored as A#
      const result = detectChord(['Bb', 'D', 'F']);
      expect(result?.label).toBe('A#');
    });

    it('handles Db/Eb spellings', () => {
      // Eb minor: Eb Gb Bb
      const result = detectChord(['Eb', 'Gb', 'Bb']);
      expect(result?.label).toBe('D#m');
    });

    it('score is in the 0–1 range for a recognized chord', () => {
      const result = detectChord(['C', 'E', 'G']);
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.score).toBeLessThanOrEqual(1);
    });

    it('returns a power chord for just a 5th (C G)', () => {
      expect(detectChord(['C', 'G'])?.label).toBe('C5');
    });

    it('ignores duplicate notes', () => {
      expect(detectChord(['C', 'E', 'G', 'C', 'E'])?.label).toBe('C');
    });
  });
});
