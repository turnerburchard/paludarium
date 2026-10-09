import { describe, expect, it } from "vitest";
import { Box3, Mesh, Vector3, type Object3D } from "three";
import {
  assetRadius,
  assets,
  buildAsset,
  catalog,
  disposeAsset,
  placementScale,
} from "../src/assets";
import { assetKinds } from "../src/model/schema";
import turtleModel from "../src/assets/animals/turtle.json";

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

describe("land animal assets", () => {
  it.each(catalog.filter((a) => a.behavior).map((a) => a.kind))(
    "builds a finite, grounded %s within its placement footprint",
    (kind) => {
      const model = buildAsset(kind, 42);
      const box = new Box3().setFromObject(model);
      expect(box.min.y).toBeGreaterThan(-0.04);
      // Geckos lie flatter than frogs, and the micro crab is flat by design.
      expect(box.max.y).toBeGreaterThan(0.04);
      // The desert tortoise stands tallest.
      expect(box.max.y).toBeLessThan(0.36);
      for (const axis of ["x", "z"] as const) {
        expect(box.min[axis]).toBeGreaterThan(-assetRadius(kind));
        expect(box.max[axis]).toBeLessThan(assetRadius(kind));
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
      // Warty frogs carry about 1,600 triangles of tubercles over the
      // shared 2,300-triangle body.
      expect(triangles).toBeLessThan(4500);
      disposeAsset(model);
    },
  );
});

describe("placement scale", () => {
  it("varies plants within their range on slider steps, and not animals", () => {
    expect(placementScale("monstera", () => 0)).toBe(0.6);
    expect(placementScale("monstera", () => 0.999)).toBe(1.5);
    expect(placementScale("monstera", () => 0.33)).toBe(0.9);
    expect(placementScale("tree-frog", () => 0.9)).toBe(1);
  });
});

describe("turtle model", () => {
  it("winds both eyes outward so neither is culled", () => {
    const eyes = turtleModel.parts.find((part) => part.color === "303030")!;
    const triangles = [];
    for (let i = 0; i < eyes.positions.length; i += 9)
      triangles.push(
        [0, 3, 6].map((k) =>
          new Vector3().fromArray(eyes.positions, i + k),
        ) as [Vector3, Vector3, Vector3],
      );
    for (const side of [-1, 1]) {
      const own = triangles.filter(([a]) => Math.sign(a.x) === side);
      const center = own
        .flat()
        .reduce((sum, p) => sum.add(p), new Vector3())
        .divideScalar(own.length * 3);
      for (const [a, b, c] of own) {
        const normal = new Vector3().crossVectors(
          b.clone().sub(a),
          c.clone().sub(a),
        );
        expect(normal.dot(a.clone().sub(center))).toBeGreaterThan(0);
      }
    }
  });
});
