import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAsset } from "../src/assets";
import { FrogRig, type FrogActivity } from "../src/scene/frogRig";

const FRAME = 1 / 60;
const FEET = ["FrontFootL", "FrontFootR", "BackFootL", "BackFootR"];

function rigged() {
  const model = buildAsset("mossy-frog", 3);
  const holder = new THREE.Group();
  holder.add(model);
  return { model, holder, rig: new FrogRig(model) };
}
function walking(): FrogActivity {
  return {
    activity: "exploring",
    moving: true,
    motion: { progress: 0.5, lift: 0, tilt: 0, hop: false },
  };
}
function hopping(progress: number): FrogActivity {
  return {
    activity: "exploring",
    moving: true,
    motion: { progress, lift: 0, tilt: 0, hop: true },
  };
}
function world(model: THREE.Object3D, name: string) {
  return model.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
}
function bodyHeight(model: THREE.Object3D) {
  return model.worldToLocal(world(model, "Body")).y;
}

describe("frog rig", () => {
  it("keeps feet planted while the body walks on, stepping a stride at a time", () => {
    const { model, holder, rig } = rigged();
    rig.update(walking(), FRAME);
    let previous = FEET.map((name) => world(model, name));
    let steps = 0;
    for (let frame = 0; frame < 180; frame++) {
      holder.position.z -= 0.15 * FRAME;
      rig.update(walking(), FRAME);
      const feet = FEET.map((name) => world(model, name));
      for (const [i, foot] of feet.entries()) {
        const moved = foot.distanceTo(previous[i]);
        // A foot either holds still on the ground or is mid-step, lifted.
        if (moved > 1e-6) {
          steps++;
          expect(model.worldToLocal(foot.clone()).y).toBeGreaterThan(-0.001);
        }
        const tip = FEET[i].replace("Foot", "LowLeg") + "_end";
        // The leg reaches its foot rather than stretching away from it.
        expect(world(model, tip).distanceTo(foot)).toBeLessThan(0.002);
      }
      previous = feet;
    }
    expect(steps).toBeGreaterThan(0);
    // Planted feet never trail far behind the body.
    for (const name of FEET)
      expect(Math.abs(model.worldToLocal(world(model, name)).z)).toBeLessThan(
        0.3,
      );
  });

  it("shuffles its feet when turning on the spot", () => {
    const { model, holder, rig } = rigged();
    rig.update(walking(), FRAME);
    const start = FEET.map((name) => world(model, name));
    for (let frame = 0; frame < 30; frame++) {
      holder.rotation.y += (Math.PI / 2) * (1 / 30);
      rig.update(walking(), FRAME);
    }
    for (let frame = 0; frame < 30; frame++) rig.update(walking(), FRAME);
    const moved = FEET.filter(
      (name, i) => world(model, name).distanceTo(start[i]) > 0.02,
    );
    expect(moved.length).toBeGreaterThanOrEqual(2);
  });

  it("crouches before takeoff and rises in flight", () => {
    const { model, rig } = rigged();
    rig.update(hopping(0), FRAME);
    const start = bodyHeight(model);
    rig.update(hopping(0.18), FRAME);
    const crouched = bodyHeight(model);
    rig.update(hopping(0.5), FRAME);
    const flying = bodyHeight(model);
    expect(crouched).toBeLessThan(start);
    expect(flying).toBeGreaterThan(start);
  });

  it("settles lower while asleep", () => {
    const { model, rig } = rigged();
    const still = (activity: FrogActivity["activity"]): FrogActivity => ({
      activity,
      moving: false,
      motion: { progress: 0, lift: 0, tilt: 0, hop: false },
    });
    for (let frame = 0; frame < 120; frame++)
      rig.update(still("resting"), FRAME);
    const awake = bodyHeight(model);
    for (let frame = 0; frame < 300; frame++)
      rig.update(still("sleeping"), FRAME);
    expect(bodyHeight(model)).toBeLessThan(awake);
  });
});
