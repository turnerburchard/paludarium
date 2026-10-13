import { describe, expect, it } from "vitest";
import { assets, catalog, isAnimal } from "../src/assets";
import {
  emptyWorld,
  LOG_LENGTH,
  type AssetKind,
  type HabitatObject,
  type World,
} from "../src/model/schema";
import { parseWorld } from "../src/editor/persistence";
import { makePreset } from "../src/model/presets";
import { baseGroundHeight, groundHeight } from "../src/model/terrain";
import { newTerrain } from "../src/model/terrainData";
import { waterMap } from "../src/model/water";
import { historyReducer } from "../src/editor/history";
import {
  animalLife,
  BREEDING_INTERVAL,
  juvenileScale,
  MATURITY_AGE,
  newBreedingInterval,
} from "../src/model/life";
import {
  advanceLife,
  breed,
  habitatSupport,
  killAnimal,
  readyToBreed,
  withAnimalPositions,
  withAnimalCourtships,
  youngAndParents,
} from "../src/simulation/lifeCycle";

const pair = [["animal-0", "animal-1"]] as const;

function object(kind: AssetKind, id: string): HabitatObject {
  return { id, kind, x: -2, z: 0, rotation: 0, scale: 1, seed: 173 };
}
function habitat(kinds: AssetKind[], plants = 8): World {
  return {
    ...emptyWorld(),
    environment: {
      ...emptyWorld().environment,
      water:
        kinds.length > 0 &&
        kinds.every((kind) => assets[kind].habitat === "water")
          ? 2.65
          : 0,
    },
    objects: [
      ...kinds.map((kind, i) => {
        const animal = object(kind, `animal-${i}`);
        return {
          ...animal,
          life: {
            ...animalLife(animal),
            age: MATURITY_AGE,
            breeding: BREEDING_INTERVAL,
            breedingTarget: BREEDING_INTERVAL,
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
  it("starts adults quickly and chooses a fresh four-to-eight-minute interval after birth", () => {
    const initial = animalLife(object("tree-frog", "new"));
    expect(initial.breedingTarget).toBeGreaterThanOrEqual(30);
    expect(initial.breedingTarget).toBeLessThanOrEqual(90);
    expect(newBreedingInterval(() => 0)).toBe(240);
    expect(newBreedingInterval(() => 1)).toBe(480);
    const world = breed(habitat(["tree-frog", "tree-frog"]), pair, () => 0.5);
    for (const parent of world.objects.slice(0, 2)) {
      expect(parent.life).toMatchObject({
        breeding: 0,
        breedingTarget: 360,
        breedingCooldown: 90,
      });
    }
    const reloaded = parseWorld(JSON.stringify(world));
    const cooling = advanceLife(reloaded, 60);
    expect(cooling.objects[0].life).toMatchObject({
      breeding: 0,
      breedingCooldown: 30,
    });
    const recovering = advanceLife(cooling, 40);
    expect(recovering.objects[0].life).toMatchObject({
      breeding: 10,
      breedingCooldown: 0,
    });
    expect(readyToBreed(recovering).size).toBe(0);
    const ready = advanceLife(recovering, 350);
    expect([...readyToBreed(ready)]).toContain("animal-0");
    const secondBirth = breed(ready, pair, () => 0.25);
    expect(secondBirth.objects[0].life).toMatchObject({
      breeding: 0,
      breedingTarget: 300,
      breedingCooldown: 75,
    });
  });

  it("erodes readiness at the same rate as recovery and keeps unhealthy animals from pairing", () => {
    const world = habitat(["tree-frog", "tree-frog"]);
    world.objects[0].life!.breeding = 100;
    const stranded = advanceLife(world, 10, new Set(["animal-0"]));
    expect(stranded.objects[0].life!.breeding).toBe(90);
    expect(advanceLife(stranded, 10).objects[0].life!.breeding).toBe(100);
    stranded.objects[0].life!.condition = 0.3;
    stranded.objects[0].life!.breeding = BREEDING_INTERVAL;
    expect(readyToBreed(stranded).has("animal-0")).toBe(false);
    stranded.objects[0].life!.breeding = 5;
    expect(advanceLife(stranded, 10).objects[0].life!.breeding).toBe(0);
  });

  it("round trips readiness, cooldown and pair progress without rejecting older saves", () => {
    const world = withAnimalCourtships(habitat(["tree-frog", "tree-frog"]), [
      { id: "animal-0", mate: "animal-1", together: 6, elapsed: 20 },
      { id: "animal-1", mate: "animal-0", together: 6, elapsed: 20 },
    ]);
    expect(parseWorld(JSON.stringify(world))).toEqual(world);
    const legacy = habitat(["tree-frog", "tree-frog"]);
    delete legacy.objects[0].life!.breedingTarget;
    delete legacy.objects[0].life!.breedingCooldown;
    expect(parseWorld(JSON.stringify(legacy))).toEqual(legacy);
    expect(readyToBreed(legacy).has("animal-0")).toBe(true);
    expect(
      withAnimalCourtships(world, []).objects[0].courtship,
    ).toBeUndefined();
  });

  it.each(["tree-frog", "fish"] as const)(
    "kills a %s once, saves the cause and supports Undo/Redo",
    (kind) => {
      const world = habitat([kind]);
      const killed = killAnimal(world, "animal-0", 2000);
      expect(killed.objects).toEqual(world.objects.slice(1));
      expect(killed.log).toEqual([
        { at: 2000, event: "died", kind, id: "animal-0", cause: "killed" },
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
  it.each([
    "tropical",
    "mountain",
    "desert",
    "grotto",
    "amazon",
    "island",
  ] as const)(
    "starts the %s preset with a juvenile and a pair soon ready to court",
    (preset) => {
      const world = makePreset(preset);
      expect(
        world.objects.some(
          (o) => isAnimal(o.kind) && animalLife(o).age < MATURITY_AGE,
        ),
      ).toBe(true);
      expect(readyToBreed(world).size).toBe(0);
      const ready = [...readyToBreed(advanceLife(world, 25))].map(
        (id) => world.objects.find((o) => o.id === id)!.kind,
      );
      expect(ready).toHaveLength(2);
      expect(ready[0]).toBe(ready[1]);
    },
  );
  it("does not let land planting feed aquatic animals or aquatic planting feed land animals", () => {
    for (const aquatic of [false, true]) {
      const world = habitat([aquatic ? "fish" : "tree-frog"], 3);
      world.objects[0].kind = aquatic ? "tree-frog" : "fish";
      const support = habitatSupport(world);
      expect(support.food).toBe(0);
      expect(readyToBreed(world).size).toBe(0);
      const next = advanceLife(world, 61);
      expect(next.objects.some((o) => isAnimal(o.kind))).toBe(false);
      expect(next.log?.at(-1)?.cause).toBe("starved");
    }
  });
  it("keeps an aquatic shortage from hurting land animals", () => {
    const world = habitat(["tree-frog"], 3);
    world.objects.push(object("fish", "hungry-fish"));
    const next = advanceLife(world, 61);
    expect(
      next.objects.filter((o) => isAnimal(o.kind)).map((o) => o.kind),
    ).toEqual(["tree-frog"]);
    expect(readyToBreed(world).has("animal-0")).toBe(true);
  });
  it.each(["duckweed", "dwarf-sagittaria", "anubias"] as const)(
    "counts %s touching shallow water as aquatic food",
    (kind) => {
      const world = habitat(["fish"], 0);
      const plant = object(kind, "plant");
      world.objects.push(plant);
      const ground = groundHeight(plant.x, plant.z, world.environment);
      for (const depth of [0, 0.02, 0.1]) {
        world.environment.water = ground + depth;
        expect(habitatSupport(world).aquatic.plants).toBe(1);
      }
      world.environment.water = ground - 0.02;
      const dry = habitatSupport(world);
      expect(dry.aquatic.plants).toBe(0);
      expect(dry.land.plants).toBe(kind === "anubias" ? 1 : 0);
    },
  );
  it("counts aquatic plants in running water above the tank's waterline", () => {
    const world = habitat(["fish"], 0);
    const env = {
      ...world.environment,
      water: 0.2,
      springs: [{ x: -0.4, z: 0, flow: 0.5 }],
    };
    world.environment = {
      ...env,
      terrain: newTerrain(
        env,
        (x, z) => 0.75 - 0.12 * x - baseGroundHeight(x, z, env),
      ),
    };
    const point = waterMap(world.environment).streams[0][2];
    expect(groundHeight(point.x, point.z, world.environment)).toBeGreaterThan(
      env.water,
    );
    world.objects.push({
      ...object("anubias", "stream-plant"),
      x: point.x,
      z: point.z,
    });
    expect(habitatSupport(world).aquatic.plants).toBe(1);
  });
  it.each(["aquatic food", "land food", "space"])(
    "staggers deaths from insufficient %s so the survivors recover",
    (shortage) => {
      const kind = shortage === "aquatic food" ? "fish" : "tree-frog";
      const population = shortage === "space" ? 18 : 4;
      const capacity = shortage === "space" ? 15 : 2;
      let world = habitat(
        Array.from({ length: population }, () => kind),
        shortage === "space" ? 20 : 2,
      );
      if (shortage === "space") {
        world.environment.width = 5;
        world.environment.depth = 3;
      }
      world.objects.slice(0, population).forEach((animal, i) => {
        animal.seed = i * 100_000_000;
      });
      const deathTimes = new Set<number>();
      for (let now = 5; now <= 1200; now += 5) {
        world = advanceLife(world, 5, new Set(), now);
        for (const entry of world.log ?? [])
          if (entry.event === "died") deathTimes.add(entry.at);
        if (now === 50) {
          const reloaded = parseWorld(JSON.stringify(world));
          expect(advanceLife(reloaded, 5)).toEqual(advanceLife(world, 5));
          world = reloaded;
        }
        if (world.objects.filter((o) => isAnimal(o.kind)).length <= capacity)
          break;
      }
      const survivors = world.objects.filter((o) => isAnimal(o.kind));
      expect(survivors).toHaveLength(capacity);
      expect(deathTimes.size).toBeGreaterThan(1);
      for (const entry of world.log ?? [])
        if (entry.event === "died")
          expect(entry.cause).toBe(
            shortage === "space" ? "crowded" : "starved",
          );
      const recovered = advanceLife(world, 5);
      survivors.forEach((animal) => {
        expect(
          recovered.objects.find((o) => o.id === animal.id)!.life!.condition,
        ).toBeGreaterThan(animal.life!.condition);
      });
      expect(
        advanceLife(recovered, 600).objects.filter((o) => isAnimal(o.kind)),
      ).toHaveLength(capacity);
    },
  );
  it("requires spare food in the parents' habitat for breeding", () => {
    const world = habitat(["fish", "fish"], 2);
    // Land plants provide spare total capacity, but cannot feed another fish.
    world.objects.push(
      ...Array.from({ length: 3 }, (_, i) => ({
        ...object("java-fern", `dry-${i}`),
        lift: 3,
      })),
    );
    expect(habitatSupport(world).plants).toBe(5);
    expect(habitatSupport(world).aquatic.food).toBe(1);
    expect(readyToBreed(world).size).toBe(0);
    expect(breed(world, pair)).toBe(world);
  });
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
      expect(support.aquatic.capacity, preset).toBeGreaterThanOrEqual(
        support.aquatic.population + 1,
      );
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
    expect(animals[2].parents).toEqual(["animal-0", "animal-1"]);
    expect(parseWorld(JSON.stringify(next))).toEqual(next);
    expect(youngAndParents(next)).toEqual(
      new Map([[animals[2].id, ["animal-0", "animal-1"]]]),
    );
    const orphan = killAnimal(next, "animal-0");
    expect(youngAndParents(orphan).get(animals[2].id)).toEqual(["animal-1"]);
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
  it("eventually starves every animal when there is no food", () => {
    let world = habitat(["fish", "fish", "fish", "fish"], 0);
    world.objects.forEach((animal, i) => {
      animal.seed = i * 100_000_000;
    });
    for (let now = 5; now <= 80; now += 5)
      world = advanceLife(world, 5, new Set(), now);
    expect(world.objects).toHaveLength(0);
    const deaths = world.log!.filter((entry) => entry.event === "died");
    expect(deaths).toHaveLength(4);
    expect(new Set(deaths.map((entry) => entry.at)).size).toBeGreaterThan(1);
    expect(deaths.every((entry) => entry.cause === "starved")).toBe(true);
  });
  it("loses a stranded animal within minutes and keeps it from breeding", () => {
    let world = habitat(["tree-frog", "tree-frog"]);
    const stranded = new Set(["animal-0"]);
    world = advanceLife(world, 60, stranded);
    const [frog, other] = world.objects;
    expect(frog.life!.condition).toBeLessThan(0.7);
    expect(frog.life!.breeding).toBe(BREEDING_INTERVAL - 60);
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
    expect(world.log).toEqual([
      {
        at: 1000,
        event: "born",
        kind: "tree-frog",
        id: world.objects.at(-1)!.id,
      },
    ]);
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
      { at: 2000, event: "died", kind: "fish", id: "animal-0", cause: "age" },
    ]);
    expect(deaths(habitat(["tree-frog"], 0))[0].cause).toBe("starved");
    expect(deaths(habitat(["tree-frog"]), new Set(["animal-0"]))[0].cause).toBe(
      "drowned",
    );
    expect(deaths(habitat(["fish"]), new Set(["animal-0"]))[0].cause).toBe(
      "stranded",
    );
  });
  it("logs growing up and growing old once each", () => {
    let world = habitat(["fish"]);
    const life = world.objects[0].life!;
    life.age = MATURITY_AGE - 5;
    life.lifespan = MATURITY_AGE * 2;
    for (let i = 0; i < 50; i++) world = advanceLife(world, 5, new Set(), 3000);
    expect(world.log).toEqual([
      { at: 3000, event: "grew-up", kind: "fish", id: "animal-0" },
      { at: 3000, event: "grew-old", kind: "fish", id: "animal-0" },
    ]);
    expect(parseWorld(JSON.stringify(world)).log).toEqual(world.log);
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
