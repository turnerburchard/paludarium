import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAsset } from "../src/assets";
import { TurtleRig } from "../src/scene/turtleRig";

const FRAME = 1 / 60;

describe("turtle rig", () => {
  it("swings diagonal legs together as it walks", () => {
    const model = buildAsset("turtle", 1);
    const holder = new THREE.Group();
    holder.add(model);
    const rig = new TurtleRig(model);
    let widest = 0;
    for (let frame = 0; frame < 120; frame++) {
      holder.position.z -= 0.1 * FRAME;
      rig.update({ activity: "exploring", moving: true }, FRAME);
      const front = model.getObjectByName("legFL")!.rotation.x;
      expect(model.getObjectByName("legBR")!.rotation.x).toBeCloseTo(front);
      widest = Math.max(widest, Math.abs(front));
    }
    expect(widest).toBeGreaterThan(0.2);
  });

  it("draws its head in asleep", () => {
    const model = buildAsset("turtle", 1);
    const rig = new TurtleRig(model);
    for (let frame = 0; frame < 300; frame++)
      rig.update({ activity: "sleeping", moving: false }, FRAME);
    expect(model.getObjectByName("neck")!.scale.x).toBeLessThan(0.75);
  });
});
