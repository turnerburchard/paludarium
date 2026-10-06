import * as THREE from "three";
import type { AnimalState } from "../simulation/types";
import { PlantedLegs, type LegSpec } from "./legs";

/** Diagonal pairs step together, the sprawling trot of a lizard. */
const LEGS: LegSpec[] = [
  {
    foot: "handL",
    chain: ["upperArmL", "forearmL"],
    tip: "handL_tip",
    pair: 0,
  },
  { foot: "footR", chain: ["thighR", "shinR"], tip: "footR_tip", pair: 0 },
  {
    foot: "handR",
    chain: ["upperArmR", "forearmR"],
    tip: "handR_tip",
    pair: 1,
  },
  { foot: "footL", chain: ["thighL", "shinL"], tip: "footL_tip", pair: 1 },
];
/** The body bends in an S from hips to head; the tail swings wider. */
const BODY = ["pelvis", "spine", "chest", "neck"] as const;
const TAIL = ["tail1", "tail2", "tail3", "tail4"] as const;

export type GeckoActivity = Pick<AnimalState, "activity" | "moving">;

/** Animates the procedural gecko: a side-to-side swing through the spine and
 * tail while it runs, feet planted on bark or glass, a steady head, and a
 * curled tail asleep. Owns only presentation state. */
export class GeckoRig {
  private readonly legs: PlantedLegs;
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly rest = new Map<THREE.Bone, THREE.Vector3>();
  private readonly last = new THREE.Vector3();
  private placed = false;
  private time = 0;
  /** Gait phase, advanced by distance run rather than by time. */
  private phase = 0;
  private swing = 0;
  private sleepWeight = 0;
  private glance = 0;
  private glanceTarget = 0;

  constructor(private readonly model: THREE.Object3D) {
    model.traverse((object) => {
      if (object instanceof THREE.Bone) {
        this.bones.set(object.name, object);
        this.rest.set(object, object.position.clone());
      }
    });
    // Model-space distances before the gecko's own scaling.
    this.legs = new PlantedLegs(model, LEGS, {
      stride: 0.04,
      stepHeight: 0.03,
      stepSeconds: 0.06,
    });
  }

  private bone(name: string) {
    const bone = this.bones.get(name);
    if (!bone) throw new Error(`Gecko rig is missing ${name}.`);
    return bone;
  }

  /** `dt` is real seconds; zero holds the pose. The model's world transform
   * must already be set for this frame. */
  update(state: GeckoActivity | undefined, dt: number) {
    this.time += dt;
    const ease = (current: number, target: number, rate: number) =>
      current + (target - current) * (1 - Math.exp(-rate * dt));
    for (const [bone, position] of this.rest) {
      bone.position.copy(position);
      bone.quaternion.identity();
      bone.scale.setScalar(1);
    }

    const here = this.model.getWorldPosition(new THREE.Vector3());
    const travelled = this.placed ? here.distanceTo(this.last) : 0;
    this.last.copy(here);
    this.placed = true;
    const running = !!state?.moving && travelled > 0;
    this.phase += (travelled / this.model.scale.x) * 18;
    this.swing = ease(this.swing, running ? 1 : 0, 8);
    this.sleepWeight = ease(
      this.sleepWeight,
      state?.activity === "sleeping" ? 1 : 0,
      1.2,
    );

    // A travelling wave from the hips forward; the head turns against it so
    // the gaze stays level.
    let turn = 0;
    for (const [i, name] of BODY.entries()) {
      const bend = 0.16 * this.swing * Math.sin(this.phase - i * 0.9);
      this.bone(name).rotation.y = bend;
      turn += bend;
    }
    // When still, the gecko looks about now and then.
    if (!running && Math.random() < dt * 0.25)
      this.glanceTarget = (Math.random() - 0.5) * 0.9;
    this.glance = ease(this.glance, running ? 0 : this.glanceTarget, 3);
    this.bone("head").rotation.y = -turn * 0.8 + this.glance;

    // The tail lags behind the body and swings wider toward its tip; asleep
    // it curls around to one side.
    for (const [i, name] of TAIL.entries()) {
      const swing =
        0.22 *
        this.swing *
        Math.sin(this.phase - (i + 2) * 0.9) *
        (1 + i * 0.3);
      const idle = 0.05 * Math.sin(this.time * 0.7 - i * 0.6) * (i / 3);
      this.bone(name).rotation.y =
        swing + idle * (1 - this.swing) + 0.38 * this.sleepWeight;
    }

    // Breathing swells the chest; asleep the belly settles to the surface.
    const breath = 1 + 0.03 * Math.sin(this.time * (2.4 - this.sleepWeight));
    this.bone("chest").scale.set(breath, breath, 1);
    this.bone("pelvis").position.y -= 0.025 * this.sleepWeight;
    this.bone("neck").rotation.x = 0.12 * this.sleepWeight;

    // Eating is a quick dip and snap of the head every second or so.
    if (state?.activity === "eating") {
      const snap = Math.max(0, Math.sin(this.time * 5.5)) ** 6;
      this.bone("neck").rotation.x += 0.35 * snap;
      this.bone("chest").position.z -= 0.02 * snap;
    }

    this.model.updateWorldMatrix(true, true);
    if (state) this.legs.plant(dt);
    else this.legs.follow();
  }
}
