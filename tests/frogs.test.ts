import { describe, expect, it } from "vitest";
import { Box3, Mesh } from "three";
import { buildAsset, disposeAsset } from "../src/scene/assetBuilders";
import { frogKinds } from "../src/model/species";
import { assets } from "../src/model/catalog";

describe("frog assets", () => {
  it.each(frogKinds)(
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
        for (const name of ["position", "normal"]) {
          const attribute = object.geometry.getAttribute(name);
          expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        }
      });
      expect(triangles).toBeLessThan(2500);
      disposeAsset(model);
    },
  );
});
