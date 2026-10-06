import * as THREE from "three";

/** Loops a fish's swim clip, beating faster for quicker swimmers. The clip
 * only bends the body, so the school still decides where the fish goes. */
export class SwimRig {
  private readonly mixer: THREE.AnimationMixer;

  constructor(
    model: THREE.Object3D,
    clip: THREE.AnimationClip,
    private readonly pace: number,
  ) {
    this.mixer = new THREE.AnimationMixer(model);
    this.mixer.clipAction(clip).play();
  }

  update(_: unknown, dt: number) {
    this.mixer.update(dt * this.pace);
  }
}
