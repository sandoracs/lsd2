import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { NoteFrame } from '@lsd2/protocol';
import { noteNameToSemitone } from '@lsd2/color-mapping';
import { getOrCreateSession } from './session-store.js';
import { applyColorMapping } from './color-mapper.js';

function resolveTonicSemitone(
  config: { colorScheme: string; intervalTonic: string | null },
  detectedSemitone: number | null,
): number {
  if (config.intervalTonic) {
    return noteNameToSemitone(config.intervalTonic) ?? 0;
  }
  return detectedSemitone ?? 0; // Default to C
}

export function createWsHub(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId') ?? 'default';
    const role = url.searchParams.get('role') ?? 'presenter';

    if (role !== 'capturer' && role !== 'presenter') {
      ws.close(4000, 'Invalid role. Use role=capturer or role=presenter');
      return;
    }

    const session = getOrCreateSession(sessionId);
    ws.send(JSON.stringify({ type: 'connected', sessionId, role }));

    if (role === 'capturer') {
      session.capturers.add(ws);

      ws.on('message', (data) => {
        try {
          const frame = JSON.parse(data.toString()) as NoteFrame;
          if (frame.type !== 'note_frame') return;

          if (frame.silence) {
            session.smoother.reset();
            const colorFrame = applyColorMapping(frame, session.config, 0);
            broadcast(session.presenters, colorFrame);
            return;
          }

          // Apply pitch smoother to fundamental only
          const smoothed = session.smoother.smooth(
            frame.fundamental.frequency,
            session.config.smoothingWindow,
          );
          if (smoothed === null) return; // Smoother rejected transient

          const smoothedFrame: NoteFrame = {
            ...frame,
            fundamental: { ...frame.fundamental, frequency: smoothed },
          };

          // Auto-detect tonic for 'interval' scheme on first real note
          if (
            session.config.colorScheme === 'interval' &&
            session.config.intervalTonic === null &&
            session.detectedTonicSemitone === null
          ) {
            session.detectedTonicSemitone = noteNameToSemitone(frame.fundamental.note) ?? 0;
          }

          const tonicSemitone = resolveTonicSemitone(session.config, session.detectedTonicSemitone);
          const colorFrame = applyColorMapping(smoothedFrame, session.config, tonicSemitone);
          broadcast(session.presenters, colorFrame);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => session.capturers.delete(ws));
    } else {
      session.presenters.add(ws);
      ws.on('close', () => session.presenters.delete(ws));
    }
  });

  return wss;
}

function broadcast(presenters: Set<WebSocket>, frame: object): void {
  const json = JSON.stringify(frame);
  for (const p of presenters) {
    if (p.readyState === WebSocket.OPEN) {
      p.send(json);
    } else {
      presenters.delete(p);
    }
  }
}
