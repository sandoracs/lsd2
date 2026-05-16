import { describe, it, expect } from 'vitest';
import { extractOvertones } from '../overtone.js';

const SR       = 44100;
const FFT_SIZE = 4096;
const BINS     = FFT_SIZE / 2;
const BIN_HZ   = SR / FFT_SIZE;

function makeFFT(peakBins: Array<{ bin: number; db: number }>, fill = -80): Float32Array {
  const fft = new Float32Array(BINS).fill(fill);
  for (const { bin, db } of peakBins) fft[bin] = db;
  return fft;
}

describe('extractOvertones', () => {
  it('returns one entry per requested overtone', () => {
    const fft = makeFFT([]);
    const result = extractOvertones(fft, 440, SR, FFT_SIZE, 4);
    expect(result).toHaveLength(4);
  });

  it('detects a strong peak at 2× fundamental', () => {
    const bin2f = Math.round(880 / BIN_HZ);
    const fft = makeFFT([{ bin: bin2f, db: -10 }]);
    const [first] = extractOvertones(fft, 440, SR, FFT_SIZE, 1, -40);
    expect(first.frequency).toBe(880);
    expect(first.amplitude).toBeGreaterThan(0);
  });

  it('amplitude is 0 when bin is below the noise gate', () => {
    const fft = makeFFT([], -80); // all bins at -80 dB, gate at -40
    const result = extractOvertones(fft, 440, SR, FFT_SIZE, 4, -40);
    for (const o of result) expect(o.amplitude).toBe(0);
  });

  it('amplitude is 1 when bin is at 0 dB (gate = -40)', () => {
    // amplitude = (maxDb - noiseGateDb) / (-noiseGateDb) = (0 - (-40)) / 40 = 1
    const bin2f = Math.round(880 / BIN_HZ);
    const fft = makeFFT([{ bin: bin2f, db: 0 }]);
    const [first] = extractOvertones(fft, 440, SR, FFT_SIZE, 1, -40);
    expect(first.amplitude).toBeCloseTo(1);
  });

  it('stops before Nyquist (SR/2)', () => {
    const fft = new Float32Array(BINS).fill(-10);
    // fundamental 5000 Hz: overtones 10k, 15k, 20k — 20k < 22050 ✓, 25k > 22050 ✗
    const result = extractOvertones(fft, 5000, SR, FFT_SIZE, 10);
    for (const o of result) expect(o.frequency).toBeLessThan(SR / 2);
  });
});
