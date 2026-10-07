import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAsset } from "../src/assets";
import { arthropodRigs } from "../src/assets/animals/arthropods";
import type { AssetKind } from "../src/model/schema";
import {
  ArthropodRig,
  type ArthropodActivity,
} from "../src/scene/arthropodRig";

const FRAME = 1 / 60;
const walking: ArthropodActivity = { activity: "exploring", moving: true };
const eating: ArthropodActivity = { activity: "eating", moving: false };
const sleeping: ArthropodActivity = { activity: "sleeping", moving: false };

function rigged(kind: AssetKind) {
  const model = buildAsset(kind, 3);
  const holder = new THREE.Group();
  holder.add(model);
  const spec = arthropodRigs.get(kind)!;
  return { model, holder, spec, rig: new ArthropodRig(model, spec) };
}
const world = (model: THREE.Object3D, name: string) =>
  model.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

describe.each([...arthropodRigs.keys()] as AssetKind[])("%s rig", (kind) => {
  it("walks with every leg reaching a foot on the surface", () => {
    const { model, holder, spec, rig } = rigged(kind);
    rig.update(walking, FRAME);
    const stepped = new Set<string>();
    for (let frame = 0; frame < 120; frame++) {
      const before = spec.legs.map((leg) => world(model, leg.foot));
      holder.position.z -= 0.1 * FRAME;
      rig.update(walking, FRAME);
      spec.legs.forEach((leg, i) => {
        const foot = world(model, leg.foot);
        if (foot.distanceTo(before[i]) > 1e-6) stepped.add(leg.foot);
        expect(world(model, leg.tip).distanceTo(foot)).toBeLessThan(0.01);
        expect(model.worldToLocal(foot.clone()).y).toBeGreaterThan(-0.001);
      });
    }
    expect(stepped.size).toBe(spec.legs.length);
  });

  it("lifts its arms to eat and settles asleep no lower than its settle gap", () => {
    const { model, spec, rig } = rigged(kind);
    const body = model.getObjectByName("body")!;
    const standing = body.position.y;
    let reach = 0;
    for (let frame = 0; frame < 60; frame++) {
      rig.update(eating, FRAME);
      for (const arm of spec.arms)
        reach = Math.max(
          reach,
          2 *
            Math.acos(
              Math.min(1, model.getObjectByName(arm.bone)!.quaternion.w),
            ),
        );
    }
    expect(reach).toBeGreaterThan(0.3);
    for (let frame = 0; frame < 300; frame++) rig.update(sleeping, FRAME);
    expect(body.position.y).toBeLessThanOrEqual(standing);
    expect(body.position.y).toBeGreaterThanOrEqual(standing - spec.settle);
  });
});
