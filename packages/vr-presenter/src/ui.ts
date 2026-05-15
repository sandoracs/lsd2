export interface VrConfig {
  serverUrl: string;
  sessionId: string;
  metaphor: 'aurora' | 'orbital';
  decayMs: number;
}

export interface UiCallbacks {
  onConnect(config: VrConfig): void;
  onDecayChange(ms: number): void;
  onMetaphorChange(metaphor: 'aurora' | 'orbital'): void;
}

export function initUi(callbacks: UiCallbacks): void {
  const form = document.getElementById('config-form') as HTMLFormElement;
  const serverInput = document.getElementById('server-url') as HTMLInputElement;
  const sessionInput = document.getElementById('session-id') as HTMLInputElement;
  const metaphorSelect = document.getElementById('metaphor') as HTMLSelectElement;
  const decaySlider = document.getElementById('decay-ms') as HTMLInputElement;
  const decayLabel = document.getElementById('decay-label') as HTMLSpanElement;
  const statusEl = document.getElementById('status') as HTMLParagraphElement;

  decaySlider.addEventListener('input', () => {
    const ms = Number(decaySlider.value);
    decayLabel.textContent = `${ms} ms`;
    callbacks.onDecayChange(ms);
  });

  metaphorSelect.addEventListener('change', () => {
    callbacks.onMetaphorChange(metaphorSelect.value as 'aurora' | 'orbital');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = serverInput.value.trim();
    // normalise: accept http(s):// or ws(s):// or bare host:port
    let serverUrl = raw;
    if (!/^wss?:\/\//.test(raw)) {
      serverUrl = raw.replace(/^https?:\/\//, 'ws://').replace(/^wss?:\/\//, 'ws://');
      if (!/^ws/.test(serverUrl)) serverUrl = `ws://${serverUrl}`;
    }
    const config: VrConfig = {
      serverUrl,
      sessionId: sessionInput.value.trim() || 'default',
      metaphor: metaphorSelect.value as 'aurora' | 'orbital',
      decayMs: Number(decaySlider.value),
    };
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
