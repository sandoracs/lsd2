import { startCapture, type CaptureControls } from './audio-capture.js';
import { startMidiCapture, listMidiInputs } from './midi-capture.js';
import { createWsSender } from './ws-sender.js';

const CAPTURE_KEY = 'lsd2-capture';

export function initUI(): void {
  const serverUrlInput    = document.getElementById('server-url')      as HTMLInputElement;
  const sessionIdInput    = document.getElementById('session-id')      as HTMLInputElement;
  const maxOvertonesInput = document.getElementById('max-overtones')   as HTMLInputElement;
  const noiseGateInput    = document.getElementById('noise-gate')      as HTMLInputElement;
  const gateValEl         = document.getElementById('gate-val')        as HTMLSpanElement;
  const gateUnitEl        = document.getElementById('gate-unit')       as HTMLSpanElement;
  const sourceSelect      = document.getElementById('source-select')   as HTMLSelectElement;
  const midiDeviceWrap    = document.getElementById('midi-device-wrap') as HTMLDivElement;
  const midiDeviceSelect  = document.getElementById('midi-device')     as HTMLSelectElement;
  const connectBtn        = document.getElementById('connect-btn')     as HTMLButtonElement;
  const statusEl          = document.getElementById('status')          as HTMLDivElement;
  const noteEl            = document.getElementById('current-note')    as HTMLDivElement;
  const freqEl            = document.getElementById('current-freq')    as HTMLDivElement;
  const chordEl           = document.getElementById('current-chord')   as HTMLDivElement;
  const keyEl             = document.getElementById('current-key')     as HTMLDivElement;
  const vuBar             = document.getElementById('vu-bar')          as HTMLDivElement;
  const overtonesEl       = document.getElementById('overtones')       as HTMLDivElement;
  const instrumentKeyEl   = document.getElementById('instrument-key')  as HTMLSelectElement;

  function isMidi() { return sourceSelect.value === 'midi'; }

  function gateDisplay(rawVal: string): string {
    if (isMidi()) {
      const vel = Math.max(1, Math.round((parseInt(rawVal) + 60) / 50 * 100));
      return String(vel);
    }
    return rawVal;
  }

  function updateGateLabel() {
    gateValEl.textContent  = gateDisplay(noiseGateInput.value);
    gateUnitEl.textContent = isMidi() ? 'vel' : 'dB';
  }

  // Restore saved settings
  try {
    const saved = JSON.parse(localStorage.getItem(CAPTURE_KEY) ?? '{}') as Record<string, string>;
    if (saved.serverUrl)      serverUrlInput.value    = saved.serverUrl;
    if (saved.sessionId)      sessionIdInput.value    = saved.sessionId;
    if (saved.maxOvertones)   maxOvertonesInput.value = saved.maxOvertones;
    if (saved.source)         sourceSelect.value      = saved.source;
    if (saved.noiseGate)      noiseGateInput.value    = saved.noiseGate;
    if (saved.instrumentKey)  instrumentKeyEl.value   = saved.instrumentKey;
  } catch { /* ignore */ }
  updateGateLabel();

  let captureControls: CaptureControls | null = null;
  let activeSender: ReturnType<typeof createWsSender> | null = null;
  let active = false;

  noiseGateInput.addEventListener('input', () => {
    updateGateLabel();
    captureControls?.setNoiseGate(parseInt(noiseGateInput.value));
  });

  instrumentKeyEl.addEventListener('change', () => {
    captureControls?.setTranspose(parseInt(instrumentKeyEl.value));
  });

  async function populateMidiDevices() {
    const inputs = await listMidiInputs();
    midiDeviceSelect.innerHTML = '<option value="">All devices</option>';
    for (const { id, name } of inputs) {
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = name;
      midiDeviceSelect.appendChild(opt);
    }
    // Restore saved device
    try {
      const saved = JSON.parse(localStorage.getItem(CAPTURE_KEY) ?? '{}') as Record<string, string>;
      if (saved.midiDeviceId) midiDeviceSelect.value = saved.midiDeviceId;
    } catch { /* ignore */ }
  }

  sourceSelect.addEventListener('change', () => {
    const midi = isMidi();
    midiDeviceWrap.style.display = midi ? '' : 'none';
    updateGateLabel();
    if (midi) void populateMidiDevices();
  });

  // If restored source is MIDI, show device wrap immediately
  if (isMidi()) { midiDeviceWrap.style.display = ''; void populateMidiDevices(); }

  function setStatus(text: string, bg: string) {
    statusEl.textContent = text;
    statusEl.style.background = bg;
  }

  function buildFrameHandlers(sender: ReturnType<typeof createWsSender>) {
    return {
      onFrame: (frame: Parameters<typeof sender.send>[0]) => {
        sender.send(frame);
        if (!frame.silence && frame.fundamental.note) {
          noteEl.textContent  = `${frame.fundamental.note}${frame.fundamental.octave}`;
          freqEl.textContent  = `${frame.fundamental.frequency.toFixed(1)} Hz`;
          chordEl.textContent = frame.chord ?? '';
          keyEl.textContent   = frame.key   ?? '';
          overtonesEl.innerHTML = frame.overtones.map(o => `
            <div class="overtone-row">
              <span class="overtone-note">${o.note}${o.octave}</span>
              <span class="overtone-freq">${o.frequency.toFixed(1)} Hz</span>
              <div class="overtone-amp">
                <div class="overtone-amp-fill" style="width:${Math.round(o.amplitude * 100)}%"></div>
              </div>
            </div>`).join('');
        } else {
          noteEl.textContent  = '—';
          freqEl.textContent  = '';
          chordEl.textContent = '';
          keyEl.textContent   = frame.key ?? '';
          overtonesEl.innerHTML = '';
        }
      },
      onAmplitude: (db: number) => {
        const pct = Math.max(0, Math.min(100, (db + 60) / 50 * 100));
        vuBar.style.width = `${pct.toFixed(1)}%`;
      },
    };
  }

  connectBtn.addEventListener('click', async () => {
    if (active) {
      captureControls?.stop();
      captureControls = null;
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

    const serverUrl    = serverUrlInput.value.trim();
    const sessionId    = sessionIdInput.value.trim() || 'default';
    const maxOvertones = parseInt(maxOvertonesInput.value) || 8;
    const noiseGateDb  = parseInt(noiseGateInput.value) || -40;
    const source       = sourceSelect.value;
    const midiDeviceId = midiDeviceSelect.value;
    const transposeBy  = parseInt(instrumentKeyEl.value) || 0;

    try {
      localStorage.setItem(CAPTURE_KEY, JSON.stringify({
        serverUrl, sessionId, source, midiDeviceId,
        maxOvertones: maxOvertonesInput.value,
        noiseGate: noiseGateInput.value,
        instrumentKey: instrumentKeyEl.value,
      }));
    } catch { /* ignore */ }

    const wsUrl = `${serverUrl}/ws?sessionId=${encodeURIComponent(sessionId)}&role=capturer`;

    try {
      const sender = createWsSender(wsUrl);
      activeSender = sender;
      let reconnectingTimer: ReturnType<typeof setTimeout> | null = null;
      sender.onStatusChange = (status) => {
        if (!active && status !== 'connected') return;
        if (status === 'connected') {
          if (reconnectingTimer) { clearTimeout(reconnectingTimer); reconnectingTimer = null; }
          setStatus('● Live', '#1a6b1a');
        } else if (status === 'disconnected') {
          reconnectingTimer = setTimeout(() => setStatus('Reconnecting…', '#7a4400'), 1000);
        }
      };

      const captureOpts = {
        sessionId, maxOvertones, noiseGateDb, transposeBy, frameRateHz: 30,
        ...buildFrameHandlers(sender),
      };

      if (source === 'midi') {
        setStatus('Requesting MIDI access…', '#666');
        captureControls = await startMidiCapture(captureOpts, midiDeviceId);
      } else {
        setStatus('Requesting microphone…', '#666');
        captureControls = await startCapture(captureOpts);
      }

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
