export interface OvertoneData {
  frequency: number;
  amplitude: number;
}

export function extractOvertones(
  fftBuffer: Float32Array,
  fundamentalHz: number,
  sampleRate: number,
  fftSize: number,
  maxOvertones: number,
  noiseGateDb = -40,
): OvertoneData[] {
  const binWidth = sampleRate / fftSize;
  const result: OvertoneData[] = [];

  for (let n = 2; n <= maxOvertones + 1; n++) {
    const targetHz = fundamentalHz * n;
    if (targetHz > sampleRate / 2) break;

    const targetBin = Math.round(targetHz / binWidth);
    let maxDb = -Infinity;
    const lo = Math.max(0, targetBin - 3);
    const hi = Math.min(fftBuffer.length - 1, targetBin + 3);
    for (let b = lo; b <= hi; b++) {
      if (fftBuffer[b] > maxDb) maxDb = fftBuffer[b];
    }

    // Normalize: noise gate = 0.0, 0 dB = 1.0
    const amplitude = Math.max(0, Math.min(1, (maxDb - noiseGateDb) / (-noiseGateDb)));
    result.push({ frequency: targetHz, amplitude });
  }

  return result;
}
