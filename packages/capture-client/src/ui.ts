import { startCapture } from './audio-capture.js';
import { createWsSender } from './ws-sender.js';

export function initUI(): void {
  const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
  const sessionIdInput = document.getElementById('session-id') as HTMLInputElement;
  const maxOvertonesInput = document.getElementById('max-overtones') as HTMLInputElement;
  const noiseGateInput = document.getElementById('noise-gate') as HTMLInputElement;
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('status') as HTMLDivElement;
  const noteEl = document.getElementById('current-note') as HTMLDivElement;
  const freqEl = document.getElementById('current-freq') as HTMLDivElement;
  const vuBar = document.getElementById('vu-bar') as HTMLDivElement;
  const overtonesEl = document.getElementById('overtones') as HTMLDivElement;

  let stopCapture: (() => void) | null = null;
  let activeSender: ReturnType<typeof createWsSender> | null = null;
  let active = false;

  function setStatus(text: string, bg: string) {
    statusEl.textContent = text;
    statusEl.style.background = bg;
  }

  connectBtn.addEventListener('click', async () => {
    if (active) {
      stopCapture?.();
      stopCapture = null;
      activeSender?.close();
      activeSender = null;
      active = false;
      connectBtn.textContent = 'Start Capture';
      connectBtn.classList.remove('stop');
      setStatus('Stopped', '#333');
      noteEl.textContent = '—';
      freqEl.textContent = '';
      vuBar.style.width = '0%';
      return;
    }

    const serverUrl = serverUrlInput.value.trim();
    const sessionId = sessionIdInput.value.trim() || 'default';
    const maxOvertones = parseInt(maxOvertonesInput.value) || 8;
    const noiseGateDb = parseInt(noiseGateInput.value) || -40;
    const wsUrl = `${serverUrl}/ws?sessionId=${encodeURIComponent(sessionId)}&role=capturer`;

    try {
      setStatus('Requesting microphone…', '#666');

      const sender = createWsSender(wsUrl);
      activeSender = sender;
      let reconnectingTimer: ReturnType<typeof setTimeout> | null = null;
      sender.onStatusChange = (status) => {
        if (!active && status !== 'connected') return; // don't overwrite an error
        if (status === 'connected') {
          if (reconnectingTimer) { clearTimeout(reconnectingTimer); reconnectingTimer = null; }
          setStatus('● Live', '#1a6b1a');
        } else if (status === 'disconnected') {
          // Delay label so brief reconnects don't flash "Reconnecting…"
          reconnectingTimer = setTimeout(() => setStatus('Reconnecting…', '#7a4400'), 1000);
        }
      };

      stopCapture = await startCapture({
        sessionId,
        maxOvertones,
        noiseGateDb,
        frameRateHz: 30,
        onFrame: (frame) => {
          sender.send(frame);
          if (!frame.silence && frame.fundamental.note) {
            noteEl.textContent = `${frame.fundamental.note}${frame.fundamental.octave}`;
            freqEl.textContent = `${frame.fundamental.frequency.toFixed(1)} Hz`;
            overtonesEl.innerHTML = frame.overtones.map(o => `
              <div class="overtone-row">
                <span class="overtone-note">${o.note}${o.octave}</span>
                <span class="overtone-freq">${o.frequency.toFixed(1)} Hz</span>
                <div class="overtone-amp">
                  <div class="overtone-amp-fill" style="width:${Math.round(o.amplitude * 100)}%"></div>
                </div>
              </div>`).join('');
          } else {
            noteEl.textContent = '—';
            freqEl.textContent = '';
            overtonesEl.innerHTML = '';
          }
        },
        onAmplitude: (db) => {
          const pct = Math.max(0, Math.min(100, (db - noiseGateDb) / (-noiseGateDb) * 100));
          vuBar.style.width = `${pct.toFixed(1)}%`;
        },
      });

      active = true;
      connectBtn.textContent = 'Stop Capture';
      connectBtn.classList.add('stop');
    } catch (err) {
      activeSender?.close();
      activeSender = null;
      setStatus(`Error: ${(err as Error).message}`, '#6b1a1a');
    }
  });
}
