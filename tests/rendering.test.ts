import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { batchStaticAsset } from "../src/assets/batch";
import { buildBackdrop } from "../src/assets/landscape/backdrop";
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

describe("moss cover", () => {
  it.each(["rock", "log", "rock-shelter"] as const)(
    "grows a %s's moss over its top, the same way for the same seed",
    (kind) => {
      const bare = buildAsset(kind, 173);
      const mossy = buildAsset(kind, 173, "sheet");
      const again = buildAsset(kind, 173, "sheet");
      const moss = mossy.children.at(-1) as THREE.Mesh;
      const stone = new THREE.Box3().setFromObject(bare);
      const cover = new THREE.Box3().setFromObject(moss);
      expect(stats(mossy).meshes).toBe(stats(bare).meshes + 1);
      expect(stats(again).triangles).toBe(stats(mossy).triangles);
      expect(cover.max.y).toBeGreaterThan(stone.max.y - 0.05);
      expect(cover.getCenter(new THREE.Vector3()).y).toBeGreaterThan(
        stone.getCenter(new THREE.Vector3()).y,
      );
      [bare, mossy, again].forEach(disposeAsset);
    },
  );
});

describe("back walls", () => {
  it.each(["stone", "cork"] as const)(
    "keeps a %s wall and its moss inside the glass",
    (material) => {
      const wall = buildBackdrop(7, 2.9, { material, moss: "fern" });
      const bounds = new THREE.Box3().setFromObject(wall);
      // Geometry is stored as 32-bit floats.
      expect(bounds.min.x).toBeGreaterThanOrEqual(-3.5 - 1e-6);
      expect(bounds.max.x).toBeLessThanOrEqual(3.5 + 1e-6);
      expect(bounds.max.y).toBeLessThanOrEqual(2.9 + 1e-6);
      // The back glass stands 0.025 behind the wall's base.
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.025);
      disposeAsset(wall);
    },
  );
});
