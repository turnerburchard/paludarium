import { describe, expect, it } from "vitest";
import { Ecosystem } from "../src/simulation/engine";
import { HabitatGraph } from "../src/simulation/navigation";
import {
  buildHabitat,
  createWorldEcosystem,
  insectColonies,
} from "../src/simulation/worldHabitat";
import { emptyWorld } from "../src/model/schema";
import { makePreset } from "../src/model/presets";
import type { AssetKind } from "../src/model/schema";
import { assets, plantPerches } from "../src/assets";
import { transformPlantPoint } from "../src/model/plantSurfaces";
import { groundHeight } from "../src/model/terrain";
import type {
  AnimalSeed,
  HabitatNode,
  SpeciesProfile,
} from "../src/simulation/types";

function frogProfile(kind: AssetKind): SpeciesProfile {
  const behavior = assets[kind].behavior;
  if (!behavior) throw new Error("Expected a frog species.");
  return { id: kind, ...behavior };
}

const species: SpeciesProfile = {
  id: "test-frog",
  nocturnal: false,
  climbs: false,
  speed: 0.2,
};
function node(
  id: string,
  x: number,
  neighbors: string[],
  extra: Partial<HabitatNode> = {},
): HabitatNode {
  return {
    id,
    position: { x, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    surface: "ground",
    wet: false,
    shelter: 0,
    neighbors,
    ...extra,
  };
}
function seed(
  id = "frog",
  needs = { hunger: 0.8, hydration: 0.8, energy: 0.8 },
): AnimalSeed {
  // Facing along the test routes, so arrivals don't wait on a turn.
  return { id, species, nodeId: "a", needs, direction: { x: 1, y: 0, z: 0 } };
}
function run(engine: Ecosystem, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) engine.advance(0.1);
}

