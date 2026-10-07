import { describe, expect, it } from "vitest";
import { catalog, isAnimal } from "../src/assets";
import {
  emptyWorld,
  type AssetKind,
  type HabitatObject,
  type World,
} from "../src/model/schema";
import { parseWorld } from "../src/editor/persistence";
import { makePreset } from "../src/model/presets";
import { historyReducer } from "../src/editor/history";
import {
  advanceLife,
  animalLife,
  habitatSupport,
  juvenileScale,
  MATURITY_AGE,
  BREEDING_INTERVAL,
} from "../src/simulation/lifeCycle";

function object(kind: AssetKind, id: string): HabitatObject {
  return { id, kind, x: -2, z: 0, rotation: 0, scale: 1, seed: 173 };
}
function habitat(kinds: AssetKind[], plants = 8): World {
  return {
    ...emptyWorld(),
    environment: { ...emptyWorld().environment, water: 0 },
    objects: [
      ...kinds.map((kind, i) => {
        const animal = object(kind, `animal-${i}`);
        return {
          ...animal,
          life: {
            ...animalLife(animal),
            age: MATURITY_AGE,
            breeding: BREEDING_INTERVAL,
          },
        };
      }),
      ...Array.from({ length: plants }, (_, i) =>
        object("java-fern", `plant-${i}`),
      ),
    ],
  };
}

