import type { NoteFrame } from '@lsd2/protocol';
import { PolyphonicDetector } from './polyphonic-detector.js';
import { BeatDetector } from './beat-detector.js';
import { detectChord } from './chord-detector.js';
import { KeyDetector } from './key-detector.js';
import { transposePitch } from './transpose.js';

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
  transposeBy: number;  // semitones: +2 = Bb instrument, +9 = Eb, +7 = F
  frameRateHz: number;
  onFrame: (frame: NoteFrame) => void;
  onAmplitude: (db: number) => void;
}

export interface CaptureControls {
  stop: () => void;
  setNoiseGate: (db: number) => void;
  setTranspose: (semitones: number) => void;
}

export async function startCapture(options: CaptureOptions): Promise<CaptureControls> {
  const { sessionId, maxOvertones, frameRateHz, onFrame, onAmplitude } = options;
  let noiseGateDb = options.noiseGateDb;
  let transposeBy = options.transposeBy;

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
  const keyDetect  = new KeyDetector();

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
        silence: true, beat: false, chord: null, key: keyDetect.detect(),
        fundamental: { frequency: 0, amplitude: 0, note: '', octave: 0, cents: 0 },
        overtones: [], maxOvertones,
      });
      return;
    }

    // Detect up to (1 fundamental + maxOvertones) simultaneous pitches
    const pitches = polyDetect.detect(freqDomain, audioCtx.sampleRate, analyser.fftSize, noiseGateDb, 1 + maxOvertones);
    if (pitches.length === 0) return;

    const transposed = pitches.map(p => transposePitch(p, transposeBy));
    const noteNames = transposed.map(p => p.note).filter(n => n !== '');
    const chord = detectChord(noteNames)?.label ?? null;
    for (const p of transposed) keyDetect.update(p.note, p.amplitude);
    const key = keyDetect.detect();

    onFrame({
      type: 'note_frame', timestamp: Date.now(), sessionId,
      silence: false, beat, chord, key,
      fundamental: transposed[0],
      overtones:   transposed.slice(1),
      maxOvertones,
    });
  }, Math.round(1000 / frameRateHz));

  return {
    stop() {
      clearInterval(interval);
      stream.getTracks().forEach(t => t.stop());
      void audioCtx.close();
    },
    setNoiseGate(db: number) { noiseGateDb = db; },
    setTranspose(semitones: number) { transposeBy = semitones; },
  };
}