describe("live ecosystem behavior", () => {
  it("reaches food along a connected route and consumes a finite supply", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.2, ["a", "c"]),
      node("c", 0.4, ["b"]),
    ]);
    const engine = new Ecosystem(graph, [seed()], {
      speed: 1,
      elapsed: 0,
      random: () => 0.5,
      food: [{ nodeId: "c", amount: 5, capacity: 0 }],
    });
    run(engine, 1);
    expect(engine.getAnimal("frog")!.activity).toBe("seeking-food");
    expect(engine.getAnimal("frog")!.position.x).toBeGreaterThan(0);
    expect(engine.getAnimal("frog")!.position.x).toBeLessThan(0.4);
    run(engine, 12);
    expect(engine.getAnimal("frog")!.needs.hunger).toBeLessThan(0.5);
    expect(engine.snapshot().food[0].amount).toBeLessThan(5);
    expect(engine.snapshot().food[0].amount).toBeGreaterThanOrEqual(0);
  });
  it("cannot eat food in disconnected space or on an inaccessible glass surface", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["wall"]),
      node("wall", 0.2, ["a"], { surface: "glass" }),
      node("island", 4, []),
    ]);
    const engine = new Ecosystem(graph, [seed()], {
      speed: 1,
      elapsed: 0,
      random: () => 0.5,
      food: [
        { nodeId: "wall", amount: 3, capacity: 0 },
        { nodeId: "island", amount: 4, capacity: 0 },
      ],
    });
    run(engine, 30);
    expect(engine.snapshot().food.map((f) => f.amount)).toEqual([3, 4]);
    expect(engine.getAnimal("frog")!.nodeId).toBe("a");
    expect(engine.getAnimal("frog")!.reason).toContain(
      "No insects within reach",
    );
  });
  it("allows a climbing species onto a connected wall", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["wall"]),
      node("wall", 0, ["a"], {
        surface: "glass",
        position: { x: 0, y: 0.2, z: 0 },
        normal: { x: 1, y: 0, z: 0 },
      }),
    ]);
    const animal = { ...seed(), species: { ...species, climbs: true } };
    const engine = new Ecosystem(graph, [animal], {
      speed: 1,
      elapsed: 0,
      food: [{ nodeId: "wall", amount: 5, capacity: 0 }],
    });
    run(engine, 3);
    expect(engine.getAnimal("frog")!.nodeId).toBe("wall");
    expect(engine.getAnimal("frog")!.normal).toEqual({ x: 1, y: 0, z: 0 });
    expect(engine.getAnimal("frog")!.activity).toBe("eating");
  });
  it("prioritizes hydration and soaks at a reachable wet node", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["shore"]),
      node("shore", 0.2, ["a"], { wet: true }),
    ]);
    const engine = new Ecosystem(
      graph,
      [seed("frog", { hunger: 0.8, hydration: 0.1, energy: 0.8 })],
      { speed: 1, elapsed: 0, food: [{ nodeId: "a", amount: 5, capacity: 0 }] },
    );
    run(engine, 12);
    expect(engine.getAnimal("frog")!.activity).toBe("bathing");
    expect(engine.getAnimal("frog")!.needs.hydration).toBeGreaterThan(0.4);
    expect(engine.snapshot().food[0].amount).toBe(5);
  });
  it("waits beside a busy shoreline for its turn", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.2, ["a", "shore"]),
      node("shore", 0.4, ["b"], { wet: true }),
    ]);
    const thirsty = { hunger: 0.1, hydration: 0.1, energy: 0.8 };
    const engine = new Ecosystem(
      graph,
      [
        { ...seed("soaking", thirsty), nodeId: "shore" },
        seed("waiting", thirsty),
      ],
      { speed: 1, elapsed: 0, random: () => 0.5 },
    );
    run(engine, 3);
    expect(engine.getAnimal("soaking")!.activity).toBe("bathing");
    expect(engine.getAnimal("waiting")!.nodeId).toBe("b");
    expect(engine.getAnimal("waiting")!.reason).toBe(
      "Waiting for a turn at the water",
    );
    run(engine, 60);
    expect(engine.getAnimal("waiting")!.needs.hydration).toBeGreaterThan(0.4);
  });
  it("sets off for distant water early enough to arrive before drying out", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 1.5, ["a", "shore"]),
      node("shore", 3, ["b"], { wet: true }),
    ]);
    const needs = { hunger: 0.1, hydration: 0.5, energy: 0.8 };
    const animal = (speed: number) => {
      const engine = new Ecosystem(
        graph,
        [{ ...seed("frog", needs), species: { ...species, speed } }],
        { speed: 1, elapsed: 0, random: () => 0.5 },
      );
      run(engine, 1);
      return engine.getAnimal("frog")!.activity;
    };
    expect(animal(0.012)).toBe("seeking-water");
    expect(animal(0.2)).not.toBe("seeking-water");
  });
  it("dries out more slowly under cover", () => {
    const loss = (shelter: number) => {
      const graph = new HabitatGraph([node("a", 0, [], { shelter })]);
      const engine = new Ecosystem(graph, [seed()], { speed: 1, elapsed: 0 });
      run(engine, 100);
      return 0.8 - engine.getAnimal("frog")!.needs.hydration;
    };
    expect(loss(1)).toBeCloseTo(loss(0) * 0.4, 6);
  });
  it("spends the same energy on a walk however slowly it goes", () => {
    const walk = (speed: number) => {
      const graph = new HabitatGraph([
        node("a", 0, ["b"]),
        node("b", 1, ["a"]),
      ]);
      const engine = new Ecosystem(
        graph,
        [{ ...seed(), species: { ...species, speed } }],
        {
          speed: 1,
          elapsed: 0,
          food: [{ nodeId: "b", amount: 5, capacity: 0 }],
        },
      );
      let seconds = 0;
      while (engine.getAnimal("frog")!.nodeId !== "b") {
        run(engine, 0.1);
        seconds += 0.1;
      }
      // Leave out what any waking second costs.
      return 0.8 - engine.getAnimal("frog")!.needs.energy - seconds * 0.0007;
    };
    // Starting and stopping blur the comparison a little.
    expect(walk(0.05)).toBeCloseTo(walk(0.2), 2);
  });
  it("stays in its shelter once settled rather than shuffling between spots", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"], { shelter: 1 }),
      node("b", 0.2, ["a"], { shelter: 1 }),
    ]);
    // Each decision rolls high for the other shelter.
    let flip = 0.99;
    const engine = new Ecosystem(
      graph,
      [{ ...seed(), species: { ...species, nocturnal: true } }],
      { speed: 1, elapsed: 0, random: () => (flip = 0.99 - flip) },
    );
    for (let i = 0; i < 300; i++) {
      run(engine, 1);
      expect(engine.getAnimal("frog")!.nodeId).toBe("a");
    }
  });
  it("rests nocturnal frogs during day and diurnal frogs during night", () => {
    const graph = new HabitatGraph([node("a", 0, [], { shelter: 1 })]);
    const animal = seed("frog", { hunger: 0.1, hydration: 0.8, energy: 0.7 });
    const nightAnimal = { ...animal, species: { ...species, nocturnal: true } };
    for (const [input, elapsed] of [
      [nightAnimal, 0],
      [animal, 1000],
    ] as const) {
      const engine = new Ecosystem(graph, [input], { speed: 1, elapsed });
      run(engine, 1);
      expect(engine.getAnimal("frog")!.activity).toBe("sleeping");
      expect(engine.getAnimal("frog")!.needs.energy).toBeGreaterThan(0.7);
    }
  });
  it("does not duplicate the last bite when multiple animals compete", () => {
    const graph = new HabitatGraph([node("a", 0, [])]);
    const engine = new Ecosystem(graph, [seed("first"), seed("second")], {
      speed: 1,
      elapsed: 0,
      random: () => 0.5,
      food: [{ nodeId: "a", amount: 1, capacity: 0 }],
    });
    run(engine, 10);
    const remaining = engine.snapshot().food[0].amount;
    expect(remaining).toBe(0);
    const fullnessGain = engine
      .snapshot()
      .animals.reduce((sum, a) => sum + (0.8 + 0.002 * 10 - a.needs.hunger), 0);
    expect(fullnessGain).toBeCloseTo(0.2, 6);
  });
  it("walks past a nearly empty colony to one worth a meal", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.3, ["a", "c"]),
      node("c", 0.6, ["b"]),
    ]);
    const engine = new Ecosystem(graph, [seed()], {
      speed: 1,
      elapsed: 0,
      food: [
        { nodeId: "b", amount: 0.1, capacity: 0 },
        { nodeId: "c", amount: 3, capacity: 0 },
      ],
    });
    for (let step = 0; step < 100; step++) {
      engine.advance(0.1);
      const frog = engine.getAnimal("frog")!;
      expect(frog.activity === "eating" && frog.nodeId === "b").toBe(false);
    }
    expect(engine.getAnimal("frog")!.nodeId).toBe("c");
  });
  it("keeps a grazer fed without insects", () => {
    const graph = new HabitatGraph([node("a", 0, [])]);
    const engine = new Ecosystem(
      graph,
      [{ ...seed(), species: frogProfile("snail") }],
      { speed: 1, elapsed: 0 },
    );
    const before = engine.getAnimal("frog")!.needs.hunger;
    run(engine, 600);
    expect(engine.getAnimal("frog")!.needs.hunger).toBe(before);
  });
  it("never sends two frogs to the same spot", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.3, ["a", "c"], { shelter: 1 }),
      node("c", 0.6, ["b"]),
    ]);
    const sleepy = { ...species, nocturnal: true };
    const engine = new Ecosystem(
      graph,
      [
        { ...seed("one"), species: sleepy, nodeId: "a" },
        { ...seed("two"), species: sleepy, nodeId: "c" },
      ],
      { speed: 1, elapsed: 100 },
    );
    run(engine, 20);
    const spots = engine.snapshot().animals.map((animal) => animal.nodeId);
    expect(spots).toContain("b");
    expect(new Set(spots).size).toBe(2);
  });
  it("pauses completely and caps background-sized deltas", () => {
    const graph = new HabitatGraph([node("a", 0, [])]);
    const engine = new Ecosystem(graph, [seed()], {
      speed: 6,
      elapsed: 0,
      random: () => 0.5,
    });
    const before = engine.snapshot();
    engine.advance(3600, true);
    expect(engine.snapshot()).toEqual(before);
    engine.advance(3600);
    expect(engine.snapshot().elapsed).toBeCloseTo(1.5);
    const held = engine.getAnimal("frog");
    engine.advance(0.1, false, new Set(["frog"]));
    expect(engine.getAnimal("frog")).toEqual(held);
  });
  it("rejects invalid input and returns snapshots that cannot mutate live state", () => {
    const engine = new Ecosystem(
      new HabitatGraph([node("a", 0, [])]),
      [seed()],
      { random: () => 0.5 },
    );
    expect(() => engine.advance(NaN)).toThrow();
    expect(() => engine.addFood("a", -1)).toThrow();
    expect(() => new HabitatGraph([node("a", 0, ["missing"])])).toThrow();
    const snapshot = engine.snapshot();
    snapshot.animals[0].needs.hunger = 0;
    expect(engine.getAnimal("frog")!.needs.hunger).toBe(0.8);
  });
  it("preserves needs and consumed food through ordinary habitat edits", () => {
    const world = makePreset("tropical"),
      engine = createWorldEcosystem(world);
    run(engine, 10);
    const before = engine.snapshot();
    const edited = structuredClone(world);
    edited.environment.warmth = 0.2;
    const after = createWorldEcosystem(edited, { world, engine }).snapshot();
    expect(after.animals.map((a) => a.needs)).toEqual(
      before.animals.map((a) => a.needs),
    );
    expect(after.food.reduce((s, f) => s + f.amount, 0)).toBeCloseTo(
      before.food.reduce((s, f) => s + f.amount, 0),
    );
    expect(after.elapsed).toBe(before.elapsed);
  });
  it("builds finite connected surfaces for preset tanks without entering deep water", () => {
    const world = makePreset("tropical"),
      graph = buildHabitat(world);
    expect(graph.nodes.size).toBeGreaterThan(50);
    for (const node of graph.nodes.values())
      for (const id of node.neighbors)
        expect(graph.node(id).neighbors).toContain(node.id);
    const engine = createWorldEcosystem(world);
    run(engine, 90);
    for (const animal of engine.snapshot().animals) {
      expect(Object.values(animal.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(animal.needs).every((n) => n >= 0 && n <= 1)).toBe(
        true,
      );
    }
  });
  it.each(["tropical", "mountain", "grotto", "desert"] as const)(
    "lets every animal in the %s preset reach an insect colony",
    (preset) => {
      const engine = createWorldEcosystem(makePreset(preset));
      const colonies = new Set(engine.snapshot().food.map((p) => p.nodeId));
      for (const animal of engine.snapshot().animals) {
        const paths = engine.graph.paths(
          animal.nodeId,
          frogProfile(animal.speciesId as AssetKind),
        );
        expect([...paths.keys()].some((id) => colonies.has(id))).toBe(true);
      }
    },
  );
});

