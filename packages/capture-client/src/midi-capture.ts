import type { NoteFrame } from '@lsd2/protocol';
import type { CaptureOptions, CaptureControls } from './audio-capture.js';
import { detectChord } from './chord-detector.js';
import { KeyDetector } from './key-detector.js';
import { transposePitch } from './transpose.js';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MIN_BEAT_INTERVAL_MS = 250;

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Map gate slider value (–60..–10 dB) to min MIDI velocity (1..100)
function gateToMinVelocity(gateDb: number): number {
  return Math.max(1, Math.round((gateDb + 60) / 50 * 100));
}

interface ActiveNote {
  frequency: number;
  note: string;
  octave: number;
  amplitude: number; // 0–1 (velocity / 127)
}

export async function startMidiCapture(
  options: CaptureOptions,
  inputId: string,
): Promise<CaptureControls> {
  if (!navigator.requestMIDIAccess) throw new Error('Web MIDI API not supported in this browser');
  const access = await navigator.requestMIDIAccess();

  const activeNotes = new Map<number, ActiveNote>();
  const keyDetect = new KeyDetector();
  let minVelocity = gateToMinVelocity(options.noiseGateDb);
  let transposeBy = options.transposeBy;
  let pendingBeat = false;
  let lastBeatAt = 0;

  function handleMessage(ev: MIDIMessageEvent): void {
    if (!ev.data || ev.data.length < 2) return;
    const status   = ev.data[0];
    const midiNote = ev.data[1];
    const velocity = ev.data.length > 2 ? ev.data[2] : 0;
    const type     = status & 0xf0;

    if (type === 0x90 && velocity > 0) {
      if (velocity < minVelocity) return;
      const noteName  = NOTE_NAMES[midiNote % 12];
      const octave    = Math.floor(midiNote / 12) - 1;
      const amplitude = velocity / 127;
      activeNotes.set(midiNote, { frequency: midiToFreq(midiNote), note: noteName, octave, amplitude });
      keyDetect.update(noteName, amplitude);

      const now = performance.now();
      if (velocity >= 80 && now - lastBeatAt >= MIN_BEAT_INTERVAL_MS) {
        lastBeatAt = now;
        pendingBeat = true;
      }
    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
      activeNotes.delete(midiNote);
    }
  }

  function attachListeners(): void {
    for (const input of access.inputs.values()) {
      if (!inputId || input.id === inputId) {
        input.onmidimessage = (ev) => handleMessage(ev);
      }
    }
  }
  attachListeners();
  access.onstatechange = () => attachListeners();

  const interval = setInterval(() => {
    const beat = pendingBeat;
    pendingBeat = false;

    const notes = [...activeNotes.values()].sort((a, b) => b.amplitude - a.amplitude);
    const maxAmp = notes[0]?.amplitude ?? 0;
    // Map amplitude to same –60..–10 range as the VU bar
    options.onAmplitude(-60 + maxAmp * 50);

    if (notes.length === 0) {
      options.onFrame({
        type: 'note_frame', timestamp: Date.now(), sessionId: options.sessionId,
        silence: true, beat: false, chord: null, key: keyDetect.detect(),
        fundamental: { frequency: 0, amplitude: 0, note: '', octave: 0, cents: 0 },
        overtones: [], maxOvertones: options.maxOvertones,
      });
      return;
    }

    const toNote = (n: ActiveNote): NoteFrame['fundamental'] => ({ ...n, cents: 0 });
    const transposed = notes.map(n => transposePitch(toNote(n), transposeBy));
    const noteNames = transposed.map(n => n.note);
    const chord = detectChord(noteNames)?.label ?? null;

    options.onFrame({
      type: 'note_frame', timestamp: Date.now(), sessionId: options.sessionId,
      silence: false, beat, chord, key: keyDetect.detect(),
      fundamental: transposed[0],
      overtones: transposed.slice(1, 1 + options.maxOvertones),
      maxOvertones: options.maxOvertones,
    });
  }, Math.round(1000 / options.frameRateHz));

  return {
    stop() {
      clearInterval(interval);
      for (const input of access.inputs.values()) input.onmidimessage = null;
    },
    setNoiseGate(db: number) { minVelocity = gateToMinVelocity(db); },
    setTranspose(semitones: number) { transposeBy = semitones; },
  };
}

export async function listMidiInputs(): Promise<Array<{ id: string; name: string }>> {
  try {
    if (!navigator.requestMIDIAccess) return [];
    const access = await navigator.requestMIDIAccess();
    return [...access.inputs.values()].map(i => ({ id: i.id, name: i.name ?? i.id }));
  } catch {
    return [];
  }
}
