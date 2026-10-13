import { expect, it } from "vitest";
import { emptyWorld } from "../src/model/schema";
import { randomFromSeed } from "../src/model/random";
import { TerrainStroke } from "../src/editor/terrainStroke";
import {
  createWorldEcosystem,
  createWorldEcosystemSteps,
} from "../src/simulation/worldHabitat";

it("publishes the same habitat and live needs after a resumed terrain rebuild", () => {
  const world = emptyWorld();
  world.objects = [
    { id: "rock", kind: "rock", x: -1, z: 0, rotation: 0, scale: 1, seed: 173 },
    {
      id: "plant",
      kind: "fern",
      x: -2,
      z: 0,
      rotation: 0,
      scale: 1,
      seed: 346,
    },
    {
      id: "frog",
      kind: "tree-frog",
      x: -2.5,
      z: 0,
      rotation: 0,
      scale: 1,
      seed: 519,
    },
    { id: "fish", kind: "fish", x: 2, z: 0, rotation: 0, scale: 1, seed: 692 },
  ];
  const engine = createWorldEcosystem(world, undefined, randomFromSeed(3));
  engine.advance(0.1);
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.65 }).dab(
    -1,
    0,
  );
  const previous = { world, engine };
  const expected = createWorldEcosystem(next, previous, randomFromSeed(4));
  const steps = createWorldEcosystemSteps(next, previous, randomFromSeed(4));
  let result = steps.next();
  let batches = 0;
  while (!result.done) {
    batches++;
    result = steps.next();
  }
  expect(batches).toBeGreaterThan(100);
  expect([...result.value.graph.nodes]).toEqual([...expected.graph.nodes]);
  expect(result.value.snapshot()).toEqual(expected.snapshot());
  expect(engine.getAnimal("frog")!.needs).toEqual(
    result.value.getAnimal("frog")!.needs,
  );
});