describe("slow animal life cycles", () => {
  it("keeps starter habitats supported and excludes unsuitable planting", () => {
    for (const preset of [
      "tropical",
      "mountain",
      "desert",
      "grotto",
      "aquarium",
    ] as const) {
      const support = habitatSupport(makePreset(preset));
      expect(support.food, preset).toBe(1);
      expect(support.space, preset).toBe(1);
    }
    const world = habitat(["tree-frog"], 4);
    for (const plant of world.objects.slice(1)) plant.kind = "monstera";
    world.environment.water = 2.65;
    expect(habitatSupport(world).plants).toBe(0);
  });
  it.each(
    catalog.filter((asset) => isAnimal(asset.kind)).map((asset) => asset.kind),
  )("lets a healthy %s pair have a juvenile of their own species", (kind) => {
    const world = habitat([kind, kind]);
    const next = advanceLife(world, 5, () => 0.5);
    const animals = next.objects.filter((o) => isAnimal(o.kind));
    expect(animals).toHaveLength(3);
    expect(animals[2].kind).toBe(kind);
    expect(animals[2].life?.age).toBe(0);
    expect(juvenileScale(animals[2])).toBeLessThan(1);
    expect(new Set(animals.map((o) => o.id)).size).toBe(3);
    expect(world.objects).toHaveLength(10);
    expect(world.objects[0].life?.breeding).toBe(BREEDING_INTERVAL);
  });
  it("requires two mature animals of the same species", () => {
    expect(advanceLife(habitat(["tree-frog"]), 5).objects).toHaveLength(9);
    expect(
      advanceLife(habitat(["tree-frog", "dart-frog"]), 5).objects,
    ).toHaveLength(10);
    const world = habitat(["tree-frog", "tree-frog"]);
    world.objects[1].life!.age = 0;
    expect(advanceLife(world, 5).objects).toHaveLength(10);
  });
  it("does not breed in a bare or crowded tank", () => {
    expect(
      advanceLife(habitat(["tree-frog", "tree-frog"], 0), 5).objects,
    ).toHaveLength(2);
    const world = habitat(
      Array.from({ length: 100 }, () => "tree-frog"),
      200,
    );
    expect(advanceLife(world, 5).objects).toHaveLength(300);
    expect(habitatSupport(world).space).toBeLessThan(1);
  });
  it("gives shortages time to recover but eventually loses unsupported animals", () => {
    let world = habitat(["tree-frog"], 0);
    world = advanceLife(world, 60);
    expect(world.objects[0].life!.condition).toBeGreaterThan(0.9);
    const hungry = world.objects[0].life!.condition;
    world.objects.push(...habitat([], 4).objects);
    world = advanceLife(world, 60);
    expect(world.objects[0].life!.condition).toBeGreaterThan(hungry);
    world = habitat(["tree-frog"], 0);
    for (let i = 0; i < 2000 && world.objects.length; i++)
      world = advanceLife(world, 5);
    expect(world.objects).toHaveLength(0);
  });
  it("loses a stranded animal within minutes and keeps it from breeding", () => {
    let world = habitat(["tree-frog", "tree-frog"]);
    const stranded = new Set(["animal-0"]);
    world = advanceLife(world, 60, Math.random, stranded);
    const [frog, other] = world.objects;
    expect(frog.life!.condition).toBeLessThan(0.7);
    expect(frog.life!.breeding).toBe(0);
    expect(other.life!.condition).toBe(1);
    for (let i = 0; i < 30; i++)
      world = advanceLife(world, 5, Math.random, stranded);
    expect(world.objects.some((o) => o.id === "animal-0")).toBe(false);
    expect(world.objects.some((o) => o.id === "animal-1")).toBe(true);
  });
  it("ages juveniles into adults and removes an animal at the end of its life", () => {
    const world = habitat(["fish"]);
    world.objects[0].life!.age = MATURITY_AGE - 5;
    expect(juvenileScale(world.objects[0])).toBeLessThan(1);
    const mature = advanceLife(world, 5);
    expect(juvenileScale(mature.objects[0])).toBe(1);
    mature.objects[0].life!.age = mature.objects[0].life!.lifespan - 5;
    expect(
      advanceLife(mature, 5).objects.filter((o) => isAnimal(o.kind)),
    ).toHaveLength(0);
  });
  it("keeps life through save/import, leaves old saves valid, and validates life data", () => {
    const old = { ...emptyWorld(), objects: [object("tree-frog", "old")] };
    expect(parseWorld(JSON.stringify(old))).toEqual(old);
    const world = advanceLife(habitat(["fish"]), 5);
    expect(parseWorld(JSON.stringify(world)).objects[0].life).toEqual(
      world.objects[0].life,
    );
    world.objects[0].life!.condition = -1;
    expect(() => parseWorld(JSON.stringify(world))).toThrow();
  });
  it("ignores zero elapsed time and staggers the old age of placed animals", () => {
    const world = habitat(["tree-frog", "tree-frog"]);
    expect(advanceLife(world, 0)).toBe(world);
    const first = object("tree-frog", "a");
    const second = { ...first, seed: 346 };
    expect(animalLife(first)).toEqual(animalLife(first));
    expect(animalLife(first).lifespan - animalLife(first).age).not.toBe(
      animalLife(second).lifespan - animalLife(second).age,
    );
  });
  it("can sustain successive generations from a planted pair", () => {
    let world = habitat(["tree-frog", "tree-frog"], 4);
    for (let i = 0; i < 18_000; i++) world = advanceLife(world, 5, () => 0.5);
    const animals = world.objects.filter((o) => isAnimal(o.kind));
    expect(animals.length).toBeGreaterThanOrEqual(2);
    expect(animals.length).toBeLessThanOrEqual(4);
  });
});

describe("automatic life changes and editor history", () => {
  it("saves life without adding an undo step, and lets undo restore the earlier population", () => {
    const world = habitat(["tree-frog", "tree-frog"]);
    const initial = { past: [], present: emptyWorld(), future: [] };
    const built = historyReducer(initial, { type: "commit", world });
    const next = advanceLife(world, 5);
    const evolved = historyReducer(built, {
      type: "simulate",
      base: world,
      world: next,
    });
    expect(evolved.past).toEqual(built.past);
    expect(evolved.present).toBe(next);
    const undone = historyReducer(evolved, { type: "undo" });
    expect(undone.present).toEqual(initial.present);
    expect(historyReducer(undone, { type: "redo" }).present).toBe(next);
    expect(
      historyReducer(built, {
        type: "simulate",
        base: initial.present,
        world: next,
      }),
    ).toBe(built);
  });
});
