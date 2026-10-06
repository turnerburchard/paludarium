import * as THREE from "three";
import type { AnimalState } from "../simulation/types";

export type SnailActivity = Pick<AnimalState, "activity" | "moving">;

/** A snail glides on its foot: the body stretches and gathers in a slow
 * ripple as it travels, and draws in under the shell asleep. */
export class SnailRig {
  private readonly body: THREE.Object3D[] = [];
  private readonly shell: THREE.Object3D[] = [];
  private readonly last = new THREE.Vector3();
  private placed = false;
  private phase = 0;
  private stretch = 0;
  private tuck = 0;

  constructor(private readonly model: THREE.Object3D) {
    model.traverse((part) => {
      if (part.name === "body") this.body.push(part);
      if (part.name === "shell") this.shell.push(part);
    });
  }

  update(state: SnailActivity | undefined, dt: number) {
    const ease = (current: number, target: number, rate: number) =>
      current + (target - current) * (1 - Math.exp(-rate * dt));
    const here = this.model.getWorldPosition(new THREE.Vector3());
    const travelled = this.placed ? here.distanceTo(this.last) : 0;
    this.last.copy(here);
    this.placed = true;
    this.phase += travelled * 60;
    this.stretch = ease(this.stretch, state?.moving ? 1 : 0, 2);
    this.tuck = ease(this.tuck, state?.activity === "sleeping" ? 1 : 0, 0.8);
    const length =
      1 + 0.07 * this.stretch * Math.sin(this.phase) - 0.18 * this.tuck;
    for (const part of this.body)
      part.scale.set(1, 1 - 0.1 * this.tuck, length);
    // The shell rides the body, rocking a little with each ripple.
    for (const part of this.shell) {
      part.position.y = -0.006 * this.tuck;
      part.rotation.x = 0.03 * this.stretch * Math.sin(this.phase + 1);
    }
  }
}
