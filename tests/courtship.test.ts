import { describe, expect, it } from "vitest";
import { Ecosystem } from "../src/simulation/engine";
import { HabitatGraph, distance } from "../src/simulation/navigation";
import { createWorldEcosystem } from "../src/simulation/worldHabitat";
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

describe("courtship", () => {
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

  it("lets frogs and fish in a starter tank find their mates", () => {
    const world = makePreset("tropical");
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
  });
});
