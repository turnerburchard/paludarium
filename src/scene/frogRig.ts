import * as THREE from "three";
import { frogClips } from "../assets/animals/frogs";
import type { AnimalState } from "../simulation/types";

/** Jump clip times (seconds) for the simulation's hop phases. The engine
 * crouches for the first 20% of a hop edge, flies until 90%, then lands. */
const TAKEOFF = 0.33;
const TOUCHDOWN = 0.62;
/** Each chain runs shoulder or thigh first, ending at the bone holding the
 * tip. Diagonal pairs step together, as frogs walk. */
const LEGS = [
  {
    foot: "FrontFootL",
    chain: ["FrontLegL", "FrontUpLegL", "FrontLowLegL"],
    tip: "FrontLowLegL_end",
    pair: 0,
  },
  {
    foot: "BackFootR",
    chain: ["BackLegR", "BackUpLegR", "BackLowLegR"],
    tip: "BackLowLegR_end",
    pair: 0,
  },
  {
    foot: "FrontFootR",
    chain: ["FrontLegL001", "FrontUpLegR", "FrontLowLegR"],
    tip: "FrontLowLegR_end",
    pair: 1,
  },
  {
    foot: "BackFootL",
    chain: ["BackLegL", "BackUpLegL", "BackLowLegL"],
    tip: "BackLowLegL_end",
    pair: 1,
  },
];
/** Model-space distances, before species scaling. The frog is 0.62 wide. */
const STRIDE = 0.05;
const STEP_HEIGHT = 0.035;
const STEP_SECONDS = 0.14;

interface Leg {
  foot: THREE.Bone;
  tip: THREE.Bone;
  chain: THREE.Bone[];
  pair: number;
  planted: THREE.Vector3;
  step?: { from: THREE.Vector3; progress: number };
}

/** The pose a frog should hold this frame, read from its simulation state. */
export type FrogActivity = Pick<AnimalState, "activity" | "moving" | "motion">;

/** Plays the source rig's clips and keeps feet on the surface between hops.
 * Owns only presentation state; the simulation decides where the frog goes. */
export class FrogRig {
  private readonly channels: Channel[];
  private readonly rest = new Map<
    THREE.Bone,
    {
      position: THREE.Vector3;
      quaternion: THREE.Quaternion;
      scale: THREE.Vector3;
    }
  >();
  private readonly legs: Leg[];
  private readonly body: THREE.Bone;
  private readonly torso: THREE.Bone;
  private readonly head: THREE.Bone;
  private time = 0;
  private idleTime = 0;
  private hopClipTime = 0;
  private jumpWeight = 0;
  private attackWeight = 0;
  private sleepWeight = 0;
  private breath = 0;
  private grounded = false;

  constructor(private readonly model: THREE.Object3D) {
    const bone = (name: string) => {
      const found = model.getObjectByName(name);
      if (!(found instanceof THREE.Bone))
        throw new Error(`Frog rig is missing ${name}.`);
      return found;
    };
    model.traverse((object) => {
      if (object instanceof THREE.Bone)
        this.rest.set(object, {
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
        });
    });
    this.body = bone("Body");
    this.torso = bone("Torso");
    this.head = bone("Head");
    this.legs = LEGS.map((leg) => ({
      foot: bone(leg.foot),
      tip: bone(leg.tip),
      chain: leg.chain.map(bone),
      pair: leg.pair,
      planted: new THREE.Vector3(),
    }));
    const clips = [frogClips.idle, frogClips.jump, frogClips.attack];
    const channels = new Map<string, Channel>();
    clips.forEach((clip, layer) => {
      for (const track of clip.tracks) {
        const [name, property] = track.name.split(".");
        if (
          property !== "position" &&
          property !== "quaternion" &&
          property !== "scale"
        )
          throw new Error(`Unexpected frog clip track ${track.name}.`);
        let channel = channels.get(track.name);
        if (!channel) {
          channel = { bone: bone(name), property, samplers: [] };
          channels.set(track.name, channel);
        }
        channel.samplers[layer] = track.InterpolantFactoryMethodLinear();
      }
    });
    this.channels = [...channels.values()];
  }

