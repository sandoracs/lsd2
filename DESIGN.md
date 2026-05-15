# LSD2 — Live Sound to Display 2
## System Design Document
**Version:** 0.1  
**Date:** 2026-05-15  
**Status:** Pre-implementation

---

## 1. Vision

LSD2 captures live music, detects the fundamental pitch and its overtones, maps every frequency to a color, and streams that color data in real time to one or more visual presenter clients — including a flat web page and a Meta Quest 3 VR experience.

The result: music becomes light. The timbre of an instrument (its overtone fingerprint) becomes a unique color signature visible in 2D or immersive 3D.

---

## 2. Core Concepts

### 2.1 Note-to-Color Mapping Schemes

All mapping schemes are selectable at runtime via the `colorScheme` configuration parameter. Each produces an HSL color from a frequency and amplitude.

---

#### Scheme A — `chromatic` (recommended default)

Maps the 12 chromatic semitones evenly around the HSL hue wheel (30° per semitone). Octave identity is preserved: the same note in any octave shares the same hue, differing only in luminance.

```
C  → 0°   (red)        F# → 180° (cyan)
C# → 30°               G  → 210°
D  → 60°  (yellow)     G# → 240° (blue)
D# → 90°               A  → 270°
E  → 120° (green)      A# → 300°
F  → 150°              B  → 330° (magenta)
```

- **Hue** = `semitone × 30°`
- **Luminance** = `50% + (octave − 4) × 6%` (octave 4 = L 50%, each octave up brighter)
- **Saturation** = amplitude mapped 0–100%

---

#### Scheme B — `newton`

Isaac Newton's original mapping, aligning the 7 natural notes to the 7 colors of the rainbow (ROYGBIV). Historically poetic; musically uneven because semitones are compressed into gaps.

```
C → Red       E → Green    A → Indigo
D → Orange    F → Blue     B → Violet
              G → Yellow
```

Sharps/flats interpolate between their neighbors. Octave → luminance same as `chromatic`.

---

#### Scheme C — `scriabin`

Alexander Scriabin's synesthetic color mapping, used in his orchestral work *Prometheus: The Poem of Fire* (1910). Based on the circle of fifths rather than the chromatic scale.

```
C  → Red          F# → Bright Blue
G  → Orange       D♭ → Violet
D  → Yellow       A♭ → Purple / Rose
A  → Green        E♭ → Steel (grey-blue)
E  → Pale Blue    B♭ → Steel
B  → Pale Yellow  F  → Deep Red
```

This scheme is the most "synesthetic" in the human-perception sense. Notes related by fifths are color-adjacent. Octave → luminance same as `chromatic`.

---

#### Scheme D — `frequency`

Maps audio frequency directly to the visible light spectrum using a log-linear transform. The human hearing range (~20 Hz–20 kHz) maps onto the visible light range (~380–700 nm, violet to red).

```
frequency_normalized = log(f / 20) / log(20000 / 20)   // 0.0–1.0
hue = (1 − frequency_normalized) × 270°               // violet (high) to red (low)
```

This scheme has physical grounding: low notes are warm (red/orange), high notes are cool (violet/blue), matching the physics of both sound and light wavelengths. Overtones drift upward in frequency and therefore toward cooler hues.

---

#### Scheme E — `interval`

Maps notes not by absolute pitch but by their harmonic distance from a tonic (the first note detected in a session, or manually set). Uses music-theory interval relationships to assign hues:

```
Unison / Octave    → 0°    (reference color)
Perfect 5th        → 180°  (complementary)
Perfect 4th        → 180°  (same as 5th, inverse relationship)
Major 3rd          → 120°
Minor 3rd          → 240°
Major 2nd          → 60°
Minor 7th          → 300°
Tritone            → 90°  (maximum tension — sharp contrast)
```

This scheme makes harmonic tension and resolution visually obvious: a dominant 7th chord will show high-contrast complementary colors; a major chord will show a harmonious triad. Best for music theory visualization and education.