describe("insect colonies", () => {
  const graph = new HabitatGraph([node("a", 0, [])]);
  const insects = (engine: Ecosystem) => engine.snapshot().food[0].amount;

  it("breed back toward capacity and stop there", () => {
    const engine = new Ecosystem(graph, [], {
      speed: 1,
      food: [{ nodeId: "a", amount: 1, capacity: 4 }],
    });
    run(engine, 60);
    const grown = insects(engine);
    expect(grown).toBeGreaterThan(1);
    run(engine, 3000);
    expect(insects(engine)).toBeCloseTo(4, 1);
    expect(insects(engine)).toBeLessThanOrEqual(4);
  });

  it("recover slowly after being eaten out", () => {
    const engine = new Ecosystem(graph, [], {
      speed: 1,
      food: [{ nodeId: "a", amount: 0, capacity: 4 }],
    });
    run(engine, 600);
    expect(insects(engine)).toBeGreaterThan(0.2);
  });

  it("leave scattered insects as they are", () => {
    const engine = new Ecosystem(graph, [], {
      speed: 1,
      food: [{ nodeId: "a", amount: 2, capacity: 0 }],
    });
    run(engine, 600);
    expect(insects(engine)).toBe(2);
  });

  it("follow plant cover: none in a bare tank, several in a planted one", () => {
    expect(insectColonies(buildHabitat(emptyWorld()))).toEqual([]);
    const planted = insectColonies(buildHabitat(makePreset("tropical")));
    expect(planted.length).toBeGreaterThan(1);
    for (const colony of planted) expect(colony.capacity).toBeGreaterThan(1);
  });

  it("start full in a new habitat", () => {
    const food = createWorldEcosystem(makePreset("tropical")).snapshot().food;
    expect(food.length).toBeGreaterThan(1);
    for (const patch of food) expect(patch.amount).toBe(patch.capacity);
  });

  // This covers six simulated hours; allow for concurrent CI workers.
  it("can keep a frog fed without help in a planted tank", () => {
    const engine = createWorldEcosystem(makePreset("mountain"));
    run(engine, 3600);
    const frogs = engine
      .snapshot()
      .animals.filter((animal) => animal.speciesId === "canyon-tree-frog");
    expect(frogs).toHaveLength(1);
    expect(frogs[0].needs.hunger).toBeLessThan(0.8);
  }, 20_000);
});

