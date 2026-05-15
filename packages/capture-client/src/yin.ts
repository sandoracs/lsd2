/**
 * YIN pitch detection algorithm.
 * Returns the fundamental frequency in Hz, or null if no confident pitch found.
 * Frequency range guarded to 50–2000 Hz (covers all common instruments / voice).
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const n = buffer.length;
  const half = n >> 1;

  // Steps 1 + 2 combined: difference function + cumulative mean normalised difference
  const cmnd = new Float32Array(half);
  cmnd[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau < half; tau++) {
    let diff = 0;
    for (let i = 0; i < half; i++) {
      const d = buffer[i] - buffer[i + tau];
      diff += d * d;
    }
    runningSum += diff;
    cmnd[tau] = runningSum > 0 ? (diff * tau) / runningSum : 1;
  }

  // Step 3: find first tau below absolute threshold that is a local minimum
  const threshold = 0.10;
  let tau = 2;
  while (tau < half - 1) {
    if (cmnd[tau] < threshold && cmnd[tau] <= cmnd[tau + 1]) break;
    tau++;
  }
  if (tau >= half - 1 || cmnd[tau] >= threshold) return null;

  // Frequency range guard
  const f0approx = sampleRate / tau;
  if (f0approx < 50 || f0approx > 2000) return null;

  // Step 4: parabolic interpolation for sub-sample accuracy
  const s0 = cmnd[tau - 1];
  const s1 = cmnd[tau];
  const s2 = cmnd[tau + 1];
  const denom = 2 * (2 * s1 - s2 - s0);
  const tauRefined = denom === 0 ? tau : tau + (s2 - s0) / denom;

  return sampleRate / tauRefined;
}
