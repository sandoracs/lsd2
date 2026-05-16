import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatDetector } from '../beat-detector.js';

const SR       = 44100;
const FFT_SIZE = 4096;
const BINS     = FFT_SIZE / 2;
const BIN_HZ   = SR / FFT_SIZE;

// FFT with bass bins (60–200 Hz) set to `bassDb`, everything else silent.
function bassFFT(bassDb: number): Float32Array {
  const fft = new Float32Array(BINS).fill(-100);
  const low  = Math.floor(60  / BIN_HZ);
  const high = Math.min(Math.ceil(200 / BIN_HZ), BINS - 1);
  for (let i = low; i <= high; i++) fft[i] = bassDb;
  return fft;
}

// Feed `count` frames and return the last result.
function feed(bd: BeatDetector, fft: Float32Array, count: number): boolean {
  let result = false;
  for (let i = 0; i < count; i++) result = bd.detect(fft, SR, FFT_SIZE);
  return result;
}

// Fake timers so performance.now() is controllable.
// The debounce check is `now - lastBeatAt > 250ms`, and lastBeatAt starts at 0,
// so we set the clock well above 250ms before running any test.
beforeEach(() => {
  vi.useFakeTimers();
  vi.advanceTimersByTime(2000); // performance.now() = 2000ms — safely past debounce
});
afterEach(() => vi.useRealTimers());

describe('BeatDetector', () => {
  it('returns false until the history buffer is full (43 frames)', () => {
    const bd  = new BeatDetector();
    const fft = bassFFT(-10);
    for (let i = 0; i < 42; i++) {
      expect(bd.detect(fft, SR, FFT_SIZE)).toBe(false);
    }
  });

  it('detects a beat when bass energy spikes well above the running average', () => {
    const bd = new BeatDetector();
    // Fill history with moderate bass energy
    feed(bd, bassFFT(-40), 43);
    // Loud frame: energy ~10× the average → well above the 1.4× threshold
    expect(bd.detect(bassFFT(-10), SR, FFT_SIZE)).toBe(true);
  });

  it('does not detect a beat for steady energy', () => {
    const bd  = new BeatDetector();
    const fft = bassFFT(-30);
    feed(bd, fft, 43);
    // Same level as average → energy ≈ avg, not > 1.4×
    expect(bd.detect(fft, SR, FFT_SIZE)).toBe(false);
  });

  it('does not detect a second beat within the 250 ms debounce window', () => {
    const bd  = new BeatDetector();
    const loud = bassFFT(-10);
    feed(bd, bassFFT(-40), 43);

    expect(bd.detect(loud, SR, FFT_SIZE)).toBe(true); // first beat (clock at 2000ms)

    // No time advanced — performance.now() unchanged, so now - lastBeatAt = 0 < 250ms
    expect(bd.detect(loud, SR, FFT_SIZE)).toBe(false);
  });

  it('ignores spikes in non-bass frequencies', () => {
    const bd = new BeatDetector();
    // Fill history with silence in the bass range
    feed(bd, new Float32Array(BINS).fill(-100), 43);

    // Loud spike only at 1 kHz — bass bins stay silent
    const highFft = new Float32Array(BINS).fill(-100);
    highFft[Math.round(1000 / BIN_HZ)] = -5;

    expect(bd.detect(highFft, SR, FFT_SIZE)).toBe(false);
  });
});
