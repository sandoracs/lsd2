import type { PitchData } from '@lsd2/protocol';

const MIN_FREQ = 60;
const MAX_FREQ = 5000;
const HARMONIC_TOLERANCE = 0.04;   // 4 % — tighter than a semitone (≈6 %)
const HARMONICS_TO_CHECK = [2, 3, 4, 5, 6];
const AMPLITUDE_SCALE = 5.0;

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function freqToNote(f: number): { note: string; octave: number; cents: number } {
  const midi    = 12 * Math.log2(f / 440) + 69;
  const rounded = Math.round(midi);
  return {
    note:   NOTE_NAMES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    cents:  Math.round((midi - rounded) * 100),
  };
}

function isHarmonicOf(freq: number, fundamental: number): boolean {
  for (const n of HARMONICS_TO_CHECK) {
    const expected = fundamental * n;
    if (Math.abs(freq - expected) / expected < HARMONIC_TOLERANCE) return true;
  }
  return false;
}

export class PolyphonicDetector {
  private magnitude: Float32Array;

  constructor(frequencyBinCount: number) {
    this.magnitude = new Float32Array(frequencyBinCount);
  }

  detect(
    freqDomain: Float32Array,
    sampleRate: number,
    fftSize: number,
    noiseFloorDb: number,
    maxPitches: number,
  ): PitchData[] {
    const binHz  = sampleRate / fftSize;
    const minBin = Math.max(1, Math.ceil(MIN_FREQ / binHz));
    const maxBin = Math.min(this.magnitude.length - 2, Math.floor(MAX_FREQ / binHz));

    // dB → linear magnitude
    for (let i = 0; i < freqDomain.length; i++) {
      this.magnitude[i] = freqDomain[i] > noiseFloorDb
        ? Math.pow(10, freqDomain[i] / 20)
        : 0;
    }

    // Find local maxima and score them
    interface Peak { freq: number; mag: number; score: number }
    const peaks: Peak[] = [];

    for (let i = minBin; i <= maxBin; i++) {
      const m = this.magnitude[i];
      if (m === 0 || m <= this.magnitude[i - 1] || m < this.magnitude[i + 1]) continue;

      // Parabolic interpolation for sub-bin frequency accuracy
      const a = this.magnitude[i - 1];
      const c = this.magnitude[i + 1];
      const denom = a - 2 * m + c;
      const offset = denom !== 0 ? 0.5 * (a - c) / denom : 0;
      const freq = (i + offset) * binHz;

      // Harmonic score: peaks with strong integer-multiple partials score higher
      let harmonicSum = 0;
      for (const n of HARMONICS_TO_CHECK) {
        const hBin = Math.round((i + offset) * n);
        if (hBin < this.magnitude.length) harmonicSum += this.magnitude[hBin];
      }
      const score = m * (1 + harmonicSum / m);

      peaks.push({ freq, mag: m, score });
    }

    // Sort strongest first
    peaks.sort((a, b) => b.score - a.score);

    // Greedily select: skip peaks that are harmonics of an already-chosen pitch
    const chosenFreqs: number[] = [];
    const selected: PitchData[] = [];

    for (const peak of peaks) {
      if (selected.length >= maxPitches) break;
      if (chosenFreqs.some(f => isHarmonicOf(peak.freq, f))) continue;

      const { note, octave, cents } = freqToNote(peak.freq);
      selected.push({
        frequency: peak.freq,
        amplitude: Math.min(1, peak.mag * AMPLITUDE_SCALE),
        note,
        octave,
        cents,
      });
      chosenFreqs.push(peak.freq);
    }

    // Return loudest first so caller can treat selected[0] as the "fundamental"
    selected.sort((a, b) => b.amplitude - a.amplitude);
    return selected;
  }
}
