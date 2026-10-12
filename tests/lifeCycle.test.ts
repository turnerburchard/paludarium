import { describe, expect, it } from "vitest";
import { catalog, isAnimal } from "../src/assets";
import {
  emptyWorld,
  LOG_LENGTH,
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
  breed,
  habitatSupport,
  juvenileScale,
  killAnimal,
  MATURITY_AGE,
  BREEDING_INTERVAL,
  readyToBreed,
  withAnimalPositions,
} from "../src/simulation/lifeCycle";

const pair = [["animal-0", "animal-1"]] as const;

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
  it.each(["tree-frog", "fish"] as const)(
    "kills a %s once, saves the cause and supports Undo/Redo",
    (kind) => {
      const world = habitat([kind]);
      const killed = killAnimal(world, "animal-0", 2000);
      expect(killed.objects).toEqual(world.objects.slice(1));
      expect(killed.log).toEqual([
        { at: 2000, event: "died", kind, cause: "killed" },
      ]);
      expect(parseWorld(JSON.stringify(killed))).toEqual(killed);
      expect(killAnimal(killed, "animal-0")).toBe(killed);
      const edited = historyReducer(
        { past: [], present: world, future: [] },
        { type: "commit", world: killed },
      );
      const undone = historyReducer(edited, { type: "undo" });
      expect(undone.present).toBe(world);
      expect(historyReducer(undone, { type: "redo" }).present).toBe(killed);
      expect(world.objects[0].id).toBe("animal-0");
      expect(world.log).toBeUndefined();
    },
  );
  it("does not kill scenery or exceed the life log limit", () => {
    const world = habitat(["tree-frog"]);
    expect(killAnimal(world, "plant-0")).toBe(world);
    expect(killAnimal(world, "missing")).toBe(world);
    world.log = Array.from({ length: LOG_LENGTH }, (_, at) => ({
      at,
      event: "born",
      kind: "tree-frog",
    }));
    const killed = killAnimal(world, "animal-0", 2000);
    expect(killed.log).toHaveLength(LOG_LENGTH);
    expect(killed.log![0].at).toBe(1);
    expect(killed.log!.at(-1)?.cause).toBe("killed");
  });
  it("keeps starter habitats supported and excludes unsuitable planting", () => {
    for (const preset of [
      "tropical",
      "mountain",
      "desert",
      "grotto",
      "amazon",
      "island",
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
  )("lets a %s pair that met have a juvenile between them", (kind) => {
    const world = habitat([kind, kind]);
    world.objects[1].x = -1;
    const next = breed(world, pair, () => 0.5);
    const animals = next.objects.filter((o) => isAnimal(o.kind));
    expect(animals).toHaveLength(3);
    expect(animals[2].kind).toBe(kind);
    expect(animals[2]).toMatchObject({ x: -1.5, z: 0 });
    expect(animals[0].life?.breeding).toBe(0);
    expect(animals[1].life?.breeding).toBe(0);
    expect(animals[2].life?.age).toBe(0);
    expect(juvenileScale(animals[2])).toBeLessThan(1);
    expect(new Set(animals.map((o) => o.id)).size).toBe(3);
    expect(world.objects).toHaveLength(10);
    expect(world.objects[0].life?.breeding).toBe(BREEDING_INTERVAL);
  });
  it("waits for a pair to meet rather than breeding as time passes", () => {
    expect(
      advanceLife(habitat(["tree-frog", "tree-frog"]), 5).objects,
    ).toHaveLength(10);
  });
  it("requires two ready animals of the same species", () => {
    expect([...readyToBreed(habitat(["tree-frog", "tree-frog"]))]).toEqual([
      "animal-0",
      "animal-1",
    ]);
    const mixed = habitat(["tree-frog", "dart-frog"]);
    expect(breed(mixed, pair)).toBe(mixed);
    const young = habitat(["tree-frog", "tree-frog"]);
    young.objects[1].life!.age = 0;
    expect([...readyToBreed(young)]).toEqual(["animal-0"]);
    expect(breed(young, pair)).toBe(young);
    const resting = habitat(["tree-frog", "tree-frog"]);
    resting.objects[1].life!.breeding = BREEDING_INTERVAL - 5;
    expect(breed(resting, pair)).toBe(resting);
    expect(breed(resting, [["animal-0", "missing"]])).toBe(resting);
  });
  it("does not breed in a bare or crowded tank", () => {
    const bare = habitat(["tree-frog", "tree-frog"], 0);
    expect(readyToBreed(bare).size).toBe(0);
    expect(breed(bare, pair)).toBe(bare);
    const world = habitat(
      Array.from({ length: 100 }, () => "tree-frog"),
      200,
    );
    expect(readyToBreed(world).size).toBe(0);
    expect(breed(world, pair)).toBe(world);
    expect(habitatSupport(world).space).toBeLessThan(1);
    // Room for one juvenile, not two.
    const tight = habitat(
      Array.from({ length: 4 }, () => "tree-frog"),
      5,
    );
    const both = breed(tight, [
      ["animal-0", "animal-1"],
      ["animal-2", "animal-3"],
    ]);
    expect(both.objects.filter((o) => isAnimal(o.kind))).toHaveLength(5);
  });
  it("gives shortages time to recover but eventually loses unsupported animals", () => {
    let world = habitat(["tree-frog"], 0);
    world = advanceLife(world, 10);
    expect(world.objects[0].life!.condition).toBeGreaterThan(0.8);
    const hungry = world.objects[0].life!.condition;
    world.objects.push(...habitat([], 4).objects);
    world = advanceLife(world, 60);
    expect(world.objects[0].life!.condition).toBeGreaterThan(hungry);
    // A bare tank is empty within the minute.
    world = habitat(["tree-frog"], 0);
    for (let i = 0; i < 12; i++) world = advanceLife(world, 5);
    expect(world.objects).toHaveLength(0);
  });
  it("loses a stranded animal within minutes and keeps it from breeding", () => {
    let world = habitat(["tree-frog", "tree-frog"]);
    const stranded = new Set(["animal-0"]);
    world = advanceLife(world, 60, stranded);
    const [frog, other] = world.objects;
    expect(frog.life!.condition).toBeLessThan(0.7);
    expect(frog.life!.breeding).toBe(0);
    expect(other.life!.condition).toBe(1);
    for (let i = 0; i < 30; i++) world = advanceLife(world, 5, stranded);
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
  it("logs births and deaths with the cause of each death", () => {
    let world = habitat(["tree-frog", "tree-frog"]);
    world = breed(world, pair, () => 0.5, 1000);
    expect(world.log).toEqual([{ at: 1000, event: "born", kind: "tree-frog" }]);
    const deaths = (world: World, stranded = new Set<string>()) => {
      for (
        let i = 0;
        i < 3000 && world.objects.some((o) => isAnimal(o.kind));
        i++
      )
        world = advanceLife(world, 5, stranded, 2000);
      return world.log!.filter((entry) => entry.event === "died");
    };
    const old = habitat(["fish"]);
    old.objects[0].life!.age = old.objects[0].life!.lifespan - 5;
    expect(deaths(old)).toEqual([
      { at: 2000, event: "died", kind: "fish", cause: "age" },
    ]);
    expect(deaths(habitat(["tree-frog"], 0))[0].cause).toBe("starved");
    expect(deaths(habitat(["tree-frog"]), new Set(["animal-0"]))[0].cause).toBe(
      "drowned",
    );
    expect(deaths(habitat(["fish"]), new Set(["animal-0"]))[0].cause).toBe(
      "stranded",
    );
  });
  it("keeps only the most recent log entries", () => {
    const world = habitat(["fish"]);
    world.log = Array.from({ length: LOG_LENGTH }, (_, i) => ({
      at: i,
      event: "born" as const,
      kind: "fish" as const,
    }));
    world.objects[0].life!.age = world.objects[0].life!.lifespan;
    const next = advanceLife(world, 5, new Set(), 500);
    expect(next.log).toHaveLength(LOG_LENGTH);
    expect(next.log![0].at).toBe(1);
    expect(next.log!.at(-1)!.event).toBe("died");
    expect(parseWorld(JSON.stringify(next)).log).toEqual(next.log);
  });
  it("can sustain successive generations from a planted pair", () => {
    let world = habitat(["tree-frog", "tree-frog"], 4);
    for (let i = 0; i < 18_000; i++) {
      world = advanceLife(world, 5);
      // The first two ready meet straight away.
      const [a, b] = readyToBreed(world);
      if (b) world = breed(world, [[a, b]], () => 0.5);
    }
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

describe("animal positions", () => {
  it("records where animals have wandered, and only animals", () => {
    const world = habitat(["tree-frog"], 1);
    const moved = withAnimalPositions(world, () => ({ x: 1.23456, z: -0.5 }));
    expect(moved.objects[0]).toMatchObject({ x: 1.235, z: -0.5 });
    expect(moved.objects[1]).toBe(world.objects[1]);
  });

  it("keeps the same world when no one has moved", () => {
    const world = habitat(["tree-frog"], 1);
    expect(withAnimalPositions(world, () => ({ x: -2, z: 0 }))).toBe(world);
    expect(withAnimalPositions(world, () => undefined)).toBe(world);
  });
});
