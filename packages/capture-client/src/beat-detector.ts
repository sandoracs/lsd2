const BASS_LOW_HZ = 60;
const BASS_HIGH_HZ = 200;
const HISTORY_SIZE = 43; // ~1.4s at 30fps
const BEAT_THRESHOLD = 1.4; // current energy must exceed 1.4× running average
const MIN_BEAT_INTERVAL_MS = 250;

export class BeatDetector {
  private history: number[] = [];
  private lastBeatAt = 0;

  detect(freqDomain: Float32Array, sampleRate: number, fftSize: number): boolean {
    const binHz = sampleRate / fftSize;
    const lowBin = Math.floor(BASS_LOW_HZ / binHz);
    const highBin = Math.min(Math.ceil(BASS_HIGH_HZ / binHz), freqDomain.length - 1);

    let sum = 0;
    const count = highBin - lowBin + 1;
    for (let i = lowBin; i <= highBin; i++) {
      const linear = Math.pow(10, freqDomain[i] / 20);
      sum += linear * linear;
    }
    const energy = Math.sqrt(sum / count);

    this.history.push(energy);
    if (this.history.length > HISTORY_SIZE) this.history.shift();
    if (this.history.length < HISTORY_SIZE) return false;

    const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const now = performance.now();

    if (avg > 0 && energy > BEAT_THRESHOLD * avg && now - this.lastBeatAt > MIN_BEAT_INTERVAL_MS) {
      this.lastBeatAt = now;
      return true;
    }
    return false;
  }
}
