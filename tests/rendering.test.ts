import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { batchStaticAsset } from "../src/assets/batch";
import { buildAsset, disposeAsset, assets } from "../src/assets";
import { randomFromSeed } from "../src/model/random";

function stats(root: THREE.Group) {
  let meshes = 0,
    triangles = 0,
    coloredVertices = 0;
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    meshes++;
    triangles +=
      (part.geometry.index?.count ??
        part.geometry.getAttribute("position").count) / 3;
    coloredVertices += part.geometry.getAttribute("color")?.count ?? 0;
  });
  return { meshes, triangles, coloredVertices };
}

describe("static rendering batches", () => {
  it.each([assets["leaf-litter"].build, assets.strawberry.build])(
    "retains transformed geometry while reducing draws",
    (builder) => {
      const original = builder(randomFromSeed(173));
      const before = stats(original);
      const bounds = new THREE.Box3().setFromObject(original, true);
      const batched = batchStaticAsset(original);
      const after = stats(batched);
      const resultBounds = new THREE.Box3().setFromObject(batched, true);
      expect(after.meshes).toBeLessThan(before.meshes / 10);
      expect(after.triangles).toBe(before.triangles);
      expect(after.coloredVertices).toBe(before.coloredVertices);
      expect(resultBounds.min.distanceTo(bounds.min)).toBeLessThan(1e-6);
      expect(resultBounds.max.distanceTo(bounds.max)).toBeLessThan(1e-6);
      disposeAsset(batched);
    },
  );
  it("builds independently owned materials for placement previews", () => {
    const first = buildAsset("fern", 173),
      second = buildAsset("fern", 173);
    const a = (first.children[0] as THREE.Mesh).material as THREE.Material;
    const b = (second.children[0] as THREE.Mesh).material as THREE.Material;
    a.opacity = 0.5;
    expect(b.opacity).toBe(1);
    disposeAsset(first);
    disposeAsset(second);
  });
});
