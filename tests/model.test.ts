import { describe, expect, it, vi } from "vitest";
import { historyReducer, type History } from "../src/editor/history";
import { parseWorld } from "../src/editor/persistence";
import {
  AQUARIUM_WATER,
  TANK_HEIGHT,
  emptyWorld,
  MAX_OBJECTS,
  type World,
} from "../src/model/schema";
import { makePreset } from "../src/model/presets";
import { placementProblem, swimmingHeight } from "../src/model/water";
import { boundedPosition, groundHeight } from "../src/model/terrain";
import { assets, buildAsset, disposeAsset } from "../src/assets";
import { Box3 } from "three";
import {
  terrainGrid,
  terrainPoint,
  terrainPointCount,
} from "../src/model/terrainData";

describe("editor history", () => {
  const initial: History = { past: [], present: emptyWorld(), future: [] };
  it("undoes and redoes a whole world replacement without mutating its source", () => {
    const tropical = makePreset("tropical");
    const changed = historyReducer(initial, {
      type: "commit",
      world: tropical,
    });
    const undone = historyReducer(changed, { type: "undo" });
    expect(undone.present).toEqual(initial.present);
    expect(historyReducer(undone, { type: "redo" }).present).toEqual(tropical);
    expect(initial.past).toHaveLength(0);
  });
  it("clears redo after an edit and ignores no-op edits", () => {
    const changed = historyReducer(initial, {
      type: "commit",
      world: makePreset("tropical"),
    });
    const undone = historyReducer(changed, { type: "undo" });
    const branched = historyReducer(undone, {
      type: "commit",
      world: makePreset("mountain"),
    });
    expect(branched.future).toHaveLength(0);
    expect(
      historyReducer(branched, {
        type: "commit",
        world: structuredClone(branched.present),
      }),
    ).toBe(branched);
  });
  it("bounds memory without dropping the current world", () => {
    let state = initial;
    for (let i = 0; i < 100; i++)
      state = historyReducer(state, {
        type: "commit",
        world: { ...emptyWorld(), name: `World ${i}` },
      });
    expect(state.past).toHaveLength(60);
    expect(state.present.name).toBe("World 99");
  });
});
describe("safe files and valid habitat", () => {
  it.each(["tropical", "mountain", "amazon", "grotto", "island"] as const)(
    "round trips the %s preset and places every inhabitant in its habitat",
    (preset) => {
      const world = makePreset(preset);
      expect(parseWorld(JSON.stringify(world))).toEqual(world);
      for (const object of world.objects)
        expect(
          placementProblem(object.kind, object.x, object.z, world.environment),
          `${object.kind} at ${object.x},${object.z}`,
        ).toBeNull();
    },
  );
  // Browsing a preset saves it, and one unreadable world locks the whole library.
  it.each([
    "empty",
    "tropical",
    "mountain",
    "desert",
    "grotto",
    "island",
    "amazon",
  ] as const)("reopens a saved copy of the %s preset", (preset) => {
    expect(() => parseWorld(JSON.stringify(makePreset(preset)))).not.toThrow();
  });
  it("creates distinct preset objects without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    try {
      const first = makePreset("tropical");
      const second = makePreset("tropical");
      const ids = [...first.objects, ...second.objects].map(
        (object) => object.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(parseWorld(JSON.stringify(first))).toEqual(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("gives every new preset its own objects, so life starts fresh", () => {
    const ids = (world: World) => world.objects.map((o) => o.id);
    const first = ids(makePreset("tropical"));
    for (const id of [
      ...ids(makePreset("tropical")),
      ...ids(makePreset("mountain")),
    ])
      expect(first).not.toContain(id);
  });
  it("explains files that aren't JSON at all", () => {
    expect(() => parseWorld("hello")).toThrow(
      "This file isn't a Paludarium terrarium.",
    );
  });
  it("rejects bad numbers, unsupported versions, duplicate IDs and excessive objects", () => {
    const world = makePreset("tropical");
    expect(() =>
      parseWorld(JSON.stringify({ ...world, version: 2 })),
    ).toThrow();
    expect(() =>
      parseWorld(
        JSON.stringify({
          ...world,
          environment: { ...world.environment, width: 100000 },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseWorld(
        JSON.stringify({
          ...world,
          objects: [world.objects[0], world.objects[0]],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseWorld(
        JSON.stringify({
          ...world,
          objects: Array.from({ length: MAX_OBJECTS + 1 }, (_, i) => ({
            ...world.objects[0],
            id: String(i),
          })),
        }),
      ),
    ).toThrow();
    expect(() => parseWorld("{bad json")).toThrow();
  });
  it("keeps imported object centers inside the tank", () => {
    const world = makePreset("tropical");
    world.objects[0].x = 9;
    const loaded = parseWorld(JSON.stringify(world));
    expect(loaded.objects[0].x).toBeLessThan(loaded.environment.width / 2);
  });
  it("distinguishes dry ground from usable water", () => {
    const env = emptyWorld().environment;
    expect(groundHeight(-2, 0, env)).toBeGreaterThan(env.water);
    expect(placementProblem("tree-frog", 2, 0, env)).toBeTruthy();
    expect(placementProblem("fish", 2, 0, env)).toBeNull();
    expect(placementProblem("fish", 2, 0, { ...env, water: 0 })).toBeTruthy();
    expect(boundedPosition(100, -100, env)).toEqual({ x: 3.15, z: -1.9 });
  });
});

describe("saved world compatibility", () => {
  it.each(["stone", "cork"])(
    "loads a saved %s backdrop world with its layout intact and clear glass",
    (material) => {
      const world = parseWorld(JSON.stringify(makePreset("tropical")));
      const legacy = {
        ...world,
        environment: {
          ...world.environment,
          backdrop: { material, moss: "sheet" },
        },
      };
      expect(parseWorld(JSON.stringify(legacy))).toEqual(world);
    },
  );
  it("loads older worlds with neutral lighting defaults", () => {
    const legacy = JSON.parse(JSON.stringify(emptyWorld()));
    delete legacy.environment.warmth;
    delete legacy.environment.brightness;
    const loaded = parseWorld(JSON.stringify(legacy));
    expect(loaded.environment.warmth).toBe(0.45);
    expect(loaded.environment.brightness).toBe(1);
  });
  it("preserves new species and lighting on round trip", () => {
    const world = emptyWorld();
    world.environment.warmth = 0.8;
    world.environment.brightness = 1.3;
    world.objects = ["blue-dart-frog", "mossy-frog"].map((kind, i) => ({
      id: String(i),
      kind: kind as "blue-dart-frog" | "mossy-frog",
      x: -1,
      z: 0,
      rotation: 0,
      scale: 1,
      seed: i,
    }));
    expect(parseWorld(JSON.stringify(world))).toEqual(world);
  });
});

describe("a fully submerged aquarium", () => {
  it("submerges the whole ground and hardscape without adding terrestrial inhabitants", () => {
    const world = makePreset("amazon");
    const env = world.environment;
    expect(env.water).toBe(AQUARIUM_WATER);
    expect(env.water).toBeLessThan(TANK_HEIGHT);
    for (let i = 0; i < terrainPointCount(terrainGrid(env)); i++) {
      const { x, z } = terrainPoint(i, env);
      expect(groundHeight(x, z, env)).toBeLessThan(env.water - 0.12);
      expect(placementProblem("fish", x, z, env)).toBeNull();
      expect(placementProblem("tree-frog", x, z, env)).toBeTruthy();
    }
    for (const object of world.objects) {
      expect(assets[object.kind].habitat).not.toBe("land");
      if (assets[object.kind].swims) continue;
      const model = buildAsset(object.kind, object.seed);
      const top = new Box3().setFromObject(model).max.y * object.scale;
      disposeAsset(model);
      expect(groundHeight(object.x, object.z, env) + top).toBeLessThan(
        env.water,
      );
    }
    expect(() =>
      parseWorld(
        JSON.stringify({
          ...world,
          environment: { ...env, water: TANK_HEIGHT },
        }),
      ),
    ).toThrow();
  });

  it("keeps depth ranges in ponds and spreads schools through deep water", () => {
    const pond = emptyWorld().environment;
    expect(swimmingHeight(2, 0, pond, [0.06, 0.2])).toBeCloseTo(
      Math.max(groundHeight(2, 0, pond) + 0.05, pond.water - 0.13),
    );
    const env = makePreset("amazon").environment;
    const shallowSwimmer = swimmingHeight(2, 0, env, [0.04, 0.16]);
    const deepSwimmer = swimmingHeight(2, 0, env, [0.16, 0.34]);
    expect(shallowSwimmer - deepSwimmer).toBeGreaterThan(0.5);
    expect(shallowSwimmer).toBeLessThan(env.water - 0.5);
    // Ranges past 0.4 reach the bottom of any depth of water.
    const ground = groundHeight(-2, 0, env);
    const bottom = swimmingHeight(-2, 0, env, [0.36, 1]);
    expect(bottom).toBeGreaterThan(ground + 0.05);
    expect(bottom).toBeLessThan(ground + 0.2);
  });
});
