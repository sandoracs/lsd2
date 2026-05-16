import type { ColorFrame, ColorSchemeName, SessionConfig } from '@lsd2/protocol';
import { createWsReceiver, type WsReceiver } from './ws-receiver.js';
import type { Renderer, MetaphorName } from './renderer.js';

const STORAGE_KEY = 'lsd2-web';

function loadSettings(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>; }
  catch { return {}; }
}

function saveSettings(data: Record<string, string>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function wsToHttp(wsUrl: string): string {
  return wsUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
}

async function fetchSessionConfig(
  httpBase: string,
  sessionId: string,
): Promise<SessionConfig | null> {
  try {
    const res = await fetch(`${httpBase}/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return null;
    const data = await res.json() as { config: SessionConfig };
    return data.config ?? null;
  } catch {
    return null;
  }
}

async function pushConfig(
  httpBase: string,
  sessionId: string,
  updates: Partial<SessionConfig>,
): Promise<void> {
  try {
    await fetch(`${httpBase}/sessions/${encodeURIComponent(sessionId)}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    // Best-effort
  }
}

export function initUI(renderer: Renderer): void {
  const certLink        = document.getElementById('cert-link') as HTMLAnchorElement | null;
  const serverUrlInput  = document.getElementById('server-url') as HTMLInputElement;
  const sessionIdInput  = document.getElementById('session-id') as HTMLInputElement;
  const connectBtn      = document.getElementById('connect-btn') as HTMLButtonElement;
  const statusEl        = document.getElementById('status') as HTMLDivElement;
  const overlayNote     = document.getElementById('overlay-note') as HTMLDivElement;
  const panel           = document.getElementById('panel') as HTMLDivElement;
  const metaphorSelect  = document.getElementById('metaphor-select') as HTMLSelectElement;
  const schemeSelect    = document.getElementById('scheme-select') as HTMLSelectElement;
  const decayRange      = document.getElementById('decay-range') as HTMLInputElement;
  const decayVal        = document.getElementById('decay-val') as HTMLSpanElement;
  const decayLabel      = document.getElementById('decay-label') as HTMLSpanElement;
  const smoothRange     = document.getElementById('smooth-range') as HTMLInputElement;
  const smoothVal       = document.getElementById('smooth-val') as HTMLSpanElement;
  const smoothLabel     = document.getElementById('smooth-label') as HTMLSpanElement;

  function updateCertLink() {
    if (!certLink) return;
    const raw = serverUrlInput.value.trim();
    const base = raw.replace(/^wss?:\/\//, 'https://').replace(/^https?:\/\//, 'https://');
    const url = /^https:\/\//.test(base) ? base : `https://${raw}`;
    certLink.href = `${url}/health`;
  }
  serverUrlInput.addEventListener('input', updateCertLink);
  updateCertLink();

  // Restore settings
  const saved = loadSettings();
  if (saved.serverUrl)  serverUrlInput.value  = saved.serverUrl;
  if (saved.sessionId)  sessionIdInput.value  = saved.sessionId;
  if (saved.metaphor)   metaphorSelect.value  = saved.metaphor;
  if (saved.decayMs) {
    decayRange.value = saved.decayMs;
    decayVal.textContent   = saved.decayMs;
    decayLabel.textContent = `${(Number(saved.decayMs) / 1000).toFixed(1)} s`;
    renderer.setDecayMs(Number(saved.decayMs));
  }
  renderer.setMetaphor((metaphorSelect.value || 'aurora') as MetaphorName);

  let receiver: WsReceiver | null = null;
  let connected = false;
  let currentHttpBase = '';
  let currentSessionId = '';

  function setStatus(text: string, bg: string) {
    statusEl.textContent = text;
    statusEl.style.background = bg;
  }

  function setControlsEnabled(enabled: boolean) {
    schemeSelect.disabled = !enabled;
    smoothRange.disabled = !enabled;
  }

  function onFrame(frame: ColorFrame) {
    renderer.render(frame);
    if (!frame.silence && frame.fundamental.note) {
      overlayNote.textContent = `${frame.fundamental.note}${frame.fundamental.octave}`;
    } else {
      overlayNote.textContent = '—';
    }
  }

  // Metaphor selector
  metaphorSelect.addEventListener('change', () => {
    renderer.setMetaphor(metaphorSelect.value as MetaphorName);
    saveSettings({ serverUrl: serverUrlInput.value, sessionId: sessionIdInput.value,
      metaphor: metaphorSelect.value, decayMs: decayRange.value });
  });

  // Decay control — local only (affects renderer, not server config)
  decayRange.addEventListener('input', () => {
    const ms = parseInt(decayRange.value);
    decayVal.textContent = String(ms);
    decayLabel.textContent = `${(ms / 1000).toFixed(1)} s`;
    renderer.setDecayMs(ms);
  });

  // Smoothing control — pushes to server
  smoothRange.addEventListener('input', () => {
    const val = parseInt(smoothRange.value);
    smoothVal.textContent = String(val);
    smoothLabel.textContent = String(val);
    void pushConfig(currentHttpBase, currentSessionId, { smoothingWindow: val });
  });

  // Color scheme — pushes to server
  schemeSelect.addEventListener('change', () => {
    void pushConfig(currentHttpBase, currentSessionId, {
      colorScheme: schemeSelect.value as ColorSchemeName,
    });
  });

  connectBtn.addEventListener('click', async () => {
    if (connected) {
      receiver?.close();
      receiver = null;
      connected = false;
      connectBtn.textContent = 'Connect';
      connectBtn.classList.remove('disconnect');
      setStatus('Disconnected', '#222');
      setControlsEnabled(false);
      return;
    }

    const serverUrl = serverUrlInput.value.trim();
    const sessionId = sessionIdInput.value.trim() || 'default';
    saveSettings({ serverUrl, sessionId, metaphor: metaphorSelect.value, decayMs: decayRange.value });
    currentHttpBase = wsToHttp(serverUrl);
    currentSessionId = sessionId;

    const wsUrl = `${serverUrl}/ws?sessionId=${encodeURIComponent(sessionId)}&role=presenter`;
    receiver = createWsReceiver(wsUrl, onFrame);

    receiver.onStatusChange = async (status) => {
      if (status === 'connected') {
        setStatus('● Live', '#1a6b1a');
        connected = true;
        connectBtn.textContent = 'Disconnect';
        connectBtn.classList.add('disconnect');
        setControlsEnabled(true);

        // Sync UI controls with current server config
        const config = await fetchSessionConfig(currentHttpBase, currentSessionId);
        if (config) {
          schemeSelect.value = config.colorScheme;
          smoothRange.value = String(config.smoothingWindow);
          smoothVal.textContent = String(config.smoothingWindow);
          smoothLabel.textContent = String(config.smoothingWindow);
          // colorDecayMs is local-only — keep whatever the slider shows
        }
      } else if (status === 'connecting') {
        setStatus('Connecting…', '#443300');
      } else {
        setStatus('Reconnecting…', '#443300');
        connected = false;
        connectBtn.textContent = 'Connect';
        connectBtn.classList.remove('disconnect');
        setControlsEnabled(false);
      }
    };
  });

  // H to toggle panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') panel.classList.toggle('hidden');
  });
}
