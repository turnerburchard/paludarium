import { describe, expect, it, vi } from "vitest";
import { Ecosystem } from "../src/simulation/engine";
import { HabitatGraph } from "../src/simulation/navigation";
import type {
  AnimalSeed,
  HabitatNode,
  SpeciesProfile,
} from "../src/simulation/types";

const species: SpeciesProfile = {
  id: "frog",
  nocturnal: false,
  climbs: false,
  movement: "hop",
  speed: 0.04,
};
const node = (
  id: string,
  x: number,
  z: number,
  neighbors: string[],
): HabitatNode => ({
  id,
  position: { x, y: 0, z },
  normal: { x: 0, y: 1, z: 0 },
  surface: "ground",
  shelter: 0,
  wet: false,
  neighbors,
});
const seed = (profile = species): AnimalSeed => ({
  id: "frog",
  species: profile,
  nodeId: "a",
  direction: { x: 1, y: 0, z: 0 },
  needs: { hunger: 0.8, hydration: 0.9, energy: 0.9 },
});
const hopGraph = new HabitatGraph([
  node("a", 0, 0, ["b"]),
  node("b", 0.32, 0, ["a"]),
]);
const food = [{ nodeId: "b", amount: 5, capacity: 0 }];
function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe("animal movement", () => {
  it("keeps its backing direction while turning to leave a cramped spot", () => {
    const graph = new HabitatGraph([
      node("a", 0, 0, ["b"]),
      node("b", 0.32, 0, ["a"]),
    ]);
    vi.spyOn(graph, "canTurn").mockImplementation(
      (_node, facing, wanted) => wanted.x < 0 || facing.x < -0.5,
    );
    const animal = seed({ ...species, movement: "crawl", speed: 1 });
    animal.direction = { x: 0, y: 0, z: 1 };
    const engine = new Ecosystem(graph, [animal], {
      speed: 1,
      elapsed: 950,
      random: () => 0.5,
      food,
    });
    for (let i = 0; i < 80; i++) engine.advance(0.1);
    expect(engine.getAnimal("frog")!.nodeId).toBe("b");
    expect(engine.getAnimal("frog")!.needs.hunger).toBeLessThan(0.8);
  });

  it("rejects a transition that only fits while lifted above its landing spot", () => {
    const graph = new HabitatGraph(
      [
        { ...node("a", 0, 0, ["b"]), surface: "stone", supportId: "rock" },
        node("b", -0.32, 0, ["a"]),
      ],
      {
        groundPose: (position) => ({
          position: { ...position, y: 0 },
          normal: { x: 0, y: 1, z: 0 },
        }),
        aboveGround: (position, normal) => ({
          position: { ...position },
          normal: { ...normal },
        }),
        onSurface: (position, normal) => ({
          position: { ...position, y: 0.1 },
          normal: { ...normal },
        }),
        fits: (position, _normal, direction) =>
          position.y > 0.05 || direction.x > 0,
      },
    );
    const profile = {
      ...species,
      body: {
        min: { x: -0.01, y: 0, z: -0.01 },
        max: { x: 0.01, y: 0.01, z: 0.01 },
      },
    };
    expect(graph.canTravel(graph.node("a"), graph.node("b"), profile)).toBe(
      false,
    );
    expect(
      graph.canTravel(graph.node("a"), graph.node("b"), profile, false, true),
    ).toBe(true);
  });

  it("lands a short step facing the direction that passed clearance", () => {
    const geometry = {
      groundPose: (position: { x: number; y: number; z: number }) => ({
        position: { ...position },
        normal: { x: 0, y: 1, z: 0 },
      }),
      aboveGround: (
        position: { x: number; y: number; z: number },
        normal: { x: number; y: number; z: number },
      ) => ({ position: { ...position }, normal: { ...normal } }),
      fits: (
        position: { z: number },
        _normal: unknown,
        direction: { x: number; z: number },
      ) =>
        position.z > -0.0009 ||
        (direction.z < 0 && Math.abs(direction.x) < 0.001),
    };
    const graph = new HabitatGraph(
      [node("a", 0, 0, ["b"]), node("b", 0, -0.001, ["a"])],
      geometry,
    );
    const animal = seed({
      ...species,
      movement: "crawl",
      speed: 1,
      body: {
        min: { x: -0.01, y: 0, z: -0.01 },
        max: { x: 0.01, y: 0.01, z: 0.01 },
      },
    });
    animal.direction = { x: Math.sin(0.1), y: 0, z: -Math.cos(0.1) };
    const engine = new Ecosystem(graph, [animal], {
      speed: 1,
      elapsed: 950,
      random: () => 0.5,
      food,
    });
    engine.advance(0.1);
    const state = engine.getAnimal("frog")!;
    expect(state.nodeId).toBe("b");
    expect(geometry.fits(state.position, state.normal, state.direction)).toBe(
      true,
    );
  });
  it("backs out of a narrow passage instead of turning through its walls", () => {
    const corridor = new HabitatGraph(
      [node("a", 0, 0, ["b"]), { ...node("b", 0.32, 0, ["a"]), shelter: 1 }],
      {
        groundPose: (position, _direction, _body) => ({
          position: { ...position },
          normal: { x: 0, y: 1, z: 0 },
        }),
        aboveGround: (position, normal) => ({
          position: { ...position },
          normal: { ...normal },
        }),
        fits: (_position, _normal, direction) => Math.abs(direction.z) < 0.08,
      },
    );
    const animal = {
      ...seed({
        ...species,
        movement: "crawl",
        speed: 0.2,
        body: {
          min: { x: -0.05, y: 0, z: -0.2 },
          max: { x: 0.05, y: 0.1, z: 0.2 },
        },
      }),
      nodeId: "b",
    };
    const engine = new Ecosystem(corridor, [animal], {
      speed: 1,
      elapsed: 950,
      random: () => 0.5,
      food: [{ nodeId: "a", amount: 5, capacity: 0 }],
    });
    let moved = false;
    for (let i = 0; i < 200; i++) {
      engine.advance(0.1);
      const state = engine.getAnimal("frog")!;
      expect(state.direction.x).toBeGreaterThan(0.99);
      expect(Math.abs(state.direction.z)).toBeLessThan(0.08);
      if (state.position.x < 0.3) moved = true;
      if (state.nodeId === "a") break;
    }
    expect(moved).toBe(true);
    expect(engine.getAnimal("frog")!.nodeId).toBe("a");
  });

  it("does not abandon a route on an occupied shelter when no food is reachable", () => {
    const graph = new HabitatGraph([
      node("a", 0, 0, ["b"]),
      { ...node("b", 0.3, 0, ["a", "c"]), shelter: 1 },
      node("c", 0.6, 0, ["b"]),
    ]);
    const sleepy = {
      ...species,
      nocturnal: true,
      movement: undefined,
      speed: 0.2,
    };
    let passedShelter = false;
    for (let randomSeed = 1; randomSeed <= 32; randomSeed++) {
      const engine = new Ecosystem(
        graph,
        [
          { ...seed(sleepy), id: "one" },
          {
            ...seed(sleepy),
            id: "two",
            nodeId: "c",
            direction: { x: -1, y: 0, z: 0 },
          },
        ],
        { speed: 1, elapsed: 100, random: random(randomSeed) },
      );
      for (let i = 0; i < 200; i++) {
        engine.advance(0.1);
        const animals = engine.snapshot().animals;
        const resting = animals.filter((animal) => !animal.moving);
        expect(new Set(resting.map((animal) => animal.nodeId)).size).toBe(
          resting.length,
        );
        if (engine.getAnimal("two")!.nodeId === "b") passedShelter = true;
      }
    }
    expect(passedShelter).toBe(true);
  });
  it("hops in under half a real second, with steady forward flight and a quick landing", () => {
    // Slow crawling must not turn a jump into slow motion.
    const engine = new Ecosystem(
      hopGraph,
      [seed({ ...species, speed: 0.001 })],
      { elapsed: 0, random: () => 0.5, food },
    );
    const flightSteps: number[] = [];
    let previous = engine.getAnimal("frog")!;
    let seconds = 0,
      peak = 0,
      groundedPreparation = 0;
    while (seconds < 1) {
      engine.advance(1 / 60);
      seconds += 1 / 60;
      const state = engine.getAnimal("frog")!;
      if (state.motion.hop && state.motion.progress < 0.2) {
        groundedPreparation++;
        expect(state.position.x).toBe(0);
        expect(state.motion.lift).toBe(0);
      }
      if (
        state.motion.progress > 0.3 &&
        state.motion.progress < 0.8 &&
        previous.motion.progress > 0.2
      )
        flightSteps.push(state.position.x - previous.position.x);
      peak = Math.max(peak, state.motion.lift);
      expect(state.position.x).toBeGreaterThanOrEqual(previous.position.x);
      previous = state;
      if (state.nodeId === "b") break;
    }
    expect(seconds).toBeGreaterThan(0.3);
    expect(seconds).toBeLessThan(0.5);
    expect(groundedPreparation).toBeGreaterThan(0);
    expect(peak).toBeGreaterThan(0.12);
    expect(flightSteps.length).toBeGreaterThan(5);
    expect(Math.max(...flightSteps) - Math.min(...flightSteps)).toBeLessThan(
      1e-6,
    );
    expect(previous.position.x).toBe(0.32);
    expect(previous.motion.lift).toBe(0);
  });

  it("interpolates fixed steps at render time, including landing, and freezes on pause", () => {
    const engine = new Ecosystem(hopGraph, [seed()], {
      speed: 1,
      elapsed: 0,
      random: () => 0.5,
      food,
    });
    for (let i = 0; i < 20; i++) engine.advance(0.025);
    const before = structuredClone(engine.observeRenderedAnimal("frog")!);
    const actual = engine.getAnimal("frog")!;
    engine.advance(0.025);
    const between = structuredClone(engine.observeRenderedAnimal("frog")!);
    expect(engine.getAnimal("frog")!.position).toEqual(actual.position);
    expect(between.position.x).toBeGreaterThan(before.position.x);
    expect(between.position.x).toBeLessThan(actual.position.x);
    engine.advance(1, true);
    expect(engine.observeRenderedAnimal("frog")).toEqual(between);

    let landing = false;
    for (let i = 0; i < 160; i++) {
      engine.advance(0.025);
      const state = engine.getAnimal("frog")!;
      const rendered = engine.observeRenderedAnimal("frog")!;
      if (state.nodeId === "b" && rendered.motion.hop) {
        landing = true;
        expect(rendered.motion.progress).toBeGreaterThan(0.9);
        expect(rendered.position.x).toBeLessThanOrEqual(0.32);
        expect(rendered.moving).toBe(true);
        break;
      }
    }
    expect(landing).toBe(true);
  });

  it("chooses varied outings and pauses through an injected random source", () => {
    const graph = new HabitatGraph([
      node("a", 0, 0, ["east", "west", "north", "south"]),
      node("east", 0.32, 0, ["a"]),
      node("west", -0.32, 0, ["a"]),
      node("north", 0, -0.32, ["a"]),
      node("south", 0, 0.32, ["a"]),
    ]);
    const outings = (randomSeed: number) => {
      const animal = {
        ...seed(),
        needs: { hunger: 0.05, hydration: 0.9, energy: 0.9 },
      };
      const engine = new Ecosystem(graph, [animal], {
        elapsed: 0,
        random: random(randomSeed),
      });
      const visits: string[] = [];
      const pauses: number[] = [];
      let pause = 0,
        last = "a";
      for (let i = 0; i < 1800; i++) {
        engine.advance(1 / 60);
        const state = engine.getAnimal("frog")!;
        if (!state.moving) pause++;
        else if (pause) {
          pauses.push(pause);
          pause = 0;
        }
        if (state.nodeId !== last) {
          visits.push(state.nodeId);
          last = state.nodeId;
        }
      }
      return { visits, pauses };
    };
    const first = outings(173);
    expect(new Set(first.visits).size).toBeGreaterThanOrEqual(4);
    expect(new Set(first.pauses).size).toBeGreaterThan(3);
    expect(outings(173)).toEqual(first);
    expect(outings(174).visits).not.toEqual(first.visits);
  });

  it("is grounded only at ground nodes and walking between them", () => {
    const crawler = { ...species, movement: "crawl" as const };
    const graph = new HabitatGraph([
      node("a", 0, 0, ["b"]),
      node("b", 0.32, 0, ["a", "rock"]),
      {
        ...node("rock", 0.64, 0, ["b"]),
        position: { x: 0.64, y: 0.04, z: 0 },
        surface: "stone",
      },
    ]);
    const engine = new Ecosystem(graph, [seed(crawler)], {
      elapsed: 0,
      random: () => 0.5,
      food: [{ nodeId: "rock", amount: 5, capacity: 0 }],
    });
    const seen = new Set<string>();
    for (let frame = 0; frame < 60 * 60; frame++) {
      engine.advance(1 / 60);
      const state = engine.getAnimal("frog")!;
      const onRockEdge = state.nodeId === "b" && state.motion.progress > 0;
      const expected = state.nodeId !== "rock" && !onRockEdge;
      expect(state.grounded).toBe(expected);
      seen.add(`${state.nodeId}:${state.grounded}`);
      if (state.nodeId === "rock") break;
    }
    expect(seen).toEqual(
      new Set(["a:true", "b:true", "b:false", "rock:false"]),
    );
  });

  it("keeps non-climbing frogs off steep stone approaches", () => {
    const graph = new HabitatGraph([
      node("a", 0, 0, ["ledge"]),
      {
        ...node("ledge", 0.1, 0, ["a"]),
        position: { x: 0.1, y: 0.3, z: 0 },
        surface: "stone",
      },
    ]);
    expect(graph.paths("a", species).has("ledge")).toBe(false);
    expect(graph.paths("a", { ...species, climbs: true }).has("ledge")).toBe(
      true,
    );
  });

  it("uses physical distance when a direct route has more surface samples", () => {
    const graph = new HabitatGraph([
      node("a", 0, 0, ["around", "b"]),
      node("around", 0, 2, ["a", "end"]),
      node("b", 0.1, 0, ["a", "c"]),
      node("c", 0.2, 0, ["b", "end"]),
      node("end", 0.3, 0, ["c", "around"]),
    ]);
    expect(graph.paths("a", species).get("end")).toEqual(["b", "c", "end"]);
  });
});
