import * as THREE from "three";
import type { AnimalState } from "../simulation/types";

export type TurtleActivity = Pick<AnimalState, "activity" | "moving">;

/** Diagonal legs swing together as the turtle plods, its head bobbing with
 * each step; asleep it draws head and legs in under the shell. */
export class TurtleRig {
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly rest = new Map<THREE.Bone, THREE.Vector3>();
  private readonly last = new THREE.Vector3();
  private placed = false;
  private phase = 0;
  private walk = 0;
  private tuck = 0;
  private time = 0;

  constructor(private readonly model: THREE.Object3D) {
    model.traverse((object) => {
      if (object instanceof THREE.Bone) {
        this.bones.set(object.name, object);
        this.rest.set(object, object.position.clone());
      }
    });
  }

  private bone(name: string) {
    const bone = this.bones.get(name);
    if (!bone) throw new Error(`Turtle rig is missing ${name}.`);
    return bone;
  }

  update(state: TurtleActivity | undefined, dt: number) {
    this.time += dt;
    const ease = (current: number, target: number, rate: number) =>
      current + (target - current) * (1 - Math.exp(-rate * dt));
    const here = this.model.getWorldPosition(new THREE.Vector3());
    const travelled = this.placed ? here.distanceTo(this.last) : 0;
    this.last.copy(here);
    this.placed = true;
    this.phase += (travelled / this.model.scale.x) * 70;
    this.walk = ease(this.walk, state?.moving ? 1 : 0, 4);
    this.tuck = ease(this.tuck, state?.activity === "sleeping" ? 1 : 0, 1);
    for (const [bone, position] of this.rest) {
      bone.position.copy(position);
      bone.rotation.set(0, 0, 0);
      bone.scale.setScalar(1);
    }
    const stride = 0.4 * this.walk * Math.sin(this.phase);
    this.bone("legFL").rotation.x = stride;
    this.bone("legBR").rotation.x = stride;
    this.bone("legFR").rotation.x = -stride;
    this.bone("legBL").rotation.x = -stride;
    // The shell rocks and rises a touch with each step.
    const body = this.bone("body");
    body.rotation.z = 0.04 * this.walk * Math.sin(this.phase);
    body.position.y += 0.004 * this.walk * Math.abs(Math.cos(this.phase));
    // The head bobs forward as it walks and looks about when still.
    const neck = this.bone("neck");
    neck.rotation.x = 0.12 * this.walk * Math.sin(this.phase * 2);
    neck.rotation.y = (1 - this.walk) * 0.35 * Math.sin(this.time * 0.4);
    // Asleep, head and legs withdraw toward the shell.
    neck.position.z += 0.05 * this.tuck;
    neck.scale.setScalar(1 - 0.35 * this.tuck);
    for (const leg of ["legFL", "legFR", "legBL", "legBR"])
      this.bone(leg).scale.setScalar(1 - 0.4 * this.tuck);
    this.bone("tail").scale.setScalar(1 - 0.5 * this.tuck);
  }
}
