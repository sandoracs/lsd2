# LSD2 — Live Sound to Display 2

Real-time music-to-color visualization. An instrument plays; the sound is analyzed for pitch and overtones; every frequency is mapped to a color and streamed live to web and VR displays.

```
Instrument → Capture Client (phone/laptop) → Server → Web Presenter
                                                     → Quest 3 VR Presenter
```

---

## Packages

| Package | Port | Description |
|---|---|---|
| `@lsd2/protocol` | — | Shared TypeScript types |
| `@lsd2/color-mapping` | — | Color scheme library (6 schemes) |
| `@lsd2/server` | **3000** | WebSocket hub + REST API (HTTPS) |
| `@lsd2/capture-client` | **5173** | PWA: mic or MIDI → server |
| `@lsd2/web-presenter` | **5174** | Canvas 2D visualizer + scheme picker |
| `@lsd2/vr-presenter` | **5175** | Three.js + WebXR for Quest 3 |

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- All devices (phone, Quest) must be on the **same local network** as the machine running the server

---

## First-time setup

```bash
# Clone and install all dependencies
git clone <repo-url> lsd2
cd lsd2
pnpm install

# Build the shared libraries (required before first run)
pnpm build:libs
```

---

## Running everything

```bash
pnpm dev
```

This starts all six processes in parallel:
- Library watchers for `@lsd2/protocol` and `@lsd2/color-mapping`
- The HTTPS server on port 3000
- The capture client dev server on port 5173
- The web presenter on port 5174
- The VR presenter on port 5175

Find your machine's LAN IP address — you'll need it for all the steps below:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'
```

---

## HTTPS and self-signed certificate

The server generates a self-signed TLS certificate on first launch and caches it to `/tmp/lsd2-cert.json`. The certificate persists across restarts so devices only need to accept it once.

The capture client and VR presenter use `@vitejs/plugin-basic-ssl` to serve themselves over HTTPS — required because `getUserMedia` (microphone) and WebXR are blocked on plain HTTP.

**The web presenter (port 5174) is plain HTTP** — it only receives data over the already-accepted WebSocket connection, so no certificate acceptance is needed.

### Accepting the certificate on each device

Every device that connects to the server needs to accept the certificate once:

1. Open `https://<LAN-IP>:3000/health` in the device's browser
2. Click through the security warning ("Advanced" → "Proceed anyway" or equivalent)
3. You should see `{"status":"ok"}` — the device will now trust the server

---

## Capture client (phone or laptop mic / MIDI)

Open **`https://<LAN-IP>:5173`** on the device that will capture audio.

> On mobile, accept the Vite dev server's self-signed certificate first: open `https://<LAN-IP>:5173` directly and click through the warning before using it.

### Settings

| Field | Description |
|---|---|
| **Server URL** | `wss://<LAN-IP>:3000` — must match your server's LAN IP |
| **Session ID** | Arbitrary string; all clients on the same session see the same data (default: `default`) |
| **Max Overtones** | How many overtone frequencies to detect and send (1–16, default 8) |
| **Source** | `Microphone` or `MIDI` |
| **MIDI Device** | Visible when Source = MIDI; pick a specific device or leave blank for all |
| **Instrument Key** | Transposes detected pitches to concert pitch for transposing instruments (see below) |
| **Gate slider** | Combined noise gate + VU meter; drag the white thumb to set the threshold |

### Instrument key (transposing instruments)

If you're capturing a **Bb instrument** (clarinet, trumpet, soprano/tenor sax), an **Eb instrument** (alto sax, baritone sax), or an **F instrument** (French horn), select the matching key so the system reports concert pitch:

| Selection | Transpose | Examples |
|---|---|---|
| C (concert) | 0 semitones | Piano, guitar, flute, violin |
| Bb | +2 semitones | Clarinet, trumpet, soprano sax, tenor sax |
| Eb | +9 semitones | Alto sax, baritone sax |
| F | +7 semitones | French horn |

