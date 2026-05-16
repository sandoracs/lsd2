import { describe, it, expect } from 'vitest';
import type { NoteFrame } from '@lsd2/protocol';
import { applyColorMapping } from '../color-mapper.js';
import { DEFAULT_CONFIG } from '../session-store.js';

const config = { ...DEFAULT_CONFIG }; // chromatic, no custom mapping

const silentFrame: NoteFrame = {
  type: 'note_frame', timestamp: 1000, sessionId: 'test',
  silence: true, beat: false, chord: null, key: null,
  fundamental: { frequency: 0, amplitude: 0, note: '', octave: 0, cents: 0 },
  overtones: [], maxOvertones: 8,
};

const activeFrame: NoteFrame = {
  type: 'note_frame', timestamp: 2000, sessionId: 'test',
  silence: false, beat: true, chord: 'Am', key: 'A minor',
  fundamental: { frequency: 440, amplitude: 0.8, note: 'A', octave: 4, cents: 0 },
  overtones: [
    { frequency: 880, amplitude: 0.4, note: 'A', octave: 5, cents: 0 },
  ],
  maxOvertones: 8,
};

describe('applyColorMapping — silent frame', () => {
  it('produces type "color_frame"', () => {
    expect(applyColorMapping(silentFrame, config, 0).type).toBe('color_frame');
  });

  it('preserves silence: true', () => {
    expect(applyColorMapping(silentFrame, config, 0).silence).toBe(true);
  });

  it('gives fundamental a near-black color (s=0, l=5)', () => {
    const { fundamental } = applyColorMapping(silentFrame, config, 0);
    expect(fundamental.color.s).toBe(0);
    expect(fundamental.color.l).toBe(5);
  });

  it('carries forward timestamp, sessionId, beat, chord, key', () => {
    const out = applyColorMapping(silentFrame, config, 0);
    expect(out.timestamp).toBe(1000);
    expect(out.sessionId).toBe('test');
    expect(out.beat).toBe(false);
    expect(out.chord).toBeNull();
    expect(out.key).toBeNull();
  });
});

describe('applyColorMapping — active frame', () => {
  it('produces type "color_frame"', () => {
    expect(applyColorMapping(activeFrame, config, 0).type).toBe('color_frame');
  });

  it('preserves silence: false', () => {
    expect(applyColorMapping(activeFrame, config, 0).silence).toBe(false);
  });

  it('applies chromatic color to A4 (hue 270)', () => {
    const { fundamental } = applyColorMapping(activeFrame, config, 0);
    expect(fundamental.color.h).toBe(270); // A = semitone 9 × 30°
    expect(fundamental.color.s).toBe(85);
  });

  it('colors all overtones', () => {
    const { overtones } = applyColorMapping(activeFrame, config, 0);
    expect(overtones).toHaveLength(1);
    expect(overtones[0].color).toHaveProperty('h');
    expect(overtones[0].color).toHaveProperty('s');
    expect(overtones[0].color).toHaveProperty('l');
  });

  it('preserves beat, chord, and key from the source frame', () => {
    const out = applyColorMapping(activeFrame, config, 0);
    expect(out.beat).toBe(true);
    expect(out.chord).toBe('Am');
    expect(out.key).toBe('A minor');
  });

  it('uses the configured color scheme', () => {
    const newtonConfig = { ...config, colorScheme: 'newton' as const };
    const chromatic = applyColorMapping(activeFrame, config, 0).fundamental.color;
    const newton    = applyColorMapping(activeFrame, newtonConfig, 0).fundamental.color;
    // A4 → chromatic hue 270; newton uses a different mapping
    expect(newton.h).not.toBe(chromatic.h);
  });

  it('passes intervalTonicSemitone through to the interval scheme', () => {
    const intervalConfig = { ...config, colorScheme: 'interval' as const };
    // Tonic A (semitone 9): A4 is the unison → hue 0
    const withA = applyColorMapping(activeFrame, intervalConfig, 9).fundamental.color;
    // Tonic C (semitone 0): A4 is a major 6th from C → different hue
    const withC = applyColorMapping(activeFrame, intervalConfig, 0).fundamental.color;
    expect(withA.h).toBe(0);    // unison = hue 0
    expect(withC.h).not.toBe(0);
  });
});
