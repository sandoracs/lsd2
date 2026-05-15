import type { NoteFrame, PitchData } from '@lsd2/protocol';
import { detectPitch } from './yin.js';
import { extractOvertones } from './overtone-extractor.js';
import { BeatDetector } from './beat-detector.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(frequency: number): { note: string; octave: number; cents: number } {
  const midi = 12 * Math.log2(frequency / 440) + 69;
  const rounded = Math.round(midi);
  const semitone = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const cents = Math.round((midi - rounded) * 100);
  return { note: NOTE_NAMES[semitone], octave, cents };
}

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

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const source = audioCtx.createMediaStreamSource(stream);

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;        // 2048 samples: 4× faster YIN, still covers 50 Hz floor
  analyser.smoothingTimeConstant = 0.1; // minimal smoothing → faster overtone response
  source.connect(analyser);

  const timeDomain = new Float32Array(analyser.fftSize);
  const freqDomain = new Float32Array(analyser.frequencyBinCount);
  const beatDetector = new BeatDetector();

  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(timeDomain);
    analyser.getFloatFrequencyData(freqDomain);

    const rms = computeRMS(timeDomain);
    const db = rmsToDb(rms);
    onAmplitude(db);
    const beat = beatDetector.detect(freqDomain, audioCtx.sampleRate, analyser.fftSize);

    if (db < noiseGateDb) {
      onFrame({
        type: 'note_frame',
        timestamp: Date.now(),
        sessionId,
        silence: true,
        fundamental: { frequency: 0, amplitude: 0, note: '', octave: 0, cents: 0 },
        overtones: [],
        maxOvertones,
        beat: false,
      });
      return;
    }

    const fundamentalHz = detectPitch(timeDomain, audioCtx.sampleRate);
    if (fundamentalHz === null) return;

    // Normalize amplitude: RMS of 0.1 ≈ loud signal; scale to 0–1
    const amplitude = Math.min(1, rms * 8);
    const { note, octave, cents } = frequencyToNote(fundamentalHz);
    const fundamental: PitchData = { frequency: fundamentalHz, amplitude, note, octave, cents };

    const rawOvertones = extractOvertones(
      freqDomain,
      fundamentalHz,
      audioCtx.sampleRate,
      analyser.fftSize,   // fftSize = 4096, not frequencyBinCount
      maxOvertones,
      noiseGateDb,
    );

    const overtones: PitchData[] = rawOvertones.map(o => {
      const nInfo = frequencyToNote(o.frequency);
      return { frequency: o.frequency, amplitude: o.amplitude, ...nInfo };
    });

    onFrame({
      type: 'note_frame',
      timestamp: Date.now(),
      sessionId,
      silence: false,
      fundamental,
      overtones,
      maxOvertones,
      beat,
    });
  }, Math.round(1000 / frameRateHz));

  return () => {
    clearInterval(interval);
    stream.getTracks().forEach(t => t.stop());
    void audioCtx.close();
  };
}