---

#### Scheme F — `custom`

A fully user-defined mapping, specified as a JSON table of note → HSL values. Allows any artistic or culture-specific color association. The server validates the table has all 12 chromatic notes defined.

```json
{
  "colorScheme": "custom",
  "customMapping": {
    "C":  { "h": 15,  "s": 90, "l": 55 },
    "C#": { "h": 35,  "s": 85, "l": 50 },
    "D":  { "h": 55,  "s": 95, "l": 60 },
    ...
  }
}
```

---

### 2.2 Mapping Comparison Table

| Scheme | Based On | Best For | Octave Identity |
|---|---|---|---|
| `chromatic` | Equal temperament circle | General use, clean aesthetics | Yes (same hue) |
| `newton` | Rainbow / 7 naturals | Historical, poetic context | Yes |
| `scriabin` | Circle of fifths | Synesthetic feel, performance art | Yes |
| `frequency` | Physics (log-linear) | Scientific, educational | No (each octave shifts hue) |
| `interval` | Harmonic distance from tonic | Music theory visualization | Yes (relative) |
| `custom` | User-defined table | Artistic / cultural projects | User-defined |

---

### 2.3 Overtone Series

The harmonic overtone series above any fundamental frequency f:

```
Overtone 1:  f      (fundamental — the "note")
Overtone 2:  2f     (octave above)
Overtone 3:  3f     (octave + perfect 5th)
Overtone 4:  4f     (2 octaves)
Overtone 5:  5f     (2 octaves + major 3rd)
Overtone 6:  6f     (2 octaves + perfect 5th)
Overtone 7:  7f     (2 octaves + minor 7th — slightly flat)
Overtone 8:  8f     (3 octaves)
...up to N  (configurable, default 8)
```

Each overtone's frequency is passed through the same active `colorScheme`, so the color of an overtone is coherent with the fundamental in whatever system is chosen. The amplitude of each overtone varies by instrument — this is **timbre**. A flute has few overtones (clean color); a violin has many strong overtones (rich color bloom).

### 2.4 Instrument Fingerprints (Timbre as Color Signature)

| Instrument | Overtone Character | Visual Result |
|---|---|---|
| Flute | Weak overtones | Single clean color |
| Clarinet | Strong odd overtones (3f, 5f, 7f) | Alternating color leaps |
| Violin | Rich, many overtones | Full color bloom |
| Piano | Attack-heavy, decaying overtones | Burst then fade |
| Trumpet | Bright, high overtones | Wide, energetic spread |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPTURE CLIENTS                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Mobile PWA (iOS Safari / Android Chrome)                │  │
│  │  • Web Audio API → microphone input                      │  │
│  │  • FFT analysis in Web Worker                            │  │
│  │  • YIN pitch detection (monophonic)                      │  │
│  │  • Overtone extraction (harmonic product spectrum)        │  │
│  │  • WebSocket → sends NoteFrame messages                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ WebSocket (NoteFrame JSON)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                           SERVER                                │
│                                                                 │
│  Node.js + Express + ws                                         │
│  • Session management (multiple capture clients per session)    │
│  • Color mapping engine (all schemes, shared library)           │
│  • Smoothing / noise gate                                       │
│  • REST API: configuration, sessions, color scheme selection    │
│  • WebSocket hub: fan-out ColorFrame to all presenter clients  │
└──────────────┬────────────────────────────────────────────────┘
               │ WebSocket (ColorFrame JSON, fan-out)
        ┌──────┴──────┐
        ▼             ▼
┌───────────┐   ┌─────────────────────────────────────┐
│ Web       │   │ Quest 3 VR Presenter                │
│ Presenter │   │                                     │
│           │   │  Three.js + WebXR API               │
│ Canvas2D  │   │  Opens in Quest Browser (no app     │
│ or        │   │  store required)                    │
│ Three.js  │   │                                     │
│ Color     │   │  Spatial metaphor options:          │
│ scheme    │   │  • Chromatic aurora (default)       │
│ picker UI │   │  • Orbital sphere                   │
│           │   │  • Crystal forest                   │
└───────────┘   │  • MR passthrough overlay           │
                └─────────────────────────────────────┘
