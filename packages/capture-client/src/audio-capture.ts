import type { NoteFrame } from '@lsd2/protocol';
import { PolyphonicDetector } from './polyphonic-detector.js';
import { BeatDetector } from './beat-detector.js';

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

function rmsToDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-10));
}

export interface CaptureOptions {
  sessionId: string;
  maxOvertones: number;
  noiseGateDb: number;
  frameRateHz: number;
  onFrame: (frame: NoteFrame) => void;
  onAmplitude: (db: number) => void;
}

export async function startCapture(options: CaptureOptions): Promise<() => void> {
  const { sessionId, maxOvertones, noiseGateDb, frameRateHz, onFrame, onAmplitude } = options;

  const stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const source   = audioCtx.createMediaStreamSource(stream);

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;           // 10.8 Hz/bin — better chord resolution than 2048
  analyser.smoothingTimeConstant = 0.1;
  source.connect(analyser);

  const timeDomain = new Float32Array(analyser.fftSize);
  const freqDomain = new Float32Array(analyser.frequencyBinCount);
  const polyDetect = new PolyphonicDetector(analyser.frequencyBinCount);
  const beatDetect = new BeatDetector();

  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(timeDomain);
    analyser.getFloatFrequencyData(freqDomain);

    const rms = computeRMS(timeDomain);
    const db  = rmsToDb(rms);
    onAmplitude(db);

    const beat = beatDetect.detect(freqDomain, audioCtx.sampleRate, analyser.fftSize);

    if (db < noiseGateDb) {
      onFrame({
        type: 'note_frame', timestamp: Date.now(), sessionId,
        silence: true, beat: false,
        fundamental: { frequency: 0, amplitude: 0, note: '', octave: 0, cents: 0 },
        overtones: [], maxOvertones,
      });
      return;
    }

    // Detect up to (1 fundamental + maxOvertones) simultaneous pitches
    const pitches = polyDetect.detect(freqDomain, audioCtx.sampleRate, analyser.fftSize, noiseGateDb, 1 + maxOvertones);
    if (pitches.length === 0) return;

    onFrame({
      type: 'note_frame', timestamp: Date.now(), sessionId,
      silence: false, beat,
      fundamental: pitches[0],
      overtones:   pitches.slice(1),
      maxOvertones,
    });
  }, Math.round(1000 / frameRateHz));

  return () => {
    clearInterval(interval);
    stream.getTracks().forEach(t => t.stop());
    void audioCtx.close();
  };
}
