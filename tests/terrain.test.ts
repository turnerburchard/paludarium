import { describe, expect, it } from "vitest";
import { emptyWorld } from "../src/model/schema";
import { placementProblem } from "../src/model/water";
import {
  baseGroundHeight,
  groundHeight,
  groundNormal,
  onlyPaintDiffers,
} from "../src/model/terrain";
import { applyTerrainBrush } from "../src/model/terrainBrush";
import {
  groundCeiling,
  terrainGrid,
  terrainPoint,
} from "../src/model/terrainData";
import { TerrainStroke } from "../src/editor/terrainStroke";
import { historyReducer } from "../src/editor/history";
import { parseWorld } from "../src/editor/persistence";
import { buildHabitat } from "../src/simulation/worldHabitat";
import { withEnvironment } from "../src/editor/useEditor";

/** The grid point nearest x = -1.75 in the default tank. The brush gives a
 * grid point its full step, and ground between points is interpolated. */
const SPOT = (() => {
  const env = emptyWorld().environment;
  const { columns, rows } = terrainGrid(env);
  return terrainPoint(
    Math.round(rows / 2) * (columns + 1) + Math.round(columns / 4),
    env,
  );
})();

describe("saved landscape brushes", () => {
  it("raises ground above the old ceiling and saves it at the new ceiling", () => {
    let env = emptyWorld().environment;
    for (let i = 0; i < 200; i++)
      env = applyTerrainBrush(env, -SPOT.x, SPOT.z, {
        mode: "raise",
        radius: 0.65,
      });
    expect(groundHeight(-SPOT.x, SPOT.z, env)).toBeCloseTo(
      groundCeiling(env),
      3,
    );
    expect(Math.max(...env.terrain!.heights)).toBeGreaterThan(0.9);
    expect(
      Math.max(
        ...env.terrain!.heights.map((_, index) => {
          const point = terrainPoint(index, env);
          return groundHeight(point.x, point.z, env);
        }),
      ),
    ).toBeLessThanOrEqual(groundCeiling(env));
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
      stroke.dab(SPOT.x, SPOT.z);
      const before = groundHeight(SPOT.x, SPOT.z, original.environment);
      const first = Math.abs(
        groundHeight(SPOT.x, SPOT.z, stroke.current.environment) - before,
      );
      expect(first).toBeGreaterThan(0);
      expect(first).toBeCloseTo(0.025, 6);
      stroke.dab(SPOT.x + 0.65, SPOT.z);
      stroke.dab(SPOT.x, SPOT.z);
      expect(
        Math.abs(
          groundHeight(SPOT.x, SPOT.z, stroke.current.environment) - before,
        ),
      ).toBeGreaterThan(first * 2);
    },
  );
  it("preserves old saves and round trips a whole undoable stroke", () => {
    const original = emptyWorld(),
      before = JSON.stringify(original);
    expect(parseWorld(before)).toEqual(original);
    const stroke = new TerrainStroke(original, { mode: "raise", radius: 0.65 });
    stroke.dab(SPOT.x, SPOT.z);
    const result = stroke.dab(SPOT.x + 0.65, SPOT.z + 0.3);
    expect(groundHeight(SPOT.x, SPOT.z, result.environment)).toBeGreaterThan(
      groundHeight(SPOT.x, SPOT.z, original.environment),
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
      env = applyTerrainBrush(env, SPOT.x, SPOT.z, {
        mode: "raise",
        radius: 0.65,
      });
    const peak = groundHeight(SPOT.x, SPOT.z, env);
    expect(peak).toBeLessThanOrEqual(groundCeiling(env));
    const smooth = applyTerrainBrush(env, SPOT.x, SPOT.z, {
      mode: "smooth",
      radius: 0.65,
    });
    expect(groundHeight(SPOT.x, SPOT.z, smooth)).toBeLessThan(peak);
    for (let i = 0; i < 50; i++)
      env = applyTerrainBrush(env, SPOT.x, SPOT.z, {
        mode: "lower",
        radius: 0.65,
      });
    expect(groundHeight(SPOT.x, SPOT.z, env)).toBeGreaterThanOrEqual(0.08);
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
    const env = applyTerrainBrush(emptyWorld().environment, SPOT.x, SPOT.z, {
      mode: "raise",
      radius: 0.65,
    });
    const painted = applyTerrainBrush(env, SPOT.x, SPOT.z, {
      mode: "sand",
      radius: 0.65,
    });
    // The same array, so the ground's shape and the simulation skip
    // rebuilding for paint.
    expect(painted.terrain!.heights).toBe(env.terrain!.heights);
    expect(onlyPaintDiffers(env, painted)).toBe(true);
    expect(onlyPaintDiffers(env, { ...painted, water: 0.1 })).toBe(false);
    expect(onlyPaintDiffers(painted, env)).toBe(true);
    expect(painted.terrain!.paint).toContain("sand");
    const resized = { ...painted, width: 9, depth: 6 };
    const beforeDelta =
      groundHeight(SPOT.x, SPOT.z, painted) -
      baseGroundHeight(SPOT.x, SPOT.z, painted);
    // The same spot, stretched with the tank.
    const x = (SPOT.x * 9) / 7,
      z = (SPOT.z * 6) / 4.5;
    const afterDelta =
      groundHeight(x, z, resized) - baseGroundHeight(x, z, resized);
    expect(afterDelta).toBeCloseTo(beforeDelta);
    expect(
      parseWorld(JSON.stringify({ ...emptyWorld(), environment: resized }))
        .environment.terrain,
    ).toEqual(painted.terrain);
  });
  it("carves a continuous channel that supports fish and updates frog shoreline nodes", () => {
    const world = emptyWorld();
    const before = buildHabitat(world);
    const stroke = new TerrainStroke(world, { mode: "pool", radius: 0.55 });
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
    }).dab(SPOT.x, SPOT.z);
    const invalid = structuredClone(world);
    invalid.environment.terrain!.heights.pop();
    expect(() => parseWorld(JSON.stringify(invalid))).toThrow();
    invalid.environment.terrain!.heights =
      world.environment.terrain!.heights.map(() => 7);
    expect(() => parseWorld(JSON.stringify(invalid))).toThrow();
    const malformed = JSON.parse(JSON.stringify(world));
    malformed.environment.terrain.paint[0] = "lava";
    expect(() => parseWorld(JSON.stringify(malformed))).toThrow();
    const point = terrainPoint(
      world.environment.terrain!.heights.length - 1,
      world.environment,
    );
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

describe("terrain grid across tank sizes", () => {
  const sculpted = () => {
    let env = emptyWorld().environment;
    for (const [x, mode] of [
      [SPOT.x, "raise"],
      [1, "sand"],
      [2, "lower"],
    ] as const)
      env = applyTerrainBrush(env, x, SPOT.z, { mode, radius: 0.65 });
    return { ...emptyWorld(), environment: env };
  };

  it("adds grid points in a much larger tank without changing the landscape", () => {
    const world = sculpted();
    const small = world.environment;
    const large = withEnvironment(world, { width: 24, depth: 14 }).environment;
    expect(large.terrain!.columns).toBeGreaterThan(small.terrain!.columns);
    expect(large.width / large.terrain!.columns).toBeLessThanOrEqual(0.3);
    expect(large.depth / large.terrain!.rows).toBeLessThanOrEqual(0.3);
    for (let i = 0; i <= 40; i++) {
      const u = i / 40 - 0.5,
        v = Math.sin(i) * 0.5;
      const before = groundHeight(u * small.width, v * small.depth, small);
      const after = groundHeight(u * large.width, v * large.depth, large);
      expect(
        after -
          baseGroundHeight(u * large.width, v * large.depth, large) -
          (before - baseGroundHeight(u * small.width, v * small.depth, small)),
      ).toBeCloseTo(0, 3);
    }
    expect(large.terrain!.paint).toContain("sand");
    expect(
      parseWorld(JSON.stringify({ ...world, environment: large })),
    ).toEqual({ ...world, environment: large });
  });

  it("drops grid points again when the tank shrinks back", () => {
    const world = sculpted();
    const large = withEnvironment(world, { width: 24, depth: 14 });
    const back = withEnvironment(large, { width: 7, depth: 4.5 }).environment;
    expect(back.terrain!.columns).toBe(world.environment.terrain!.columns);
    expect(back.terrain!.rows).toBe(world.environment.terrain!.rows);
    expect(back.terrain!.heights).toEqual(world.environment.terrain!.heights);
  });
});