The setting takes effect immediately — you can switch it while capturing.

### Noise gate

The slider thumb sets the threshold. Any audio below it is treated as silence and produces no color output. The colored bar behind the slider shows live input level:
- Green = quiet
- Orange = moderate
- Red = loud

For **MIDI**, the gate maps to a minimum velocity (1–100) using the same slider range.

### Settings persistence

All settings are saved to `localStorage` and restored on next open.

---

## Web presenter

Open **`http://<LAN-IP>:5174`** on any browser (no certificate needed).

- Enter the server URL (`https://<LAN-IP>:3000`) and session ID, then click **Connect**
- Use the **Color Scheme** dropdown to switch schemes live — all presenters in the session update immediately
- The visualizer shows: current note name, frequency, detected chord, estimated key, and overtone bars
- Visualization scenes: `aurora`, `constellation`, `ripple`, `orbital`, `fire`

---

## VR presenter (Meta Quest 3)

1. On the Quest, open the **browser** and navigate to `https://<LAN-IP>:5175`
2. Accept the self-signed certificate if prompted (see certificate section above)
3. Enter the server URL and session ID, then press **Connect**
4. Press **Enter VR** to start the immersive experience

---

## Color schemes

All schemes are selectable at runtime from the web presenter. The server re-maps colors on scheme change; capture clients are unaffected.

| Scheme | Based on | Character |
|---|---|---|
| `chromatic` | Equal temperament — 30° per semitone | Clean, consistent; C=red, F#=cyan |
| `newton` | Newton's rainbow (ROYGBIV for 7 naturals) | Poetic, uneven |
| `scriabin` | Scriabin's synesthetic circle of fifths | Most "synesthetic" feel |
| `frequency` | Log-linear mapping of Hz → visible light spectrum | Physics-based; low=warm, high=cool |
| `interval` | Harmonic distance from detected tonic | Makes tension/resolution visible |

---

## Development workflow

### Rebuilding the shared libraries

If you edit `packages/protocol` or `packages/color-mapping` source while `pnpm dev` is **not** running, rebuild manually:

```bash
pnpm build:libs
```

The server loads `color-mapping` from its compiled `dist/` output, so changes to the source only take effect after a rebuild.

### Type checking

```bash
pnpm typecheck
```

### Running a single package

```bash
pnpm --filter @lsd2/server dev
pnpm --filter @lsd2/capture-client dev
pnpm --filter @lsd2/web-presenter dev
pnpm --filter @lsd2/vr-presenter dev
```

### Server REST API

```
GET  https://<host>:3000/health
GET  https://<host>:3000/sessions
POST https://<host>:3000/sessions
GET  https://<host>:3000/sessions/:id
PUT  https://<host>:3000/sessions/:id/config   # body: { colorScheme, maxOvertones, … }
```

### WebSocket connection strings

```
Capturer: wss://<host>:3000/ws?sessionId=<id>&role=capturer
Presenter: wss://<host>:3000/ws?sessionId=<id>&role=presenter
```

---

## Troubleshooting

**Microphone not working on mobile**
- The page must be served over HTTPS. Confirm you accepted the Vite self-signed cert at `https://<LAN-IP>:5173`.

**"WebSocket connection failed" on the capture client**
- Accept the server certificate first: open `https://<LAN-IP>:3000/health` in the same browser and accept the warning.

**VR presenter shows no data**
- Accept the server certificate in the Quest browser (`https://<LAN-IP>:3000/health`) before loading the presenter.

**Colors look monochrome**
- Check the noise gate — if the threshold is too high, all frames are treated as silence. Drag the slider left.

**Color scheme change has no visible effect**
- The web presenter must be connected (status shows "● Live"). Scheme changes are applied server-side on the next incoming frame.

**Server cert expired or device won't trust it**
- Delete `/tmp/lsd2-cert.json` and restart the server. A fresh cert is generated; accept it again on each device.