```

---

## 4. Components

### 4.1 Capture Client (Mobile PWA)

**Tech:** TypeScript, Web Audio API, Web Worker, WebSocket  
**Runs on:** iOS Safari 15+, Android Chrome 90+

**Processing pipeline:**
```
Microphone → AudioContext → AudioWorklet
          → FFT (AnalyserNode, configurable size)
          → Web Worker: YIN pitch detection
          → Overtone extraction (check multiples of detected f0)
          → NoteFrame assembly (raw frequencies + amplitudes, no color applied here)
          → WebSocket → Server
```

The capture client sends raw note data (frequencies, amplitudes) — it does **not** apply color mapping. Color mapping happens on the server so that changing the scheme affects all clients simultaneously without restarting the capture client.

**Output message per audio frame (~30 fps):**
```typescript
interface NoteFrame {
  type: "note_frame";
  timestamp: number;
  sessionId: string;
  silence: boolean;
  fundamental: PitchData;
  overtones: PitchData[];   // length <= maxOvertones
  maxOvertones: number;
}

interface PitchData {
  frequency: number;       // Hz, precise
  amplitude: number;       // 0.0–1.0 (normalized RMS)
  note: string;            // "A", "C#", etc. (nearest equal-temperament note)
  octave: number;          // 0–8
  cents: number;           // deviation from equal temperament (-50 to +50)
}
```

### 4.2 Server

**Tech:** Node.js, TypeScript, Express, ws  
**Deployable:** Docker, any cloud VM, Raspberry Pi on local network

**Responsibilities:**
- Accept WebSocket connections from capture clients (role: `capturer`)
- Accept WebSocket connections from presenter clients (role: `presenter`)
- Group connections into sessions
- Apply color mapping (using active `colorScheme` for the session)
- Fan-out ColorFrames to all presenters in the session
- Smooth rapid note changes (configurable debounce window)
- REST API for session and configuration management

**REST endpoints:**
```
POST   /sessions                    → create session, return sessionId
GET    /sessions/:id                → session info + connected clients
DELETE /sessions/:id                → close session

GET    /sessions/:id/config         → get current session configuration
PUT    /sessions/:id/config         → update configuration (all parameters)

GET    /color-schemes               → list all available color schemes with descriptions
GET    /color-schemes/:name/preview → preview: return 12 note colors for the scheme

GET    /health                      → health check
```

**WebSocket handshake (query params):**
```
ws://server/ws?sessionId=abc&role=capturer
ws://server/ws?sessionId=abc&role=presenter
```

**Output message (server → presenters):**
```typescript
interface ColorFrame {
  type: "color_frame";
  timestamp: number;
  sessionId: string;
  silence: boolean;
  colorScheme: ColorSchemeName;
  fundamental: ColoredNote;
  overtones: ColoredNote[];
}

interface ColoredNote {
  frequency: number;
  amplitude: number;
  note: string;
  octave: number;
  cents: number;
  color: HSLColor;           // computed by server using active scheme
}

interface HSLColor {
  h: number;   // 0–360
  s: number;   // 0–100
  l: number;   // 0–100
}
```

### 4.3 Shared Color Mapping Library (`@lsd2/color-mapping`)

Pure TypeScript, used by the server. Contains all mapping logic as a single source of truth.

```typescript
type ColorSchemeName =
  | "chromatic"
  | "newton"
  | "scriabin"
  | "frequency"
  | "interval"
  | "custom";

interface ColorSchemeConfig {
  name: ColorSchemeName;
  customMapping?: Record<string, HSLColor>;  // only for "custom"
  tonicNote?: string;                        // only for "interval" (default: auto-detect)
}

// Primary API: map a frequency + amplitude → HSL color
function mapFrequencyToColor(
  frequency: number,
  amplitude: number,
  config: ColorSchemeConfig
): HSLColor

