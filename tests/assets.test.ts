import { describe, expect, it } from "vitest";
import { Box3, Mesh, type Object3D } from "three";
import { assets, buildAsset, catalog, disposeAsset } from "../src/assets";
import { assetKinds } from "../src/model/schema";

function positions(model: Object3D) {
  const values: number[] = [];
  model.traverse((object) => {
    if (object instanceof Mesh)
      values.push(...object.geometry.getAttribute("position").array);
  });
  return values;
}

describe("asset registry", () => {
  it("defines every saved asset kind under its own key", () => {
    expect(Object.keys(assets).sort()).toEqual([...assetKinds].sort());
    for (const [key, asset] of Object.entries(assets))
      expect(asset.kind).toBe(key);
  });

  it.each(catalog.map((a) => a.kind))(
    "builds %s with finite, repeatable geometry",
    (kind) => {
      const model = buildAsset(kind, 7);
      const values = positions(model);
      expect(values.length).toBeGreaterThan(0);
      expect(values.every(Number.isFinite)).toBe(true);
      expect(positions(buildAsset(kind, 7))).toEqual(values);
      disposeAsset(model);
    },
  );
});

describe("frog assets", () => {
  it.each(catalog.filter((a) => a.frog).map((a) => a.kind))(
    "builds a finite, grounded %s within its placement footprint",
    (kind) => {
      const model = buildAsset(kind, 42);
      const box = new Box3().setFromObject(model);
      expect(box.min.y).toBeGreaterThan(-0.04);
      expect(box.max.y).toBeGreaterThan(0.1);
      expect(box.max.y).toBeLessThan(0.24);
      for (const axis of ["x", "z"] as const) {
        expect(box.min[axis]).toBeGreaterThan(-assets[kind].radius);
        expect(box.max[axis]).toBeLessThan(assets[kind].radius);
      }
      let triangles = 0;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        triangles += object.geometry.getAttribute("position").count / 3;
        expect(
          Array.from(object.geometry.getAttribute("normal").array).every(
            Number.isFinite,
          ),
        ).toBe(true);
      });
      expect(triangles).toBeLessThan(2500);
      disposeAsset(model);
    },
  );
});
