import { describe, it, expect, afterEach } from 'vitest';
import {
  createSession,
  getSession,
  getOrCreateSession,
  deleteSession,
  listSessions,
  DEFAULT_CONFIG,
} from '../session-store.js';

// Track IDs created during each test so we can clean up afterward.
const created: string[] = [];
function make(id: string) {
  created.push(id);
  return createSession(id);
}

afterEach(() => {
  for (const id of created) deleteSession(id);
  created.length = 0;
});

describe('createSession', () => {
  it('stores the session with the provided id', () => {
    const s = make('ss-create-1');
    expect(s.id).toBe('ss-create-1');
  });

  it('initialises config with default values', () => {
    const { config } = make('ss-create-2');
    expect(config.colorScheme).toBe(DEFAULT_CONFIG.colorScheme);
    expect(config.maxOvertones).toBe(DEFAULT_CONFIG.maxOvertones);
    expect(config.noiseGateDb).toBe(DEFAULT_CONFIG.noiseGateDb);
  });

  it('starts with empty capturer and presenter sets', () => {
    const { capturers, presenters } = make('ss-create-3');
    expect(capturers.size).toBe(0);
    expect(capturers.size).toBe(0);
    expect(presenters.size).toBe(0);
  });

  it('generates a UUID when no id is provided', () => {
    const s = createSession();
    created.push(s.id);
    expect(s.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('each session gets an independent copy of the default config', () => {
    const a = make('ss-create-4a');
    const b = make('ss-create-4b');
    a.config.colorScheme = 'newton';
    expect(b.config.colorScheme).toBe(DEFAULT_CONFIG.colorScheme);
  });
});

describe('getSession', () => {
  it('returns the session that was created', () => {
    const original = make('ss-get-1');
    expect(getSession('ss-get-1')).toBe(original);
  });

  it('returns undefined for a non-existent id', () => {
    expect(getSession('does-not-exist-xyz')).toBeUndefined();
  });
});

describe('getOrCreateSession', () => {
  it('creates a session if one does not exist', () => {
    const s = getOrCreateSession('ss-goc-1');
    created.push('ss-goc-1');
    expect(s.id).toBe('ss-goc-1');
  });

  it('returns the existing session if one already exists', () => {
    const original = make('ss-goc-2');
    expect(getOrCreateSession('ss-goc-2')).toBe(original);
  });
});

describe('deleteSession', () => {
  it('removes the session so getSession returns undefined', () => {
    createSession('ss-del-1'); // not tracking — we delete it ourselves
    deleteSession('ss-del-1');
    expect(getSession('ss-del-1')).toBeUndefined();
  });

  it('is a no-op for a non-existent session', () => {
    expect(() => deleteSession('never-existed')).not.toThrow();
  });
});

describe('listSessions', () => {
  it('includes all created sessions', () => {
    make('ss-list-1');
    make('ss-list-2');
    const ids = listSessions().map(s => s.id);
    expect(ids).toContain('ss-list-1');
    expect(ids).toContain('ss-list-2');
  });
});
