import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAsset, disposeAsset, isAnimal } from "../src/assets";
import { makePreset, type Preset } from "../src/model/presets";
import type { HabitatObject } from "../src/model/schema";

/** How far the built model reaches past the nearest side or end glass. Leaves
 * may rise above the tank, but not through its walls. */
function pastGlass(object: HabitatObject, width: number, depth: number) {
  const model = buildAsset(object.kind, object.seed);
  const placed = new THREE.Group().add(model);
  placed.scale.setScalar(object.scale);
  placed.rotation.y = object.rotation;
  placed.position.set(object.x, 0, object.z);
  placed.updateMatrixWorld(true);
  let reach = -Infinity;
  const point = new THREE.Vector3();
  placed.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const positions = part.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
      reach = Math.max(
        reach,
        Math.abs(point.x) - width / 2,
        Math.abs(point.z) - depth / 2,
      );
    }
  });
  disposeAsset(model);
  return reach;
}

describe("preset layouts", () => {
  // Animals move about, so only the planting and hardscape are checked.
  it.each([
    "tropical",
    "mountain",
    "desert",
    "grotto",
    "island",
    "amazon",
  ] satisfies Preset[])("keep the %s preset inside the glass", (preset) => {
    const world = makePreset(preset);
    const { width, depth } = world.environment;
    const through = world.objects
      .filter((object) => !isAnimal(object.kind))
      .filter((object) => pastGlass(object, width, depth) > 0)
      .map((object) => `${object.kind} at ${object.x},${object.z}`);
    expect(through).toEqual([]);
  });
});
