import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { emptyWorld } from "../src/model/schema";
import { applyTerrainBrush } from "../src/model/terrainBrush";
import { groundHeight } from "../src/model/terrain";
import { groundScatter } from "../src/scene/groundScatter";

const spot = (matrix: THREE.Matrix4) =>
  new THREE.Vector3().setFromMatrixPosition(matrix);

describe("ground scatter", () => {
  it("lies on the ground, inside the tank", () => {
    const env = emptyWorld().environment;
    const pieces = groundScatter(env);
    expect(pieces.length).toBeGreaterThan(0);
    for (const { matrix } of pieces) {
      const { x, y, z } = spot(matrix);
      expect(Math.abs(x)).toBeLessThan(env.width / 2);
      expect(Math.abs(z)).toBeLessThan(env.depth / 2);
      expect(y - groundHeight(x, z, env)).toBeCloseTo(0.004, 5);
    }
  });
  it("leaves painted moss bare and only puts pebbles on stone", () => {
    let env = { ...emptyWorld().environment, water: 0 };
    env = applyTerrainBrush(env, -1.5, 0, { mode: "moss", radius: 0.65 });
    env = applyTerrainBrush(env, 1.5, 0, { mode: "stone", radius: 0.65 });
    const near = (x: number) =>
      groundScatter(env).filter(({ matrix }) => {
        const p = spot(matrix);
        return Math.hypot(p.x - x, p.z) < 0.2;
      });
    expect(near(-1.5)).toEqual([]);
    const onStone = near(1.5);
    expect(onStone.length).toBeGreaterThan(0);
    expect(onStone.every((piece) => piece.kind === "pebble")).toBe(true);
  });
  it("keeps the rest of the tank unchanged when one area is painted", () => {
    const env = { ...emptyWorld().environment, water: 0 };
    const painted = applyTerrainBrush(env, 1.5, 0, {
      mode: "stone",
      radius: 0.65,
    });
    const far = (pieces: ReturnType<typeof groundScatter>) =>
      pieces.filter(({ matrix }) => spot(matrix).x < -1);
    expect(far(groundScatter(painted))).toEqual(far(groundScatter(env)));
  });
});