// Convenience: get all 12 chromatic note colors for a scheme (for UI previews)
function getSchemePreview(config: ColorSchemeConfig): Record<string, HSLColor>

// Extract overtones from FFT data
function extractOvertones(
  fftBuffer: Float32Array,
  fundamentalHz: number,
  sampleRate: number,
  maxOvertones: number
): OvertoneData[]

// List all built-in schemes with metadata
function listColorSchemes(): SchemeInfo[]
```

### 4.4 Web Presenter (Simple)

**Tech:** TypeScript, Three.js or Canvas2D, WebSocket  
**Purpose:** Testing, desktop display, simple full-screen visualization

**Features:**
- Connect panel: server URL + session ID
- **Color scheme picker** — dropdown showing all schemes + a 12-note color preview swatch for each
- Fullscreen visualization: central disc for fundamental, concentric rings for overtones
- Decay animation (configurable fade time)
- Note label overlay (shows note name + frequency)
- Toggle 2D / 3D view

### 4.5 Quest 3 VR Presenter

**Tech:** TypeScript, Three.js, WebXR API  
**Deployment:** Navigate to URL in Quest 3 browser → press "Enter VR"

**Default spatial metaphor — Chromatic Aurora:**
- Fundamental = wide luminous band at horizon level
- Each overtone = progressively narrower, higher, dimmer band
- Colors fade over 3–8 seconds
- Multiple notes (rapid melody) layer and compose in the sky

**Alternative metaphors (selectable in session config):**
1. **Orbital Sphere** — fundamental = central orb, overtones orbit by amplitude
2. **Crystal Forest** — notes grow as colored columns from the floor
3. **MR Passthrough Overlay** — real room visible; color halos float around the musician

**Color scheme changes** propagate instantly from the server — presenters never re-compute colors, they consume what the server sends.

---

## 5. Configuration Parameters

All parameters are per-session, set via REST API, with server-level defaults.

| Parameter | Default | Type | Description |
|---|---|---|---|
| `colorScheme` | `"chromatic"` | `ColorSchemeName` | Note-to-color mapping scheme |
| `customMapping` | `null` | `Record<string, HSLColor>` | Required when `colorScheme = "custom"` |
| `intervalTonic` | `null` (auto) | `string` | Tonic note for `"interval"` scheme |
| `maxOvertones` | `8` | `1–16` | Overtones to detect and display |
| `noiseGateDb` | `-40` | `-60` to `-10` | Silence threshold |
| `smoothingWindow` | `3` | `1–10` | Frame averaging window (reduces jitter) |
| `colorDecayMs` | `3000` | `500–10000` | How long colors linger in presenters |
| `amplitudeMapping` | `"log"` | `"linear"` / `"log"` | Amplitude → saturation curve |
| `fftSize` | `2048` | `512–8192` | FFT resolution (capture client hint) |
| `frameRateHz` | `30` | `10–60` | Target note frames per second |
| `vrMetaphor` | `"aurora"` | enum | VR spatial metaphor |

### Changing the Color Scheme at Runtime

```http
PUT /sessions/abc123/config
Content-Type: application/json

{
  "colorScheme": "scriabin"
}
```

The server immediately re-maps all subsequent NoteFrames using the new scheme. All connected presenters see the change on the next frame. No reconnection required.

---

## 6. Data Flow (Sequence)

```
Musician plays A4 (440 Hz, violin)
    │
    ▼
Capture Client (mobile)
  └─ FFT: peaks at 440, 880, 1320, 1760, 2200 Hz
  └─ YIN: fundamental = 440.0 Hz
  └─ Overtone extraction: amplitudes at 2×–6× fundamental
  └─ Emits NoteFrame {frequency, amplitude, note, octave} — no color yet
    │
    ▼
