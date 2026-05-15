import type { SessionConfig } from '@lsd2/protocol';
import type { WebSocket } from 'ws';
import { NoteSmoother } from './smoother.js';

export const DEFAULT_CONFIG: SessionConfig = {
  colorScheme: 'chromatic',
  maxOvertones: 8,
  noiseGateDb: -40,
  colorDecayMs: 3000,
  smoothingWindow: 2,
  intervalTonic: null,
  customMapping: null,
};

export interface Session {
  id: string;
  config: SessionConfig;
  capturers: Set<WebSocket>;
  presenters: Set<WebSocket>;
  createdAt: number;
  // Runtime state — not part of the serialisable config
  smoother: NoteSmoother;
  detectedTonicSemitone: number | null; // auto-detected tonic for 'interval' scheme
}

const store = new Map<string, Session>();

export function createSession(id?: string): Session {
  const sessionId = id ?? crypto.randomUUID();
  const session: Session = {
    id: sessionId,
    config: { ...DEFAULT_CONFIG },
    capturers: new Set(),
    presenters: new Set(),
    createdAt: Date.now(),
    smoother: new NoteSmoother(),
    detectedTonicSemitone: null,
  };
  store.set(sessionId, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return store.get(id);
}

export function getOrCreateSession(id: string): Session {
  return store.get(id) ?? createSession(id);
}

export function deleteSession(id: string): void {
  const session = store.get(id);
  if (!session) return;
  for (const ws of session.capturers) ws.close(1000, 'Session deleted');
  for (const ws of session.presenters) ws.close(1000, 'Session deleted');
  store.delete(id);
}

export function listSessions(): Session[] {
  return Array.from(store.values());
}
