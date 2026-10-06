import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAsset } from "../src/assets";
import { GeckoRig, type GeckoActivity } from "../src/scene/geckoRig";

const FRAME = 1 / 60;
const FEET = ["handL", "handR", "footL", "footR"];

function rigged() {
  const model = buildAsset("gecko", 3);
  const holder = new THREE.Group();
  holder.add(model);
  return { model, holder, rig: new GeckoRig(model) };
}
const running: GeckoActivity = { activity: "exploring", moving: true };
const sleeping: GeckoActivity = { activity: "sleeping", moving: false };
const world = (model: THREE.Object3D, name: string) =>
  model.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

describe("gecko rig", () => {
  it("swings its body while running and keeps its feet on the surface", () => {
    const { model, holder, rig } = rigged();
    rig.update(running, FRAME);
    let widest = 0;
    for (let frame = 0; frame < 120; frame++) {
      holder.position.z -= 0.3 * FRAME;
      rig.update(running, FRAME);
      widest = Math.max(
        widest,
        Math.abs(model.getObjectByName("pelvis")!.rotation.y),
      );
      for (const name of FEET) {
        const foot = world(model, name);
        const tip = world(model, `${name}_tip`);
        // Each leg bends to reach its planted foot.
        expect(tip.distanceTo(foot)).toBeLessThan(0.01);
        expect(model.worldToLocal(foot.clone()).y).toBeGreaterThan(-0.001);
      }
    }
    expect(widest).toBeGreaterThan(0.08);
  });

  it("holds still and curls its tail asleep", () => {
    const { model, rig } = rigged();
    for (let frame = 0; frame < 300; frame++) rig.update(sleeping, FRAME);
    expect(model.getObjectByName("pelvis")!.rotation.y).toBeCloseTo(0, 5);
    expect(model.getObjectByName("tail3")!.rotation.y).toBeGreaterThan(0.3);
  });
});
