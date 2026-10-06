import * as THREE from "three";

/** A leg as bone names: the foot bone it reaches for, its joints from
 * shoulder or hip outward, and the tip that should meet the foot. Legs in
 * the same pair step together. */
export interface LegSpec {
  foot: string;
  chain: string[];
  tip: string;
  pair: number;
}

/** Model-space distances, before species scaling. */
export interface Gait {
  stride: number;
  stepHeight: number;
  stepSeconds: number;
}

interface Leg {
  foot: THREE.Bone;
  tip: THREE.Bone;
  chain: THREE.Bone[];
  pair: number;
  planted: THREE.Vector3;
  step?: { from: THREE.Vector3; progress: number };
}

/** Keeps feet on the surface as the body moves over them, stepping in pairs
 * when a foot falls a stride behind where the animation wants it, and bends
 * each leg to reach its foot. */
export class PlantedLegs {
  private readonly legs: Leg[];
  private grounded = false;

  constructor(
    private readonly model: THREE.Object3D,
    specs: readonly LegSpec[],
    private readonly gait: Gait,
  ) {
    const bone = (name: string) => {
      const found = model.getObjectByName(name);
      if (!(found instanceof THREE.Bone))
        throw new Error(`Rig is missing ${name}.`);
      return found;
    };
    this.legs = specs.map((spec) => ({
      foot: bone(spec.foot),
      tip: bone(spec.tip),
      chain: spec.chain.map(bone),
      pair: spec.pair,
      planted: new THREE.Vector3(),
    }));
  }

  /** Feet go wherever the animation puts them, as in a leap. */
  follow() {
    this.grounded = false;
    for (const leg of this.legs)
      reach(this.model, leg, leg.foot.getWorldPosition(new THREE.Vector3()));
  }

  /** Feet hold their place on the surface. Call after posing the body, with
   * the model's world transform up to date. */
  plant(dt: number) {
    const { stride, stepHeight, stepSeconds } = this.gait;
    const stepping = new Set<number>();
    for (const leg of this.legs) if (leg.step) stepping.add(leg.pair);
    for (const leg of this.legs) {
      // Where the clip puts the foot this frame, in world space.
      const home = leg.foot.getWorldPosition(new THREE.Vector3());
      if (!this.grounded) {
        leg.planted.copy(home);
        leg.step = undefined;
        continue;
      }
      const offset = this.model
        .worldToLocal(leg.planted.clone())
        .distanceTo(this.model.worldToLocal(home.clone()));
      if (!leg.step && offset > stride * 2.5) leg.planted.copy(home);
      else if (!leg.step && offset > stride && !stepping.has(1 - leg.pair)) {
        leg.step = { from: leg.planted.clone(), progress: 0 };
        stepping.add(leg.pair);
      }
      let foot = leg.planted;
      if (leg.step) {
        leg.step.progress = Math.min(1, leg.step.progress + dt / stepSeconds);
        const t = leg.step.progress;
        // The step lands where the clip wants the foot now, as the body moves on.
        foot = this.model.worldToLocal(
          leg.step.from.clone().lerp(home, t * t * (3 - 2 * t)),
        );
        foot.y += Math.sin(t * Math.PI) * stepHeight;
        this.model.localToWorld(foot);
        if (t >= 1) {
          leg.planted.copy(home);
          leg.step = undefined;
        }
      }
      leg.foot.position.copy(leg.foot.parent!.worldToLocal(foot.clone()));
      leg.foot.updateMatrixWorld(true);
      reach(this.model, leg, foot);
    }
    this.grounded = true;
  }
}

const tip = new THREE.Vector3();
const joint = new THREE.Vector3();
const goal = new THREE.Vector3();
const toTip = new THREE.Vector3();
const toGoal = new THREE.Vector3();
const turn = new THREE.Quaternion();
const linkRotation = new THREE.Quaternion();
const parentRotation = new THREE.Quaternion();

/** Cyclic coordinate descent: bends each joint, tip first, so the leg's tip
 * meets the planted foot. Feet move a stride at most, so a few passes from
 * the clip's pose converge without flipping knees. Works in model space,
 * because species proportions scale the model unevenly and world-space
 * rotations would shear. */
function reach(model: THREE.Object3D, leg: Leg, target: THREE.Vector3) {
  model.worldToLocal(goal.copy(target));
  for (let pass = 0; pass < 6; pass++) {
    for (let i = leg.chain.length - 1; i >= 0; i--) {
      const link = leg.chain[i];
      model.worldToLocal(leg.tip.getWorldPosition(tip));
      model.worldToLocal(link.getWorldPosition(joint));
      toTip.subVectors(tip, joint).normalize();
      toGoal.subVectors(goal, joint).normalize();
      turn.setFromUnitVectors(toTip, toGoal);
      rotationInModel(model, link, linkRotation);
      rotationInModel(model, link.parent!, parentRotation);
      link.quaternion
        .copy(parentRotation.invert())
        .multiply(turn)
        .multiply(linkRotation);
      link.updateMatrixWorld(true);
    }
  }
}

function rotationInModel(
  model: THREE.Object3D,
  object: THREE.Object3D,
  out: THREE.Quaternion,
) {
  out.identity();
  for (let node = object; node !== model; node = node.parent!)
    out.premultiply(node.quaternion);
  return out;
}
