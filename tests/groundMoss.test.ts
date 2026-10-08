import { describe, expect, it } from "vitest";
import { emptyWorld } from "../src/model/schema";
import { applyTerrainBrush } from "../src/model/terrainBrush";
import { groundHeight } from "../src/model/terrain";
import { makeGroundMoss } from "../src/scene/groundMoss";

describe("painted moss carpet", () => {
  it("follows slopes at every vertex and stays within the tank", () => {
    let env = { ...emptyWorld().environment, water: 0 };
    for (let i = 0; i < 20; i++)
      env = applyTerrainBrush(env, -1.75, 0, { mode: "raise", radius: 0.65 });
    env.terrain!.paint = env.terrain!.paint.map(() => "moss");
    const carpet = makeGroundMoss(env)!;
    const points = carpet.getAttribute("position");
    expect(points.count).toBeGreaterThan(0);
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i),
        z = points.getZ(i);
      expect(Math.abs(x)).toBeLessThanOrEqual(env.width / 2);
      expect(Math.abs(z)).toBeLessThanOrEqual(env.depth / 2);
      const lift = points.getY(i) - groundHeight(x, z, env);
      expect(lift).toBeGreaterThanOrEqual(-0.000001);
      expect(lift).toBeLessThan(0.035);
    }
    carpet.dispose();
  });
  it("keeps an existing patch unchanged when more moss is painted elsewhere", () => {
    const env = applyTerrainBrush(
      { ...emptyWorld().environment, water: 0 },
      -1.75,
      0,
      { mode: "moss", radius: 0.65 },
    );
    const before = makeGroundMoss(env)!;
    const after = makeGroundMoss(
      applyTerrainBrush(env, 2, 0, { mode: "moss", radius: 0.65 }),
    )!;
    const left = (geometry: typeof before) => {
      const points = geometry.getAttribute("position"),
        colors = geometry.getAttribute("color"),
        result: number[] = [];
      for (let i = 0; i < points.count; i++)
        if (points.getX(i) < 0)
          result.push(
            points.getX(i),
            points.getY(i),
            points.getZ(i),
            colors.getX(i),
            colors.getY(i),
            colors.getZ(i),
          );
      return result;
    };
    expect(left(after)).toEqual(left(before));
    before.dispose();
    after.dispose();
  });
  it("keeps painted moss in the save when water covers it, and restores its shape when drained", () => {
    const env = applyTerrainBrush(
      { ...emptyWorld().environment, water: 0 },
      -1.75,
      0,
      { mode: "moss", radius: 0.65 },
    );
    const dry = makeGroundMoss(env)!;
    expect(makeGroundMoss({ ...env, water: 2.65 })).toBeUndefined();
    const drained = makeGroundMoss({ ...env, water: 0 })!;
    expect(drained.getAttribute("position").array).toEqual(
      dry.getAttribute("position").array,
    );
    dry.dispose();
    drained.dispose();
  });
});
