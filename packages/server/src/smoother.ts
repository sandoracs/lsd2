/**
 * Sticky-note pitch smoother. Prevents brief pitch-detection glitches from
 * changing the displayed note. A new frequency must appear in `window`
 * consecutive frames before it replaces the current locked frequency.
 */
export class NoteSmoother {
  private lockedFreq: number | null = null;
  private candidateFreq: number | null = null;
  private candidateCount = 0;
  private static readonly CENTS_THRESHOLD = 50; // half semitone

  smooth(freq: number | null, window: number): number | null {
    if (freq === null) {
      this.candidateFreq = null;
      this.candidateCount = 0;
      return null;
    }

    if (this.lockedFreq === null) {
      this.lockedFreq = freq;
      return freq;
    }

    if (window <= 1) return freq; // No smoothing requested

    const centsFromLocked = 1200 * Math.log2(freq / this.lockedFreq);
    if (Math.abs(centsFromLocked) <= NoteSmoother.CENTS_THRESHOLD) {
      // Within the same note — discard candidate, keep locked
      this.candidateFreq = null;
      this.candidateCount = 0;
      return this.lockedFreq;
    }

    // Potentially a new note — accumulate candidate votes
    if (this.candidateFreq === null) {
      this.candidateFreq = freq;
      this.candidateCount = 1;
    } else {
      const centsFromCandidate = 1200 * Math.log2(freq / this.candidateFreq);
      if (Math.abs(centsFromCandidate) <= NoteSmoother.CENTS_THRESHOLD) {
        this.candidateCount++;
      } else {
        // Unstable — reset candidate to this new frequency
        this.candidateFreq = freq;
        this.candidateCount = 1;
      }
    }

    if (this.candidateCount >= window) {
      // Confirmed: switch to new note
      this.lockedFreq = this.candidateFreq!;
      this.candidateFreq = null;
      this.candidateCount = 0;
      return this.lockedFreq;
    }

    return this.lockedFreq; // Reject transient; return the stable locked note
  }

  reset(): void {
    this.lockedFreq = null;
    this.candidateFreq = null;
    this.candidateCount = 0;
  }
}