describe("preset habitats", () => {
  it("let every land animal reach the water", () => {
    for (const preset of [
      "tropical",
      "mountain",
      "grotto",
      "desert",
    ] as const) {
      const engine = createWorldEcosystem(makePreset(preset));
      for (const animal of engine.snapshot().animals) {
        const routes = engine.graph.paths(
          animal.nodeId,
          frogProfile(animal.speciesId as AssetKind),
        );
        const shore = [...routes.keys()].filter(
          (id) => engine.graph.node(id).wet,
        );
        expect(shore, `${preset} ${animal.speciesId}`).not.toHaveLength(0);
      }
    }
  });
});

describe("insects across edits", () => {
  it("keep breeding in colonies after an edit moves where colonies sit", () => {
    const world = makePreset("tropical");
    const engine = createWorldEcosystem(world);
    run(engine, 10);
    const breeding = (food: { amount: number; capacity: number }[]) =>
      food
        .filter((patch) => patch.capacity > 0)
        .reduce((sum, patch) => sum + patch.amount, 0);
    const before = breeding(engine.snapshot().food);
    // Widening the tank shifts the habitat grid, and with it every colony spot.
    const edited = structuredClone(world);
    edited.environment.width += 0.5;
    const after = createWorldEcosystem(edited, { world, engine });
    expect(breeding(after.snapshot().food)).toBeGreaterThan(before * 0.8);
  });
});

