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
import type {
  AnimalSeed,
  HabitatNode,
  SpeciesProfile,
} from "../src/simulation/types";

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
  return { id, species, nodeId: "a", needs };
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

  it("can keep a frog fed without help in a planted tank", () => {
    const engine = createWorldEcosystem(makePreset("mountain"));
    run(engine, 3600);
    const frogs = engine.snapshot().animals;
    expect(frogs).toHaveLength(1);
    expect(frogs[0].needs.hunger).toBeLessThan(0.8);
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
