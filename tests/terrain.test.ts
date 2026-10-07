import { describe, expect, it } from "vitest";
import { emptyWorld } from "../src/model/schema";
import {
  baseGroundHeight,
  groundHeight,
  groundNormal,
  MAX_GROUND_HEIGHT,
  placementProblem,
} from "../src/model/terrain";
import { applyTerrainBrush } from "../src/model/terrainBrush";
import { terrainPoint, TERRAIN_POINTS } from "../src/model/terrainData";
import { TerrainStroke } from "../src/editor/terrainStroke";
import { historyReducer } from "../src/editor/history";
import { parseWorld } from "../src/editor/persistence";
import { buildHabitat } from "../src/simulation/worldHabitat";

describe("saved landscape brushes", () => {
  it("raises ground above the old ceiling and saves it at the new ceiling", () => {
    let env = emptyWorld().environment;
    for (let i = 0; i < 200; i++)
      env = applyTerrainBrush(env, 1.75, 0, { mode: "raise", radius: 0.65 });
    expect(groundHeight(1.75, 0, env)).toBeCloseTo(2.4, 3);
    expect(Math.max(...env.terrain!.heights)).toBeGreaterThan(0.9);
    expect(
      Math.max(
        ...env.terrain!.heights.map((_, index) => {
          const point = terrainPoint(index, env);
          return groundHeight(point.x, point.z, env);
        }),
      ),
    ).toBeLessThanOrEqual(MAX_GROUND_HEIGHT);
    expect(
      parseWorld(JSON.stringify({ ...emptyWorld(), environment: env }))
        .environment,
    ).toEqual(env);
  });
  it.each(["raise", "lower"] as const)(
    "makes %s gradual while repeated passes keep accumulating",
    (mode) => {
      const original = emptyWorld();
      const stroke = new TerrainStroke(original, { mode, radius: 0.65 });
      stroke.dab(-1.75, 0);
      const before = groundHeight(-1.75, 0, original.environment);
      const first = Math.abs(
        groundHeight(-1.75, 0, stroke.current.environment) - before,
      );
      expect(first).toBeGreaterThan(0);
      expect(first).toBeCloseTo(0.025, 6);
      stroke.dab(-1.1, 0);
      stroke.dab(-1.75, 0);
      expect(
        Math.abs(groundHeight(-1.75, 0, stroke.current.environment) - before),
      ).toBeGreaterThan(first * 2);
    },
  );
  it("preserves old saves and round trips a whole undoable stroke", () => {
    const original = emptyWorld(),
      before = JSON.stringify(original);
    expect(parseWorld(before)).toEqual(original);
    const stroke = new TerrainStroke(original, { mode: "raise", radius: 0.65 });
    stroke.dab(-1.75, 0);
    const result = stroke.dab(-1.1, 0.3);
    expect(groundHeight(-1.75, 0, result.environment)).toBeGreaterThan(
      groundHeight(-1.75, 0, original.environment),
    );
    expect(JSON.stringify(original)).toBe(before);
    const history = historyReducer(
      { past: [], present: original, future: [] },
      { type: "commit", world: result },
    );
    expect(history.past).toHaveLength(1);
    expect(historyReducer(history, { type: "undo" }).present).toEqual(original);
    expect(
      historyReducer(historyReducer(history, { type: "undo" }), {
        type: "redo",
      }).present,
    ).toEqual(result);
    expect(parseWorld(JSON.stringify(result))).toEqual(result);
  });
  it("smooths a raised peak and keeps height edits within the validated tank bounds", () => {
    let env = emptyWorld().environment;
    for (let i = 0; i < 6; i++)
      env = applyTerrainBrush(env, -1.75, 0, { mode: "raise", radius: 0.65 });
    const peak = groundHeight(-1.75, 0, env);
    expect(peak).toBeLessThanOrEqual(MAX_GROUND_HEIGHT);
    const smooth = applyTerrainBrush(env, -1.75, 0, {
      mode: "smooth",
      radius: 0.65,
    });
    expect(groundHeight(-1.75, 0, smooth)).toBeLessThan(peak);
    for (let i = 0; i < 50; i++)
      env = applyTerrainBrush(env, -1.75, 0, { mode: "lower", radius: 0.65 });
    expect(groundHeight(-1.75, 0, env)).toBeGreaterThanOrEqual(0.08);
    expect(() =>
      parseWorld(JSON.stringify({ ...emptyWorld(), environment: env })),
    ).not.toThrow();
  });
  it("sculpts the same path consistently with sparse or frequent pointer events", () => {
    const original = emptyWorld();
    const brush = { mode: "raise" as const, radius: 0.65 };
    const sparse = new TerrainStroke(original, brush);
    sparse.dab(-2.2, -0.6);
    sparse.dab(-1, 0.6);
    const frequent = new TerrainStroke(original, brush);
    for (let step = 0; step <= 120; step++) {
      const t = step / 120;
      frequent.dab(-2.2 + 1.2 * t, -0.6 + 1.2 * t);
    }
    const expected = sparse.current.environment.terrain!.heights;
    frequent.current.environment.terrain!.heights.forEach((height, index) =>
      expect(height).toBeCloseTo(expected[index], 4),
    );
    const finished = frequent.current;
    expect(frequent.dab(-1, 0.6)).toBe(finished);
  });
  it("paints material independently of height and retains edits after resizing", () => {
    const env = applyTerrainBrush(emptyWorld().environment, -1.75, 0, {
      mode: "raise",
      radius: 0.65,
    });
    const painted = applyTerrainBrush(env, -1.75, 0, {
      mode: "sand",
      radius: 0.65,
    });
    expect(painted.terrain!.heights).toEqual(env.terrain!.heights);
    expect(painted.terrain!.paint).toContain("sand");
    const resized = { ...painted, width: 9, depth: 6 };
    const beforeDelta =
      groundHeight(-1.75, 0, painted) - baseGroundHeight(-1.75, 0, painted);
    const afterDelta =
      groundHeight(-2.25, 0, resized) - baseGroundHeight(-2.25, 0, resized);
    expect(afterDelta).toBeCloseTo(beforeDelta);
    expect(
      parseWorld(JSON.stringify({ ...emptyWorld(), environment: resized }))
        .environment.terrain,
    ).toEqual(painted.terrain);
  });
  it("carves a continuous stream that supports fish and updates frog shoreline nodes", () => {
    const world = emptyWorld();
    const before = buildHabitat(world);
    const stroke = new TerrainStroke(world, { mode: "stream", radius: 0.55 });
    stroke.dab(-2.2, -0.6);
    const result = stroke.dab(-1, 0.6);
    for (let step = 0; step <= 12; step++) {
      const t = step / 12;
      expect(
        placementProblem(
          "fish",
          -2.2 + 1.2 * t,
          -0.6 + 1.2 * t,
          result.environment,
        ),
      ).toBeNull();
    }
    const after = buildHabitat(result);
    expect(
      [...after.nodes.values()]
        .filter((node) => node.wet)
        .map((node) => node.position),
    ).not.toEqual(
      [...before.nodes.values()]
        .filter((node) => node.wet)
        .map((node) => node.position),
    );
    expect([...after.nodes.values()].some((node) => node.wet)).toBe(true);
  });
  it("rejects malformed maps, excessive deltas, and unknown materials", () => {
    const world = new TerrainStroke(emptyWorld(), {
      mode: "raise",
      radius: 0.65,
    }).dab(-1.75, 0);
    const invalid = structuredClone(world);
    invalid.environment.terrain!.heights.pop();
    expect(() => parseWorld(JSON.stringify(invalid))).toThrow();
    invalid.environment.terrain!.heights =
      Array<number>(TERRAIN_POINTS).fill(3);
    expect(() => parseWorld(JSON.stringify(invalid))).toThrow();
    const malformed = JSON.parse(JSON.stringify(world));
    malformed.environment.terrain.paint[0] = "lava";
    expect(() => parseWorld(JSON.stringify(malformed))).toThrow();
    const point = terrainPoint(TERRAIN_POINTS - 1, world.environment);
    expect(point).toEqual({
      x: world.environment.width / 2,
      z: world.environment.depth / 2,
    });
  });
});

describe("ground normal", () => {
  it("leans away from a slope", () => {
    const raised = new TerrainStroke(emptyWorld(), {
      mode: "raise",
      radius: 0.65,
    }).dab(0, 0).environment;
    // East of the raised mound the ground falls away to the east.
    const side = groundNormal(0.4, 0, raised);
    expect(side.x).toBeGreaterThan(0.05);
    expect(Math.hypot(side.x, side.y, side.z)).toBeCloseTo(1, 6);
  });
});
