import type { Request, Response } from 'express';
import type { SessionConfig } from '@lsd2/protocol';
import {
  createSession,
  getSession,
  getOrCreateSession,
  deleteSession,
  listSessions,
} from '../session-store.js';

export function listSessionsHandler(_req: Request, res: Response): void {
  const sessions = listSessions().map(s => ({
    id: s.id,
    config: s.config,
    capturers: s.capturers.size,
    presenters: s.presenters.size,
    createdAt: s.createdAt,
  }));
  res.json({ sessions });
}

export function createSessionHandler(req: Request, res: Response): void {
  const { id } = req.body as { id?: string };
  const session = createSession(id);
  res.status(201).json({ sessionId: session.id, config: session.config });
}

export function getSessionHandler(req: Request, res: Response): void {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({
    id: session.id,
    config: session.config,
    capturers: session.capturers.size,
    presenters: session.presenters.size,
    createdAt: session.createdAt,
  });
}

export function deleteSessionHandler(req: Request, res: Response): void {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  deleteSession(req.params.id);
  res.status(204).end();
}

export function updateSessionConfigHandler(req: Request, res: Response): void {
  const session = getOrCreateSession(req.params.id);

  const updates = req.body as Partial<SessionConfig>;

  // Changing intervalTonic resets auto-detection so the new tonic takes effect immediately
  if ('intervalTonic' in updates) {
    session.detectedTonicSemitone = null;
  }

  // Changing scheme resets the smoother so there's no stale locked note
  if ('colorScheme' in updates) {
    session.smoother.reset();
    session.detectedTonicSemitone = null;
  }

  Object.assign(session.config, updates);
  res.json(session.config);
}
