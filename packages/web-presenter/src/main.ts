import { createRenderer } from './renderer.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const renderer = createRenderer(canvas);
renderer.start();
initUI(renderer);
