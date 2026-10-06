import { describe, expect, it } from "vitest";
import { historyReducer, type History } from "../src/editor/history";
import { parseWorld } from "../src/editor/persistence";
import { emptyWorld, MAX_OBJECTS } from "../src/model/schema";
import { makePreset } from "../src/model/presets";
import {
  boundedPosition,
  groundHeight,
  placementProblem,
} from "../src/model/terrain";

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
  it.each(["tropical", "mountain"] as const)(
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

describe("lighting compatibility", () => {
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