describe("plant perches and species movement", () => {
  const plantWorld = () => {
    const world = emptyWorld();
    world.objects = [
      {
        id: "plant",
        kind: "monstera",
        x: -1.7,
        z: 0,
        rotation: 0.7,
        scale: 0.85,
        seed: 173,
      },
      {
        id: "frog",
        kind: "tree-frog",
        x: -1.5,
        z: 0,
        rotation: 0,
        scale: 1,
        seed: 1,
      },
    ];
    return world;
  };
  it.each([
    "monstera",
    "swiss-cheese-plant",
    "bromeliad",
    "fern",
    "anthurium",
    "philodendron",
    "nest-fern",
  ] as const)(
    "connects %s foliage to ground and seats perches on the transformed plant",
    (kind) => {
      const world = plantWorld();
      world.objects[0].kind = kind;
      const plant = world.objects[0];
      const graph = buildHabitat(world);
      const leaves = [...graph.nodes.values()].filter(
        (n) => n.surface === "leaf",
      );
      expect(leaves.length).toBeGreaterThan(0);
      const expected = transformPlantPoint(
        plantPerches(plant)[0].perch,
        plant,
        groundHeight(plant.x, plant.z, world.environment),
      );
      expect(leaves[0].position).toEqual(expected);
      const start = graph.nearest(
        { x: -1.5, y: groundHeight(-1.5, 0, world.environment), z: 0 },
        frogProfile("dart-frog"),
      )!;
      const treePaths = graph.paths(start.id, frogProfile("tree-frog"));
      const dartPaths = graph.paths(start.id, frogProfile("dart-frog"));
      expect(leaves.every((leaf) => treePaths.has(leaf.id))).toBe(true);
      expect(leaves.every((leaf) => !dartPaths.has(leaf.id))).toBe(true);
      for (const node of graph.nodes.values())
        for (const neighbor of node.neighbors)
          expect(graph.node(neighbor).neighbors).toContain(node.id);
    },
  );
  it("lets every frog walk up a gently leaning branch", () => {
    const world = plantWorld();
    world.objects[0] = { ...world.objects[0], kind: "branch", scale: 1 };
    const graph = buildHabitat(world);
    const bark = [...graph.nodes.values()].filter((n) => n.surface === "bark");
    const lookout = bark.find((n) => n.id.startsWith("bark:"))!;
    expect(lookout.perchHeight).toBeGreaterThan(0.5);
    const start = graph.nearest(
      { x: -1.5, y: groundHeight(-1.5, 0, world.environment), z: 0 },
      frogProfile("dart-frog"),
    )!;
    expect(
      graph.paths(start.id, frogProfile("dart-frog")).has(lookout.id),
    ).toBe(true);
    // Mossy frogs keep to low perches, so they stop partway up.
    const mossy = graph.paths(start.id, frogProfile("mossy-frog"));
    expect(mossy.has(lookout.id)).toBe(false);
    expect(bark.some((n) => mossy.has(n.id))).toBe(true);
  });
  it.each(["log", "rock-shelter"] as const)(
    "shelters any frog inside a %s, reached through its entrance",
    (kind) => {
      const world = plantWorld();
      world.objects[0] = { ...world.objects[0], kind };
      const graph = buildHabitat(world);
      const inside = graph.node("den:plant:0:inside");
      expect(inside.shelter).toBe(1);
      const start = graph.nearest(
        { x: 0, y: groundHeight(0, 0, world.environment), z: 0 },
        frogProfile("dart-frog"),
      )!;
      const path = graph
        .paths(start.id, frogProfile("dart-frog"))
        .get(inside.id);
      expect(path?.at(-2)).toBe("den:plant:0:entrance");
      expect(insectColonies(graph).some((c) => c.nodeId === inside.id)).toBe(
        true,
      );
    },
  );
  it("chooses a leaf for daytime sleep and lands gracefully when its plant is removed", () => {
    const world = plantWorld(),
      graph = buildHabitat(world);
    const start = graph.nearest(
      { x: -1.5, y: groundHeight(-1.5, 0, world.environment), z: 0 },
      frogProfile("dart-frog"),
    )!;
    const engine = new Ecosystem(
      graph,
      [
        {
          id: "frog",
          species: frogProfile("tree-frog"),
          nodeId: start.id,
          needs: { hunger: 0.1, hydration: 0.9, energy: 0.8 },
        },
      ],
      { elapsed: 0, speed: 1, random: () => 0.5 },
    );
    run(engine, 65);
    const animal = engine.getAnimal("frog")!;
    expect(animal.surface).toBe("leaf");
    expect(animal.activity).toBe("sleeping");
    const removed = {
      ...world,
      objects: world.objects.filter((object) => object.id !== "plant"),
    };
    const dropped = createWorldEcosystem(removed, { world, engine }).getAnimal(
      "frog",
    )!;
    expect(dropped.surface).toBe("ground");
    expect(dropped.needs).toEqual(animal.needs);
    expect(dropped.position.y).toBeCloseTo(
      groundHeight(dropped.position.x, dropped.position.z, removed.environment),
    );
    const moved = structuredClone(world);
    moved.objects[0].x = -2.5;
    const rerouted = createWorldEcosystem(moved, { world, engine });
    run(rerouted, 20);
    expect(
      Object.values(rerouted.getAnimal("frog")!.position).every(
        Number.isFinite,
      ),
    ).toBe(true);
  });
  it("limits mossy frogs to low foliage and reserves leaf-to-leaf leaps for tree frogs", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["low"]),
      node("low", 0.1, ["a", "high", "other"], {
        surface: "leaf",
        perchHeight: 0.3,
      }),
      node("high", 0.2, ["low"], { surface: "leaf", perchHeight: 1.2 }),
      node("other", 0.3, ["low"], { surface: "leaf", perchHeight: 0.3 }),
    ]);
    expect(graph.allowed("low", frogProfile("mossy-frog"))).toBe(true);
    expect(graph.allowed("high", frogProfile("mossy-frog"))).toBe(false);
    expect(graph.paths("a", frogProfile("mossy-frog")).has("other")).toBe(
      false,
    );
    expect(graph.paths("a", frogProfile("tree-frog")).has("other")).toBe(true);
  });
  it("poses hops and crawls differently without redirecting or teleporting mid-edge", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.32, ["a"]),
    ]);
    const engines = (["dart-frog", "mossy-frog"] as const).map(
      (kind) =>
        new Ecosystem(
          graph,
          [{ ...seed(), species: { ...frogProfile(kind), speed: 0.04 } }],
          {
            speed: 1,
            elapsed: 1000,
            random: () => 0.5,
            food: [{ nodeId: "b", amount: 3, capacity: 0 }],
          },
        ),
    );
    let hopLift = 0,
      crawlLift = 0;
    const previous = [0, 0];
    for (let step = 0; step < 80; step++)
      engines.forEach((engine, index) => {
        engine.advance(0.1);
        if (step === 10) engine.addFood("a", 3);
        const animal = engine.getAnimal("frog")!;
        expect(animal.position.x).toBeGreaterThanOrEqual(previous[index]);
        expect(animal.position.x - previous[index]).toBeLessThan(
          index === 0 ? 0.025 : 0.009,
        );
        previous[index] = animal.position.x;
        if (index === 0) hopLift = Math.max(hopLift, animal.motion.lift);
        else crawlLift = Math.max(crawlLift, animal.motion.lift);
      });
    expect(hopLift).toBeGreaterThan(0.1);
    expect(crawlLift).toBe(0);
    for (const engine of engines)
      expect(engine.getAnimal("frog")!.nodeId).toBe("b");
  });
  it("lets a gecko dash between spots and rest on bark rather than open ground", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b", "c"]),
      node("b", 0.3, ["a"], { shelter: 0.5 }),
      node("c", -0.3, ["a"], { shelter: 0.5, surface: "bark" }),
    ]);
    const engine = new Ecosystem(
      graph,
      [{ ...seed(), species: frogProfile("gecko") }],
      { speed: 1, elapsed: 1000 },
    );
    const positions: number[] = [];
    for (let step = 0; step < 200; step++) {
      engine.advance(0.1);
      const gecko = engine.getAnimal("frog")!;
      expect(gecko.motion.hop).toBe(false);
      if (gecko.moving && gecko.motion.progress > 0)
        positions.push(Math.abs(gecko.position.x));
    }
    expect(engine.getAnimal("frog")!.nodeId).toBe("c");
    // Dashes start slowly: the first sample covers less than its share.
    expect(positions[0]).toBeLessThan(0.3 / positions.length);
  });
  it("turns in place before setting off away from where it faces", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.3, ["a"]),
    ]);
    const engine = new Ecosystem(
      graph,
      [{ ...seed(), direction: { x: -1, y: 0, z: 0 } }],
      {
        speed: 1,
        elapsed: 1000,
        food: [{ nodeId: "b", amount: 3, capacity: 0 }],
      },
    );
    // Facing the opposite way, it pivots on the spot through every
    // direction in between before it takes a step.
    let pivotSteps = 0;
    for (let step = 0; step < 200; step++) {
      engine.advance(0.1);
      const frog = engine.getAnimal("frog")!;
      if (frog.position.x > 0) break;
      if (Math.abs(frog.direction.x) < 0.9) pivotSteps++;
    }
    expect(pivotSteps).toBeGreaterThan(10);
    expect(engine.getAnimal("frog")!.position.x).toBeGreaterThan(0);
  });
  it("leaves a frog without reachable ground idle instead of creating a second behavior path", () => {
    const world = plantWorld();
    world.objects = world.objects.filter((object) => object.id === "frog");
    world.environment.substrate = 0.12;
    world.environment.water = 0.9;
    const engine = createWorldEcosystem(world);
    expect(engine.snapshot().animals).toEqual([]);
    run(engine, 20);
    expect(engine.snapshot().animals).toEqual([]);
  });
});

