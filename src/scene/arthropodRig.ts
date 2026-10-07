import * as THREE from "three";
import type { AnimalState } from "../simulation/types";
import { PlantedLegs, type LegSpec } from "./legs";

export type ArthropodActivity = Pick<AnimalState, "activity" | "moving">;

/** Which legs to plant, for each arm the axis that lowers it, how far the
 * body can sink before it touches the ground, and how high the arms wave
 * (radians). */
export interface ArthropodRigSpec {
  settle: number;
  legs: readonly LegSpec[];
  arms: readonly { bone: string; lowers: number[] }[];
  wave: number;
}

/** Animates crabs, scorpions and spiders: feet planted as the body moves,
 * neighboring legs stepping in turn, a little bob in the body, and claws or
 * palps that pick at food. Asleep, the body settles low. */
export class ArthropodRig {
  private readonly legs: PlantedLegs;
  private readonly body: THREE.Bone;
  private readonly arms: { bone: THREE.Object3D; lowers: THREE.Vector3 }[];
  private readonly rest = new Map<THREE.Bone, THREE.Vector3>();
  private readonly settle: number;
  private readonly wave: number;
  private readonly last = new THREE.Vector3();
  private placed = false;
  private time = 0;
  private phase = 0;
  private walk = 0;
  private sleepWeight = 0;

  constructor(
    private readonly model: THREE.Object3D,
    { settle, legs, arms, wave }: ArthropodRigSpec,
  ) {
    this.settle = settle;
    this.wave = wave;
    const body = model.getObjectByName("body");
    if (!(body instanceof THREE.Bone)) throw new Error("Rig is missing body.");
    this.body = body;
    model.traverse((object) => {
      if (object instanceof THREE.Bone)
        this.rest.set(object, object.position.clone());
    });
    this.arms = arms.map(({ bone, lowers }) => {
      const found = model.getObjectByName(bone);
      if (!found) throw new Error(`Rig is missing ${bone}.`);
      return { bone: found, lowers: new THREE.Vector3().fromArray(lowers) };
    });
    // Model-space distances; these animals are a few tenths across.
    this.legs = new PlantedLegs(model, legs, {
      stride: 0.018,
      stepHeight: 0.018,
      stepSeconds: 0.07,
    });
  }

  /** `dt` is real seconds; zero holds the pose. The model's world transform
   * must already be set for this frame. */
  update(state: ArthropodActivity | undefined, dt: number) {
    this.time += dt;
    for (const [bone, position] of this.rest) {
      bone.position.copy(position);
      bone.quaternion.identity();
    }
    const ease = (current: number, target: number, rate: number) =>
      current + (target - current) * (1 - Math.exp(-rate * dt));
    const here = this.model.getWorldPosition(new THREE.Vector3());
    const travelled = this.placed ? here.distanceTo(this.last) : 0;
    this.last.copy(here);
    this.placed = true;
    this.phase += (travelled / this.model.scale.x) * 60;
    this.walk = ease(this.walk, state?.moving && travelled > 0 ? 1 : 0, 8);
    this.sleepWeight = ease(
      this.sleepWeight,
      state?.activity === "sleeping" ? 1 : 0,
      1.2,
    );

    // Each pair of steps lifts the body a little; asleep it settles until
    // it nearly rests on the ground.
    this.body.position.y +=
      0.004 * this.walk * Math.abs(Math.sin(this.phase)) -
      0.9 * this.settle * this.sleepWeight;

    // Claws and palps rest low, so they only ever move up: a little drift
    // at rest, and while eating they take turns lifting food to the mouth.
    // Waving arms are held clear of the ground, bob with the steps, and
    // slowly rise and fall while the animal stands.
    const eating = state?.activity === "eating";
    for (const [i, { bone, lowers }] of this.arms.entries()) {
      const pick = eating
        ? Math.max(0, Math.sin(this.time * 4 + i * Math.PI)) ** 2
        : 0;
      const drift = 0.03 * (1 + Math.sin(this.time * 0.8 + i * 2));
      const bob = Math.abs(Math.sin(this.phase / 2 + i));
      const sway = Math.max(0, Math.sin(this.time * 0.5 + i * 2.5)) ** 2;
      const wave =
        this.wave *
        (0.3 + 0.7 * (this.walk * bob + (1 - this.walk) * sway)) *
        (1 - this.sleepWeight);
      bone.quaternion.setFromAxisAngle(lowers, -(0.4 * pick + drift + wave));
    }

    this.model.updateWorldMatrix(true, true);
    if (state) this.legs.plant(dt);
    else this.legs.follow();
  }
}
