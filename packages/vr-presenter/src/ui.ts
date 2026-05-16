export interface VrConfig {
  serverUrl: string;
  sessionId: string;
  metaphor: 'aurora' | 'orbital' | 'constellation' | 'ripple' | 'fire';
  decayMs: number;
}

export interface UiCallbacks {
  onConnect(config: VrConfig): void;
  onDecayChange(ms: number): void;
  onMetaphorChange(metaphor: VrConfig['metaphor']): void;
}

const VR_KEY = 'lsd2-vr';

export function initUi(callbacks: UiCallbacks): void {
  const form = document.getElementById('config-form') as HTMLFormElement;
  const serverInput = document.getElementById('server-url') as HTMLInputElement;
  const certLink = document.getElementById('cert-link') as HTMLAnchorElement;
  const sessionInput = document.getElementById('session-id') as HTMLInputElement;
  const metaphorSelect = document.getElementById('metaphor') as HTMLSelectElement;
  const decaySlider = document.getElementById('decay-ms') as HTMLInputElement;
  const decayLabel = document.getElementById('decay-label') as HTMLSpanElement;
  const statusEl = document.getElementById('status') as HTMLParagraphElement;

  // Restore saved settings
  try {
    const saved = JSON.parse(localStorage.getItem(VR_KEY) ?? '{}') as Record<string, string>;
    if (saved.serverUrl) serverInput.value      = saved.serverUrl;
    if (saved.sessionId) sessionInput.value     = saved.sessionId;
    if (saved.metaphor)  metaphorSelect.value   = saved.metaphor;
    if (saved.decayMs) {
      decaySlider.value  = saved.decayMs;
      decayLabel.textContent = `${saved.decayMs} ms`;
    }
  } catch { /* ignore */ }

  // Keep the cert-acceptance link in sync with the server URL field
  function updateCertLink() {
    const raw = serverInput.value.trim();
    const https = raw.replace(/^wss?:\/\//, 'https://').replace(/^https?:\/\//, 'https://');
    const url = /^https:\/\//.test(https) ? https : `https://${raw}`;
    certLink.href = `${url}/health`;
  }
  serverInput.addEventListener('input', updateCertLink);
  updateCertLink();

  decaySlider.addEventListener('input', () => {
    const ms = Number(decaySlider.value);
    decayLabel.textContent = `${ms} ms`;
    callbacks.onDecayChange(ms);
  });

  metaphorSelect.addEventListener('change', () => {
    callbacks.onMetaphorChange(metaphorSelect.value as VrConfig['metaphor']);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = serverInput.value.trim();
    // Normalise to wss:// — the server now always runs HTTPS
    let serverUrl = raw;
    if (!/^wss?:\/\//.test(raw)) {
      serverUrl = `wss://${raw}`;
    } else {
      serverUrl = raw.replace(/^ws:\/\//, 'wss://');
    }
    const config: VrConfig = {
      serverUrl,
      sessionId: sessionInput.value.trim() || 'default',
      metaphor: metaphorSelect.value as VrConfig['metaphor'],
      decayMs: Number(decaySlider.value),
    };
    try {
      localStorage.setItem(VR_KEY, JSON.stringify({
        serverUrl: raw,
        sessionId: config.sessionId,
        metaphor:  config.metaphor,
        decayMs:   String(config.decayMs),
      }));
    } catch { /* ignore */ }

    callbacks.onConnect(config);
  });

  // expose for main.ts to update status text
  (window as unknown as Record<string, unknown>)['__vrSetStatus'] = (msg: string) => {
    statusEl.textContent = msg;
  };
}

export function setStatus(msg: string): void {
  const fn = (window as unknown as Record<string, unknown>)['__vrSetStatus'] as ((m: string) => void) | undefined;
  fn?.(msg);
}

export function showVrButton(container: HTMLElement): void {
  const panel = document.getElementById('config-panel') as HTMLElement;
  panel.style.display = 'none';
  document.body.appendChild(container);
}
