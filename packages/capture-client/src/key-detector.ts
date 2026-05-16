// Krumhansl-Kessler key profiles — empirically derived note salience per key
const MAJOR: number[] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR: number[] = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const HALF_LIFE_MS = 8000;
const MIN_ENERGY   = 0.5;

function pearson(hist: Float32Array, profile: number[], root: number): number {
  let sumH = 0, sumP = 0;
  for (let i = 0; i < 12; i++) { sumH += hist[i]; sumP += profile[(i - root + 12) % 12]; }
  const mH = sumH / 12, mP = sumP / 12;
  let cov = 0, varH = 0, varP = 0;
  for (let i = 0; i < 12; i++) {
    const dH = hist[i] - mH;
    const dP = profile[(i - root + 12) % 12] - mP;
    cov += dH * dP; varH += dH * dH; varP += dP * dP;
  }
  if (varH < 1e-10 || varP < 1e-10) return 0;
  return cov / Math.sqrt(varH * varP);
}

export class KeyDetector {
  private histogram = new Float32Array(12);
  private lastAt = 0;

  update(noteName: string, amplitude: number): void {
    const semi = NAMES.indexOf(noteName);
    if (semi < 0) return;
    const now = performance.now();
    if (this.lastAt > 0) {
      const decay = Math.pow(0.5, (now - this.lastAt) / HALF_LIFE_MS);
      for (let i = 0; i < 12; i++) this.histogram[i] *= decay;
    }
    this.lastAt = now;
    this.histogram[semi] += amplitude;
  }

  detect(): string | null {
    const energy = this.histogram.reduce((s, v) => s + v, 0);
    if (energy < MIN_ENERGY) return null;
    let best = -Infinity, bestKey = '';
    for (let root = 0; root < 12; root++) {
      const maj = pearson(this.histogram, MAJOR, root);
      const min = pearson(this.histogram, MINOR, root);
      if (maj > best) { best = maj; bestKey = `${NAMES[root]} major`; }
      if (min > best) { best = min; bestKey = `${NAMES[root]} minor`; }
    }
    return bestKey || null;
  }

  reset(): void { this.histogram.fill(0); this.lastAt = 0; }
}
