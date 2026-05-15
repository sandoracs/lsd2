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

  let stopCapture: (() => void) | null = null;
  let active = false;

  function setStatus(text: string, bg: string) {
    statusEl.textContent = text;
    statusEl.style.background = bg;
  }

  connectBtn.addEventListener('click', async () => {
    if (active) {
      stopCapture?.();
      stopCapture = null;
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
      sender.onStatusChange = (status) => {
        if (status === 'connected') setStatus('● Live', '#1a6b1a');
        else if (status === 'disconnected') setStatus('Reconnecting…', '#7a4400');
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
          } else {
            noteEl.textContent = '—';
            freqEl.textContent = '';
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
      setStatus(`Error: ${(err as Error).message}`, '#6b1a1a');
    }
  });
}
