import { describe, expect, it } from "vitest";
import { emptyWorld } from "../src/model/schema";
import { applyTerrainBrush, type TerrainMode } from "../src/model/terrainBrush";
import { paintSamples } from "../src/model/terrainData";
import {
  changedArea,
  drawTerrain,
  makeTerrain,
} from "../src/scene/groundSurface";

describe("ground surface", () => {
  it("redraws only what a stroke changed and matches drawing it all again", () => {
    let env = { ...emptyWorld().environment, water: 0 };
    const surface = makeTerrain(env);
    drawTerrain(surface, env);
    const dabs: [TerrainMode, number, number][] = [
      ["stone", 0.5, 0.3],
      ["stone", 0.9, 0.5],
      ["sand", -0.4, -0.6],
      ["raise", 0.3, 0.1],
      ["moss", -2, 1],
    ];
    for (const [mode, x, z] of dabs) {
      const next = applyTerrainBrush(env, x, z, { mode, radius: 0.65 });
      drawTerrain(surface, next, changedArea(env.terrain, next));
      env = next;
    }
    const fresh = makeTerrain(env);
    drawTerrain(fresh, env);
    for (const name of ["position", "color", "normal"]) {
      const drawn = surface.getAttribute(name).array,
        expected = fresh.getAttribute(name).array;
      // One expect per value takes seconds on a mesh this size.
      let worst = 0;
      drawn.forEach((value, i) => {
        worst = Math.max(worst, Math.abs(value - expected[i]));
      });
      expect(worst, name).toBeLessThan(5e-6);
    }
    surface.dispose();
    fresh.dispose();
  });
  it("limits a paint dab's redraw to the ground near it", () => {
    const env = { ...emptyWorld().environment, water: 0 };
    const painted = applyTerrainBrush(env, 1, 0.5, {
      mode: "sand",
      radius: 0.65,
    });
    const area = changedArea(env.terrain, painted)!;
    expect(area.min.x).toBeGreaterThan(0);
    expect(area.max.x).toBeLessThan(2);
    expect(area.min.y).toBeGreaterThan(-0.5);
    expect(area.max.y).toBeLessThan(1.5);
  });
  it("blends paint with weights that add up to the whole", () => {
    const env = emptyWorld().environment;
    for (const [x, z] of [
      [0, 0],
      [0.37, -1.2],
      [-env.width / 2, env.depth / 2],
    ]) {
      const samples = paintSamples(x, z, env);
      expect(samples.every((s) => s.weight >= 0)).toBe(true);
      expect(samples.reduce((sum, s) => sum + s.weight, 0)).toBeCloseTo(1);
    }
  });
});
