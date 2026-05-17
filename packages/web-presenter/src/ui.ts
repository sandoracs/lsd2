import type { ColorFrame, ColorSchemeName, HSLColor } from '@lsd2/protocol';
import { createWsReceiver, type WsReceiver } from './ws-receiver.js';
import type { Renderer, MetaphorName } from './renderer.js';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;

// Chromatic hues (semitone × 30°) at s:85, l:50 — used as the Reset target.
const CHROMATIC_DEFAULTS: Record<string, HSLColor> = Object.fromEntries(
  NOTE_NAMES.map((note, i) => [note, { h: i * 30, s: 85, l: 50 }]),
);

function hexToHsl(hex: string): HSLColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else                h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) {         g = c; b = x; }
  else if (h < 240) {         g = x; b = c; }
  else if (h < 300) { r = x;         b = c; }
  else              { r = c;         b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const STORAGE_KEY = 'lsd2-web';

function loadSettings(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>; }
  catch { return {}; }
}

function saveSettings(data: Record<string, string>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSettings(), ...data })); } catch { /* ignore */ }
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
  const customEditor    = document.getElementById('custom-editor') as HTMLDivElement;
  const resetCustomBtn  = document.getElementById('reset-custom-btn') as HTMLButtonElement;
  const noteInputs      = Array.from(
    customEditor.querySelectorAll<HTMLInputElement>('input[type="color"][data-note]')
  );

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
  if (saved['scheme']) schemeSelect.value = saved['scheme'];
  renderer.setMetaphor((metaphorSelect.value || 'aurora') as MetaphorName);

  // ── Custom colour editor ──────────────────────────────────────────────────

  function buildCustomMapping(): Record<string, HSLColor> {
    const mapping: Record<string, HSLColor> = {};
    for (const input of noteInputs) {
      const note = input.dataset['note']!;
      mapping[note] = hexToHsl(input.value);
    }
    return mapping;
  }

  function populateCustomInputs(mapping: Record<string, HSLColor>): void {
    for (const input of noteInputs) {
      const note = input.dataset['note']!;
      const hsl  = mapping[note] ?? CHROMATIC_DEFAULTS[note]!;
      input.value = hslToHex(hsl.h, hsl.s, hsl.l);
    }
  }

  function applyCustomDefaults(): void {
    populateCustomInputs(CHROMATIC_DEFAULTS);
  }

  // Initialise inputs: saved custom mapping from localStorage, else chromatic defaults.
  const savedCustomRaw = saved['customMapping'];
  if (savedCustomRaw) {
    try {
      populateCustomInputs(JSON.parse(savedCustomRaw) as Record<string, HSLColor>);
    } catch { applyCustomDefaults(); }
  } else {
    applyCustomDefaults();
  }

  // Show/hide editor to match initial scheme selection.
  if (saved['scheme'] === 'custom') customEditor.style.display = '';

  function sendCustomScheme(): void {
    const mapping = buildCustomMapping();
    saveSettings({
      serverUrl: serverUrlInput.value, sessionId: sessionIdInput.value,
      metaphor: metaphorSelect.value, decayMs: decayRange.value,
      scheme: 'custom',
      customMapping: JSON.stringify(mapping),
    });
    receiver?.send({ type: 'config_update', colorScheme: 'custom', customMapping: mapping });
  }

  // Live update as user picks colours.
  for (const input of noteInputs) {
    input.addEventListener('input', () => { if (schemeSelect.value === 'custom') sendCustomScheme(); });
  }

  resetCustomBtn.addEventListener('click', () => {
    applyCustomDefaults();
    if (schemeSelect.value === 'custom') sendCustomScheme();
  });

  // ─────────────────────────────────────────────────────────────────────────

  let receiver: WsReceiver | null = null;
  let connected = false;

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

  // Smoothing control — pushes to server via WebSocket
  smoothRange.addEventListener('input', () => {
    const val = parseInt(smoothRange.value);
    smoothVal.textContent = String(val);
    smoothLabel.textContent = String(val);
    receiver?.send({ type: 'config_update', smoothingWindow: val });
  });

  // Color scheme — pushes to server via WebSocket
  schemeSelect.addEventListener('change', () => {
    const isCustom = schemeSelect.value === 'custom';
    customEditor.style.display = isCustom ? '' : 'none';
    if (isCustom) {
      sendCustomScheme();
    } else {
      saveSettings({
        serverUrl: serverUrlInput.value, sessionId: sessionIdInput.value,
        metaphor: metaphorSelect.value, decayMs: decayRange.value,
        scheme: schemeSelect.value,
      });
      receiver?.send({ type: 'config_update', colorScheme: schemeSelect.value as ColorSchemeName });
    }
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

    const wsUrl = `${serverUrl}/ws?sessionId=${encodeURIComponent(sessionId)}&role=presenter`;
    receiver = createWsReceiver(wsUrl, onFrame);

    // Sync UI controls from server config delivered over WebSocket
    receiver.onConfig = (config) => {
      schemeSelect.value = config.colorScheme;
      smoothRange.value = String(config.smoothingWindow);
      smoothVal.textContent = String(config.smoothingWindow);
      smoothLabel.textContent = String(config.smoothingWindow);
      const isCustom = config.colorScheme === 'custom';
      customEditor.style.display = isCustom ? '' : 'none';
      if (isCustom && config.customMapping) populateCustomInputs(config.customMapping);
    };

    receiver.onStatusChange = (status) => {
      if (status === 'connected') {
        setStatus('● Live', '#1a6b1a');
        connected = true;
        connectBtn.textContent = 'Disconnect';
        connectBtn.classList.add('disconnect');
        setControlsEnabled(true);
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
