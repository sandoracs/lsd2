import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import type { ColorFrame } from '@lsd2/protocol';
import { createWsReceiver } from './ws-receiver.js';
import { AuroraScene } from './aurora.js';
import { OrbitalScene } from './orbital.js';
import { ConstellationScene } from './constellation.js';
import { RippleScene } from './ripple.js';
import { HandTracker } from './hand-tracker.js';
import { initUi, setStatus, showVrButton, type VrConfig } from './ui.js';

type Metaphor = VrConfig['metaphor'];

// ── Three.js setup ─────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.display = 'none'; // Three.js sets display:block inline; hide until XR session

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── State ──────────────────────────────────────────────────────────────────
let aurora: AuroraScene | null = null;
let orbital: OrbitalScene | null = null;
let constellation: ConstellationScene | null = null;
let ripple: RippleScene | null = null;
let frozen = false;
let lastFrame: ColorFrame | null = null;
let lastBeatFrameTs = 0;
let currentMetaphor: Metaphor = 'aurora';
let decayMs = 3000;

function toggleFreeze(): void {
  frozen = !frozen;
  scene.background = new THREE.Color(frozen ? 0x0a0202 : 0x050510);
}

function disposeAll(): void {
  aurora?.dispose(); aurora = null;
  orbital?.dispose(); orbital = null;
  constellation?.dispose(); constellation = null;
  ripple?.dispose(); ripple = null;
}

function spawnMetaphor(metaphor: Metaphor): void {
  currentMetaphor = metaphor;
  if (metaphor === 'aurora') {
    aurora = new AuroraScene(scene);
    aurora.setDecayMs(decayMs);
  } else if (metaphor === 'orbital') {
    orbital = new OrbitalScene(scene);
    orbital.setDecayMs(decayMs);
  } else if (metaphor === 'constellation') {
    constellation = new ConstellationScene(scene);
    constellation.setDecayMs(decayMs);
  } else {
    ripple = new RippleScene(scene);
    ripple.setDecayMs(decayMs);
  }
}

function switchMetaphor(metaphor: Metaphor): void {
  if (metaphor === currentMetaphor) return;
  disposeAll();
  spawnMetaphor(metaphor);
}

// ── Animation loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (!frozen && lastFrame) {
    if (lastFrame.beat && lastFrame.timestamp !== lastBeatFrameTs) {
      lastBeatFrameTs = lastFrame.timestamp;
      const intensity = Math.min(1, lastFrame.fundamental.amplitude * 1.2);
      aurora?.onBeat(intensity);
      orbital?.onBeat(intensity);
      constellation?.onBeat(intensity);
      ripple?.onBeat(intensity);
    }
    aurora?.update(lastFrame);
    orbital?.update(lastFrame, delta);
    constellation?.update(lastFrame);
    ripple?.update(lastFrame);
  }
  renderer.render(scene, camera);
});

// ── UI + connect ───────────────────────────────────────────────────────────
initUi({
  onConnect(config: VrConfig) {
    decayMs = config.decayMs;
    disposeAll();
    spawnMetaphor(config.metaphor);

    const wsUrl = `${config.serverUrl}/ws?sessionId=${config.sessionId}&role=presenter`;
    setStatus('Connecting…');

    const receiver = createWsReceiver(wsUrl, (frame: ColorFrame) => {
      lastFrame = frame;
    });

    receiver.onStatusChange = (status) => {
      setStatus(status === 'connected' ? 'Connected — enter VR' : status);
      if (status === 'connected') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        revealVrButton();
      }
    };

    let handTracker: HandTracker | null = null;

    function revealVrButton(): void {
      const btn = VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] });
      showVrButton(btn.parentElement ?? document.body);
      renderer.xr.addEventListener('sessionstart', () => {
        if (!handTracker) {
          handTracker = new HandTracker(renderer, scene, toggleFreeze);
        }
      });
    }

    window.addEventListener('beforeunload', () => receiver.close());
  },

  onDecayChange(ms: number) {
    decayMs = ms;
    aurora?.setDecayMs(ms);
    orbital?.setDecayMs(ms);
    constellation?.setDecayMs(ms);
    ripple?.setDecayMs(ms);
  },

  onMetaphorChange(metaphor: Metaphor) {
    switchMetaphor(metaphor);
  },
});
