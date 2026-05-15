import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class HandTracker {
  private hands: THREE.XRHandSpace[] = [];
  private controllers: THREE.XRTargetRaySpace[] = [];

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    onToggleFreeze: () => void,
  ) {
    const handFactory = new XRHandModelFactory();
    const controllerFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      const hand = renderer.xr.getHand(i);
      hand.addEventListener('pinchstart', onToggleFreeze);
      hand.add(handFactory.createHandModel(hand, 'mesh'));
      scene.add(hand);
      this.hands.push(hand);

      const controller = renderer.xr.getController(i);
      controller.addEventListener('selectstart', onToggleFreeze);
      const grip = renderer.xr.getControllerGrip(i);
      grip.add(controllerFactory.createControllerModel(grip));
      scene.add(controller);
      scene.add(grip);
      this.controllers.push(controller);
    }
  }
}
