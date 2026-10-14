import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { batchStaticAsset } from "../src/assets/batch";
import {
  buildAsset,
  buildAssetSteps,
  disposeAsset,
  assets,
} from "../src/assets";
import { randomFromSeed } from "../src/model/random";

afterEach(() => vi.restoreAllMocks());

function stats(root: THREE.Group) {
  let meshes = 0,
    triangles = 0;
  // The color each triangle corner is drawn with, summed over the model.
  const drawn = new THREE.Color(0, 0, 0);
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    meshes++;
    const { geometry } = part;
    const material = part.material as THREE.MeshStandardMaterial;
    const colors = material.vertexColors
      ? geometry.getAttribute("color")
      : undefined;
    const corners =
      geometry.index?.count ?? geometry.getAttribute("position").count;
    triangles += corners / 3;
    for (let i = 0; i < corners; i++) {
      const vertex = geometry.index?.getX(i) ?? i;
      const corner = material.color.clone();
      if (colors)
        corner.multiply(new THREE.Color().fromBufferAttribute(colors, vertex));
      drawn.add(corner);
    }
  });
  return { meshes, triangles, drawn };
}

describe("static rendering batches", () => {
  it("releases the source model when cancelled during foliage batching", () => {
    const build = vi.spyOn(assets.philodendron, "build");
    function* opening() {
      yield* buildAssetSteps("philodendron", 173);
    }
    const steps = opening();
    steps.next();
    const root: THREE.Group = build.mock.results[0].value;
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    root.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      resources.add(part.geometry);
      const materials = Array.isArray(part.material)
        ? part.material
        : [part.material];
      materials.forEach((material) => resources.add(material));
    });
    const releases = [...resources].map((resource) => {
      const released = vi.fn();
      resource.addEventListener("dispose", released);
      return released;
    });
    for (let i = 0; i < 10; i++) expect(steps.next().done).toBe(false);
    steps.return();
    for (const released of releases) expect(released).toHaveBeenCalled();
  });
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
      expect(after.drawn.r).toBeCloseTo(before.drawn.r, 3);
      expect(after.drawn.g).toBeCloseTo(before.drawn.g, 3);
      expect(after.drawn.b).toBeCloseTo(before.drawn.b, 3);
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
  it.each(["rock", "log", "capstone"] as const)(
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
