import { describe, expect, it } from "vitest";
import { emptyWorld, type HabitatObject } from "../src/model/schema";
import {
  groundCeiling,
  waterCeiling,
  newTerrain,
  terrainGrid,
  terrainPoint,
} from "../src/model/terrainData";
import { groundHeight, hasDryGround } from "../src/model/terrain";
import { applyTerrainBrush } from "../src/model/terrainBrush";
import { withEnvironment } from "../src/editor/useEditor";
import { objectBase } from "../src/model/stacking";
import { parseWorld } from "../src/editor/persistence";
import { historyReducer } from "../src/editor/history";
import {
  createFishSchool,
  createWorldEcosystem,
} from "../src/simulation/worldHabitat";

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

describe("adjustable tank height", () => {
  it("reseats animals in the resized habitat while preserving their needs", () => {
    const original = emptyWorld();
    original.environment = { ...original.environment, height: 5, water: 4.75 };
    for (let i = 0; i < 200; i++)
      original.environment = applyTerrainBrush(
        original.environment,
        SPOT.x,
        SPOT.z,
        {
          mode: "raise",
          radius: 1.2,
        },
      );
    original.objects = [
      {
        id: "frog",
        kind: "dart-frog",
        x: SPOT.x,
        z: SPOT.z,
        rotation: 0,
        scale: 1,
        seed: 1,
      },
      {
        id: "fish",
        kind: "fish",
        x: -SPOT.x,
        z: SPOT.z,
        rotation: 0,
        scale: 1,
        seed: 2,
      },
    ];
    const engine = createWorldEcosystem(original),
      fish = createFishSchool(original);
    const before = engine.getAnimal("frog")!;
    expect(before.position.y).toBeGreaterThan(4);
    const shrunk = withEnvironment(original, { height: 1.5 });
    const after = createWorldEcosystem(shrunk, {
      world: original,
      engine,
    }).getAnimal("frog")!;
    expect(after.position.y).toBeLessThan(shrunk.environment.height);
    expect(after.needs).toEqual(before.needs);
    const swimmer = createFishSchool(shrunk, { world: original, fish }).get(
      "fish",
    )!;
    expect(swimmer.y).toBeLessThan(shrunk.environment.water);
    expect(swimmer.y).toBeGreaterThan(
      groundHeight(swimmer.x, swimmer.z, shrunk.environment),
    );
  });
  it("defaults old saves to the existing tank and round trips a taller tank", () => {
    const world = emptyWorld();
    const { height: _, ...legacy } = world.environment;
    expect(
      parseWorld(JSON.stringify({ ...world, environment: legacy })).environment
        .height,
    ).toBe(2.9);
    const taller = withEnvironment(world, { height: 5, water: 4.75 });
    expect(parseWorld(JSON.stringify(taller))).toEqual(taller);
    expect(() =>
      parseWorld(
        JSON.stringify({
          ...taller,
          environment: { ...taller.environment, water: 5 },
        }),
      ),
    ).toThrow();
  });
  it("sculpts to just below the rim, including above the old fixed ceiling", () => {
    let env = { ...emptyWorld().environment, height: 5 };
    for (let i = 0; i < 200; i++)
      env = applyTerrainBrush(env, SPOT.x, SPOT.z, {
        mode: "raise",
        radius: 0.65,
      });
    expect(groundHeight(SPOT.x, SPOT.z, env)).toBeCloseTo(
      groundCeiling(env),
      3,
    );
    expect(
      parseWorld(JSON.stringify({ ...emptyWorld(), environment: env }))
        .environment,
    ).toEqual(env);
  });
  it("trims terrain and water when shrinking, carries a stack, and undoes the whole adjustment", () => {
    const original = emptyWorld();
    original.environment.height = 5;
    original.environment.water = 4.75;
    for (let i = 0; i < 200; i++)
      original.environment = applyTerrainBrush(
        original.environment,
        SPOT.x,
        SPOT.z,
        {
          mode: "raise",
          radius: 0.65,
        },
      );
    const rock: HabitatObject = {
      id: "rock",
      kind: "rock",
      x: SPOT.x,
      z: SPOT.z,
      rotation: 0,
      scale: 1,
      seed: 1,
    };
    const plant: HabitatObject = {
      ...rock,
      id: "plant",
      kind: "monstera",
      support: "rock",
      lift: 0.6,
    };
    original.objects = [rock, plant];
    const shrunk = withEnvironment(original, { height: 1.5 });
    expect(shrunk.environment.water).toBe(waterCeiling(shrunk.environment));
    expect(groundHeight(rock.x, rock.z, shrunk.environment)).toBeCloseTo(
      groundCeiling(shrunk.environment),
      3,
    );
    const before =
      objectBase(plant, original.environment) -
      objectBase(rock, original.environment);
    expect(
      objectBase(shrunk.objects[1], shrunk.environment) -
        objectBase(shrunk.objects[0], shrunk.environment),
    ).toBeCloseTo(before);
    expect(objectBase(shrunk.objects[1], shrunk.environment)).toBeGreaterThan(
      shrunk.environment.height,
    );
    const raisedAgain = withEnvironment(shrunk, { height: 5 });
    expect(groundHeight(rock.x, rock.z, raisedAgain.environment)).toBeCloseTo(
      groundHeight(rock.x, rock.z, shrunk.environment),
      3,
    );
    const history = historyReducer(
      { past: [], present: original, future: [] },
      { type: "commit", world: shrunk },
    );
    expect(historyReducer(history, { type: "undo" }).present).toEqual(original);
    expect(parseWorld(JSON.stringify(shrunk))).toEqual(shrunk);
  });
  it("recognizes a dry island above full water and hides dry habitat only when none remains", () => {
    const env = { ...emptyWorld().environment, height: 5, water: 4.75 };
    expect(hasDryGround(env)).toBe(false);
    const terrain = newTerrain(env, () => 4.5);
    expect(hasDryGround({ ...env, terrain })).toBe(true);
  });
});
