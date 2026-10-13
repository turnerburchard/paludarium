import { describe, expect, it } from "vitest";
import { Ecosystem } from "../src/simulation/engine";
import { HabitatGraph, distance } from "../src/simulation/navigation";
import { createWorldEcosystem } from "../src/simulation/worldHabitat";
import { parseWorld } from "../src/editor/persistence";
import {
  advanceLife,
  withAnimalCourtships,
  withAnimalPositions,
} from "../src/simulation/lifeCycle";
import { makePreset } from "../src/model/presets";
import { randomFromSeed } from "../src/model/random";
import type { AnimalSeed, HabitatNode } from "../src/simulation/types";

const species = {
  id: "test-frog",
  nocturnal: false,
  climbs: false,
  speed: 0.2,
};
const needs = { hunger: 0.1, hydration: 1, energy: 1 };
/** Ground nodes 0.3 apart in a row, as two separate stretches when `gap`
 * is set. */
function row(count: number, gap?: number): HabitatNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    position: { x: i * 0.3, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    surface: "ground" as const,
    wet: false,
    shelter: 0,
    neighbors: [i - 1, i + 1]
      .filter((n) => n >= 0 && n < count && n !== gap && i !== gap)
      .map((n) => `n${n}`),
  }));
}
function frog(id: string, nodeId: string): AnimalSeed {
  return { id, species, nodeId, needs, direction: { x: 1, y: 0, z: 0 } };
}
function run(engine: Ecosystem, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) engine.advance(0.1);
}

/** The lower id waits for its mate. UUIDs made this fixture alternate
 * between two different routes despite the seeded simulation randomness. */
function starterWorld(reverse = false) {
  const world = makePreset("tropical");
  const frogs = world.objects.filter((object) => object.kind === "tree-frog");
  world.objects = world.objects.map((object) => {
    const index = frogs.indexOf(object);
    return index < 0
      ? object
      : { ...object, id: `frog:${reverse ? frogs.length - index - 1 : index}` };
  });
  return world;
}

describe("courtship", () => {
  it("requires ten real seconds together, counts once per step and restores progress", () => {
    const create = () =>
      new Ecosystem(
        new HabitatGraph(row(3)),
        [frog("a", "n0"), frog("b", "n1")],
        { elapsed: 0, random: () => 0.5 },
      );
    const ready = new Set(["a", "b"]);
    const engine = create();
    engine.court(ready);
    run(engine, 6);
    expect(engine.meetings).toEqual([]);
    expect(engine.courtships[0].together).toBeGreaterThan(5);
    expect(engine.getAnimal("b")!.reason).toBe("Courting");
    const beforePause = engine.courtships;
    for (let i = 0; i < 20; i++) engine.advance(0.1, true);
    expect(engine.courtships).toEqual(beforePause);
    const restored = create();
    restored.court(ready, JSON.parse(JSON.stringify(engine.courtships)));
    expect(restored.courtships).toEqual(engine.courtships);
    run(restored, 3);
    expect(restored.meetings).toEqual([]);
    run(restored, 2);
    expect(restored.takeMeetings()).toEqual([["a", "b"]]);
    expect(restored.courtships).toEqual([]);
  });

  it("retains an actual world's pair and progress through save/reload and habitat rebuilds", () => {
    let world = advanceLife(starterWorld(), 25);
    const engine = createWorldEcosystem(world, undefined, randomFromSeed(4));
    for (
      let i = 0;
      i < 30 && !engine.courtships.some((pair) => pair.together > 2);
      i++
    )
      run(engine, 0.5);
    expect(engine.courtships.some((pair) => pair.together > 2)).toBe(true);
    world = withAnimalCourtships(
      withAnimalPositions(world, (id) => engine.observeAnimal(id)?.position),
      engine.courtships,
    );
    const reloaded = createWorldEcosystem(
      parseWorld(JSON.stringify(world)),
      undefined,
      randomFromSeed(4),
    );
    expect(reloaded.courtships).toEqual(engine.courtships);
    const rebuilt = createWorldEcosystem(
      world,
      { world, engine },
      randomFromSeed(4),
    );
    expect(rebuilt.courtships).toEqual(engine.courtships);
    reloaded.court(new Set());
    expect(reloaded.courtships).toEqual([]);
  });

  it("brings a ready pair face to face, then reports that they met", () => {
    const engine = new Ecosystem(
      new HabitatGraph(row(10)),
      [frog("a", "n0"), frog("b", "n9")],
      { speed: 1, elapsed: 0, random: () => 0.5 },
    );
    engine.court(new Set(["a", "b"]));
    run(engine, 2);
    expect(engine.getAnimal("a")!.activity).toBe("courting");
    expect(engine.getAnimal("b")!.reason).toBe("Heading to its mate");
    for (let i = 0; i < 120 && !engine.meetings.length; i++) run(engine, 1);
    const [a, b] = [engine.getAnimal("a")!, engine.getAnimal("b")!];
    expect(distance(a.position, b.position)).toBeLessThan(0.6);
    expect(engine.takeMeetings().map((pair) => [...pair].sort())).toEqual([
      ["a", "b"],
    ]);
    expect(engine.meetings).toEqual([]);
    run(engine, 1);
    expect(engine.getAnimal("a")!.activity).not.toBe("courting");
  });

  it("leaves alone animals that are not ready or can't reach each other", () => {
    const apart = new Ecosystem(
      new HabitatGraph(row(10, 5)),
      [frog("a", "n0"), frog("b", "n9")],
      { speed: 1, elapsed: 0, random: () => 0.5 },
    );
    apart.court(new Set(["a", "b"]));
    run(apart, 2);
    expect(apart.getAnimal("a")!.activity).not.toBe("courting");
    const single = new Ecosystem(
      new HabitatGraph(row(10)),
      [frog("a", "n0"), frog("b", "n9")],
      { speed: 1, elapsed: 0, random: () => 0.5 },
    );
    single.court(new Set(["a"]));
    run(single, 2);
    expect(single.getAnimal("a")!.activity).not.toBe("courting");
  });

  it.each([false, true])(
    "lets starter animals find mates in either frog order (%s)",
    (reverse) => {
      const world = starterWorld(reverse);
      const ids = (kind: string) =>
        world.objects.filter((o) => o.kind === kind).map((o) => o.id);
      const frogs = ids("tree-frog");
      const fish = ids("convict-cichlid").slice(0, 2);
      const engine = createWorldEcosystem(world, undefined, randomFromSeed(4));
      engine.court(new Set([...frogs, ...fish]));
      const met: string[][] = [];
      for (let i = 0; i < 60 && met.length < 2; i++) {
        run(engine, 1);
        met.push(...engine.takeMeetings().map((pair) => [...pair].sort()));
      }
      expect(met).toContainEqual([...frogs].sort());
      expect(met).toContainEqual([...fish].sort());
    },
  );
});

describe("juveniles", () => {
  it("head back to a parent they have strayed from", () => {
    const engine = new Ecosystem(
      new HabitatGraph(row(14)),
      [frog("parent", "n0"), frog("young", "n13")],
      { speed: 1, elapsed: 0, random: () => 0.5 },
    );
    engine.raise(new Map([["young", ["parent"]]]));
    run(engine, 2);
    expect(engine.getAnimal("young")!.reason).toBe(
      "Keeping close to its parent",
    );
    run(engine, 60);
    const [parent, young] = [
      engine.getAnimal("parent")!,
      engine.getAnimal("young")!,
    ];
    expect(distance(parent.position, young.position)).toBeLessThan(1.2);
  });
});
