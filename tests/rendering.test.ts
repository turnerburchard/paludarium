import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { batchStaticAsset } from "../src/assets/batch";
import { buildAsset, disposeAsset, assets } from "../src/assets";
import { randomFromSeed } from "../src/model/random";
import { mossCarpet, mossCushions } from "../src/assets/landscape/mossCover";

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
  it.each([
    { width: 5, depth: 3 },
    { width: 9, depth: 6 },
  ])("keeps painted moss inside a $width by $depth tank", (bounds) => {
    const points = [-1, 1].flatMap((x) =>
      [-1, 1].map(
        (z) =>
          new THREE.Vector3(
            (x * bounds.width) / 2,
            0.5,
            (z * bounds.depth) / 2,
          ),
      ),
    );
    const cushions = mossCushions(points, randomFromSeed(31));
    const carpet = mossCarpet(cushions, bounds)!;
    carpet.computeBoundingBox();
    expect(carpet.boundingBox!.min.x).toBeGreaterThanOrEqual(-bounds.width / 2);
    expect(carpet.boundingBox!.max.x).toBeLessThanOrEqual(bounds.width / 2);
    expect(carpet.boundingBox!.min.z).toBeGreaterThanOrEqual(-bounds.depth / 2);
    expect(carpet.boundingBox!.max.z).toBeLessThanOrEqual(bounds.depth / 2);
    carpet.dispose();
    cushions.forEach((c) => c.lumps.forEach((l) => l.dispose()));
  });
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
  it("keeps dry carpet cushions unchanged when water covers others", () => {
    const points = [0, 0.2, 0.4].map((y) => new THREE.Vector3(y * 4, y, 0));
    const cushions = mossCushions(points, randomFromSeed(31));
    const full = mossCarpet(cushions)!;
    const dry = mossCarpet(cushions.filter((c) => c.point.y > 0.1))!;
    const lowest = mossCarpet(cushions.slice(0, 1))!;
    const position = (g: THREE.BufferGeometry) => g.getAttribute("position");
    expect(position(dry).count).toBe(
      position(full).count - position(lowest).count,
    );
    // The dry cushions are the tail of the full carpet, vertex for vertex.
    const offset = position(lowest).count * 3;
    expect(Array.from(position(dry).array)).toEqual(
      Array.from(position(full).array).slice(offset),
    );
    expect(mossCarpet([])).toBeUndefined();
  });
});