Server (session colorScheme = "chromatic")
  └─ Applies chromatic mapping:
       440 Hz → A4   → H:270°, S:82%, L:50%
       880 Hz → A5   → H:270°, S:41%, L:56%
      1320 Hz → E6   → H:210°, S:18%, L:62%
      ...
  └─ Emits ColorFrame to all presenters
    │
    ├──▶ Web Presenter
    │     └─ Central purple disc, fading blue-green rings
    │
    └──▶ Quest 3 VR Presenter
          └─ Wide purple aurora at horizon, narrowing blue band above
```

---

## 7. Technology Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| Capture client | TypeScript PWA, Web Audio API, AudioWorklet | Runs on any mobile browser, no app store |
| Pitch detection | YIN algorithm (browser, Web Worker) | Best monophonic pitch detection in-browser |
| Transport | WebSocket (JSON) | Low-latency, bidirectional, universal |
| Server | Node.js, TypeScript, ws, Express | Fast, minimal, same language as clients |
| Color mapping | `@lsd2/color-mapping` (TypeScript) | Single source of truth for all 6 schemes |
| Web presenter | Three.js + Canvas2D | Simple and powerful |
| VR presenter | Three.js + WebXR API | Quest 3 browser native, no Unity needed |
| Monorepo | pnpm workspaces | Share types and libraries across packages |

---

## 8. Monorepo Structure

```
lsd2/
├── packages/
│   ├── color-mapping/        # Shared lib: all 6 color schemes + overtone extraction
│   ├── protocol/             # Shared TypeScript types (NoteFrame, ColorFrame, etc.)
│   ├── capture-client/       # PWA: mobile mic → server
│   ├── server/               # Node.js WebSocket hub + REST API
│   ├── web-presenter/        # Simple canvas/three.js web client + scheme picker
│   └── vr-presenter/         # Three.js + WebXR for Quest 3
├── pnpm-workspace.yaml
├── package.json
└── DESIGN.md
```

---

## 9. Open Questions

- [ ] **Polyphony:** YIN is monophonic. For chords (piano, guitar), a polyphonic approach (NMF, pYIN) is needed — significantly more complex. Start monophonic.
- [ ] **Latency budget:** Target < 100ms capture → display for live performance feel.
- [ ] **Session privacy:** Are sessions public or password-protected?
- [ ] **`interval` scheme auto-tonic:** How long to observe before committing to a tonic? Reset on silence?
- [ ] **`frequency` scheme low notes:** Sub-bass (< 80 Hz) maps to red/infrared; needs a floor.

---

## 10. Future Directions

- **Chord detection & naming** — identify and label chords from polyphonic input
- **Key inference** — detect musical key in real time; rotate `interval` scheme accordingly
- **Recording & playback** — save a session as a color film
- **Beat detection** — pulse colors to rhythm
- **Multi-performer sessions** — multiple capture clients, colors spatially separated in VR
- **MIDI input** — alternative to microphone for direct digital pitch data
- **Color export** — export the color palette of a performance as image or Pantone set
- **Quest 3 MR** — passthrough mode with color halos floating around the real musician

---

## 11. Implementation Phases

### Phase 1 — Proof of Concept
1. `color-mapping` library with `chromatic` scheme
2. `capture-client` PWA: mic → pitch → WebSocket
3. `server`: WebSocket relay, basic session, `chromatic` color application
4. `web-presenter`: fullscreen disc + rings

**Success:** Play a note on a phone, see a color on a laptop in < 200ms.

### Phase 2 — Full Feature Set
1. All 6 color schemes in `color-mapping` library
2. REST config API + live scheme switching
3. Overtone detection (configurable, up to 16)
4. Scheme picker UI in web presenter
5. Smoothing, noise gate, decay animation

### Phase 3 — VR
1. `vr-presenter`: Three.js + WebXR skeleton
2. Aurora metaphor
3. Test on Quest 3 browser
4. Hand tracking interaction

### Phase 4 — Polish
1. `custom` scheme editor UI
2. Polyphonic detection research
3. MR passthrough mode
4. Recording / playback

---

*Document generated from brainstorming session, 2026-05-15.*