describe("field notebook", () => {
  it("records an actual meal after arriving, once, and owns its snapshot data", () => {
    const graph = new HabitatGraph([
      node("a", 0, ["b"]),
      node("b", 0.2, ["a"]),
    ]);
    const engine = new Ecosystem(graph, [seed()], {
      speed: 1,
      elapsed: 0,
      random: () => 0.5,
      food: [{ nodeId: "b", amount: 5, capacity: 5 }],
    });
    engine.advance(0.1);
    expect(engine.getAnimal("frog")!.activity).toBe("seeking-food");
    expect(engine.snapshot().discoveries).toEqual([]);
    run(engine, 10);
    expect(engine.snapshot().discoveries).toEqual([
      {
        kind: "hunt",
        animalId: "frog",
        speciesId: "test-frog",
        elapsed: expect.any(Number),
      },
    ]);
    const snapshot = engine.snapshot();
    snapshot.discoveries[0].animalId = "changed";
    run(engine, 10);
    expect(engine.snapshot().discoveries).toHaveLength(1);
    expect(engine.snapshot().discoveries[0].animalId).toBe("frog");
  });
  it("records shoreline soaking, but not while paused or held for editing", () => {
    const graph = new HabitatGraph([node("a", 0, [], { wet: true })]);
    const engine = new Ecosystem(
      graph,
      [seed("frog", { hunger: 0.2, hydration: 0.2, energy: 0.8 })],
      { speed: 1, elapsed: 0, random: () => 0.5 },
    );
    engine.advance(0.1, true);
    engine.advance(0.1, false, new Set(["frog"]));
    expect(engine.snapshot().discoveries).toEqual([]);
    engine.advance(0.1);
    expect(engine.snapshot().discoveries[0].kind).toBe("soak");
  });
  it("keeps discoveries across habitat edits and drops references to removed inhabitants", () => {
    const world = makePreset("tropical");
    const initial = createWorldEcosystem(world);
    const first = initial.snapshot().animals[0];
    const engine = new Ecosystem(
      initial.graph,
      [
        {
          id: first.id,
          species: frogProfile("tree-frog"),
          nodeId: first.nodeId,
          needs: { hunger: 0.8, hydration: 0.8, energy: 0.8 },
        },
      ],
      {
        speed: 1,
        elapsed: 0,
        random: () => 0.5,
        food: [{ nodeId: first.nodeId, amount: 5, capacity: 5 }],
      },
    );
    engine.advance(0.1);
    const notes = engine.snapshot().discoveries;
    expect(notes.length).toBeGreaterThan(0);
    const edited = { ...world, name: "A new name" };
    const next = createWorldEcosystem(edited, { world, engine });
    expect(next.snapshot().discoveries).toEqual(notes);
    const removed = {
      ...world,
      objects: world.objects.filter(
        (object) => !notes.some((note) => note.animalId === object.id),
      ),
    };
    expect(
      createWorldEcosystem(removed, { world, engine }).snapshot().discoveries,
    ).toEqual([]);
  });
});