  /** `dt` is real seconds; zero holds the current pose. The model's world
   * transform must already be set for this frame. */
  update(state: FrogActivity | undefined, dt: number) {
    this.time += dt;
    const hopping = !!state?.moving && state.motion.hop;
    const eating = state?.activity === "eating";
    const sleeping = state?.activity === "sleeping";
    const ease = (current: number, target: number, rate: number) =>
      current + (target - current) * (1 - Math.exp(-rate * dt));
    this.jumpWeight = hopping ? 1 : ease(this.jumpWeight, 0, 6);
    this.attackWeight = ease(this.attackWeight, eating ? 1 : 0, 5);
    this.sleepWeight = ease(this.sleepWeight, sleeping ? 1 : 0, 1.5);

    for (const [bone, pose] of this.rest) {
      bone.position.copy(pose.position);
      bone.quaternion.copy(pose.quaternion);
      bone.scale.copy(pose.scale);
    }
    // Idle slows toward sleep; the jump clip follows the hop's own progress.
    this.idleTime += dt * (1 - 0.7 * this.sleepWeight);
    if (hopping) this.hopClipTime = jumpTime(state.motion.progress);
    const attack = this.attackWeight * (1 - this.jumpWeight);
    blend(this.channels, [
      {
        time: this.idleTime % frogClips.idle.duration,
        weight: 1 - this.jumpWeight - attack,
      },
      { time: this.hopClipTime, weight: this.jumpWeight },
      // A snap at prey every couple of seconds while eating.
      {
        time: Math.min(this.time % 2.2, frogClips.attack.duration),
        weight: attack,
      },
    ]);

    if (hopping) this.anticipate(state.motion.progress);
    this.breathe(dt, hopping);
    this.settle();
    this.model.updateWorldMatrix(true, true);
    // Feet follow the clip in the air and stay put on the surface otherwise.
    if (hopping || !state) {
      this.grounded = false;
      for (const leg of this.legs)
        reach(this.model, leg, leg.foot.getWorldPosition(new THREE.Vector3()));
    } else this.plantFeet(dt);
  }

  /** Deepens the clip's shallow crouch before takeoff and squashes on landing. */
  private anticipate(progress: number) {
    const crouch =
      progress < 0.2
        ? Math.sin((progress / 0.2) * Math.PI * 0.5) ** 2
        : progress > 0.9
          ? Math.sin(((progress - 0.9) / 0.1) * Math.PI) * 0.6
          : 0;
    this.body.position.y -= 0.0012 * crouch;
    this.body.rotateX(-0.1 * crouch);
  }

  /** Flanks swell with each breath, faster after exertion and slower asleep. */
  private breathe(dt: number, exerted: boolean) {
    const rate = exerted ? 3.2 : 1.6 - 0.9 * this.sleepWeight;
    this.breath += dt * rate * Math.PI * 2;
    const swell = 1 + 0.035 * (0.5 + 0.5 * Math.sin(this.breath));
    this.torso.scale.x *= swell;
    this.torso.scale.z *= swell;
  }

  /** Asleep, the frog sinks onto its belly and lowers its head. */
  private settle() {
    const sleep = this.sleepWeight;
    if (sleep < 0.001) return;
    this.body.position.y -= 0.003 * sleep;
    this.head.rotateX(0.18 * sleep);
  }

  private plantFeet(dt: number) {
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
      if (!leg.step && offset > STRIDE * 2.5) leg.planted.copy(home);
      else if (!leg.step && offset > STRIDE && !stepping.has(1 - leg.pair)) {
        leg.step = { from: leg.planted.clone(), progress: 0 };
        stepping.add(leg.pair);
      }
      let foot = leg.planted;
      if (leg.step) {
        leg.step.progress = Math.min(1, leg.step.progress + dt / STEP_SECONDS);
        const t = leg.step.progress;
        // The step lands where the clip wants the foot now, as the body moves on.
        foot = this.model.worldToLocal(
          leg.step.from.clone().lerp(home, t * t * (3 - 2 * t)),
        );
        foot.y += Math.sin(t * Math.PI) * STEP_HEIGHT;
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

interface Channel {
  bone: THREE.Bone;
  property: "position" | "quaternion" | "scale";
  /** One per clip layer, where that clip animates this property. */
  samplers: (THREE.Interpolant | undefined)[];
}

const sampled = new THREE.Quaternion();
const sampledVector = new THREE.Vector3();
const blended = new THREE.Quaternion();
const blendedVector = new THREE.Vector3();

/** Weighted blend of clip layers over the rest pose. Bones must already be at
 * rest; a property no active layer animates keeps its rest value. */
function blend(
  channels: readonly Channel[],
  layers: readonly { time: number; weight: number }[],
) {
  for (const channel of channels) {
    const target = channel.bone[channel.property];
    let total = 0;
    for (const [i, layer] of layers.entries()) {
      const sampler = channel.samplers[i];
      if (!sampler || layer.weight <= 0) continue;
      const values = sampler.evaluate(layer.time);
      total += layer.weight;
      // Running average: each layer pulls by its share of the weight so far.
      const share = layer.weight / total;
      if (target instanceof THREE.Quaternion)
        blended.slerp(sampled.fromArray(values), share);
      else blendedVector.lerp(sampledVector.fromArray(values), share);
    }
    if (total === 0) continue;
    if (target instanceof THREE.Quaternion)
      target.slerp(blended, Math.min(1, total));
    else target.lerp(blendedVector, Math.min(1, total));
  }
}

/** Maps hop progress onto the jump clip so its crouch, flight and landing
 * line up with the simulation's. */
function jumpTime(progress: number) {
  const clip = frogClips.jump.duration;
  if (progress < 0.2) return (progress / 0.2) * TAKEOFF;
  if (progress < 0.9)
    return TAKEOFF + ((progress - 0.2) / 0.7) * (TOUCHDOWN - TAKEOFF);
  return TOUCHDOWN + ((progress - 0.9) / 0.1) * (clip - TOUCHDOWN);
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
