import type { NoteFrame, ColorFrame, ColoredNote, PitchData, SessionConfig, HSLColor } from '@lsd2/protocol';
import { mapFrequencyToColor } from '@lsd2/color-mapping';

const SILENT_COLOR: HSLColor = { h: 0, s: 0, l: 5 };

function colorNote(
  pitch: PitchData,
  config: SessionConfig,
  intervalTonicSemitone: number,
): ColoredNote {
  const color = mapFrequencyToColor(pitch.frequency, pitch.amplitude, config.colorScheme, {
    intervalTonicSemitone,
    customMapping: config.customMapping,
  });
  return { ...pitch, color };
}

export function applyColorMapping(
  frame: NoteFrame,
  config: SessionConfig,
  intervalTonicSemitone: number,
): ColorFrame {
  if (frame.silence) {
    return {
      type: 'color_frame',
      timestamp: frame.timestamp,
      sessionId: frame.sessionId,
      silence: true,
      colorScheme: config.colorScheme,
      fundamental: { ...frame.fundamental, color: SILENT_COLOR },
      overtones: frame.overtones.map(o => ({ ...o, color: SILENT_COLOR })),
      beat: frame.beat,
    };
  }
  return {
    type: 'color_frame',
    timestamp: frame.timestamp,
    sessionId: frame.sessionId,
    silence: false,
    colorScheme: config.colorScheme,
    fundamental: colorNote(frame.fundamental, config, intervalTonicSemitone),
    overtones: frame.overtones.map(o => colorNote(o, config, intervalTonicSemitone)),
    beat: frame.beat,
  };
}
