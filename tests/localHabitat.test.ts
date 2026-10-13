import { expect, it, vi } from "vitest";
import { assets, isAnimal } from "../src/assets";
import { emptyWorld } from "../src/model/schema";
import { Ecosystem } from "../src/simulation/engine";
import { HabitatGraph } from "../src/simulation/navigation";
import { makePreset } from "../src/model/presets";
import { TerrainStroke } from "../src/editor/terrainStroke";
import { HabitatChanges } from "../src/simulation/habitatChanges";
import {
  buildHabitat,
  buildHabitatSteps,
  createWorldEcosystem,
  prepareHabitatEdit,
} from "../src/simulation/worldHabitat";
import { Solids } from "../src/simulation/solids";
import { finishWork } from "../src/work";

it.each(["grotto", "tropical"] as const)(
  "local terrain updates match full builds in %s",
  (preset) => {
    let world = makePreset(preset);
    world.objects = [
      ...world.objects.filter((o) => !isAnimal(o.kind)).slice(0, 8),
      ...world.objects.filter((o) => assets[o.kind].swims).slice(0, 1),
    ];
    let solids = new Solids(world);
    let graph = buildHabitat(world, solids);
    for (const [x, z, mode] of [
      [0, 0, "lower"],
      [-1, 0.2, "raise"],
      [0, 0, "smooth"],
    ] as const) {
      const next = new TerrainStroke(world, { mode, radius: 0.45 }).dab(x, z);
      const changes = HabitatChanges.between(world, next)!;
      const nextSolids = finishWork(Solids.build(next, solids, changes));
      graph = finishWork(
        buildHabitatSteps(next, nextSolids, { graph, changes }),
      );
      const full = buildHabitat(structuredClone(next));
      expect([...graph.nodes.keys()]).toEqual([...full.nodes.keys()]);
      for (const [id, node] of graph.nodes)
        expect(node, id).toEqual(full.node(id));
      world = next;
      solids = nextSolids;
    }
  },
);

it("includes cells beside changed terrain samples, but leaves distant ground alone", () => {
  const world = makePreset("grotto");
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.25 }).dab(
    0,
    0,
  );
  const changes = HabitatChanges.between(world, next)!;
  expect(changes.touches({ x: 0, z: 0 })).toBe(true);
  expect(
    changes.touches({
      x: world.environment.width / 2,
      z: world.environment.depth / 2,
    }),
  ).toBe(false);
});

it("keeps distant animals moving and preserves their exact state at publication", () => {
  const world = emptyWorld();
  world.objects = [
    {
      id: "frog",
      kind: "dart-frog",
      x: -2,
      z: 0,
      rotation: 0,
      scale: 1,
      seed: 173,
    },
  ];
  const engine = createWorldEcosystem(world, undefined, () => 0.5);
  const food = engine.graph.nearest(
    { x: -1.2, y: 0.9, z: 0 },
    { id: "ground", nocturnal: false, climbs: false, speed: 1 },
  )!;
  engine.addFood(food.id, 5);
  for (let i = 0; i < 10; i++) engine.advance(0.1);
  const oldGraph = engine.graph;
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.25 }).dab(
    2,
    0,
  );
  const changes = HabitatChanges.between(world, next)!;
  engine.holdHabitat(changes);
  const steps = prepareHabitatEdit(next, { world, engine }, changes);
  const before = structuredClone(engine.getAnimal("frog"));
  for (let i = 0; i < 10; i++) {
    steps.next();
    engine.advance(0.1);
  }
  expect(engine.graph).toBe(oldGraph);
  expect(engine.getAnimal("frog")!.position).not.toEqual(before!.position);
  const publish = finishWork(steps);
  const atPublication = structuredClone(engine.getAnimal("frog"));
  publish();
  expect(engine.graph).not.toBe(oldGraph);
  expect(engine.getAnimal("frog")).toEqual(atPublication);
  expect([...engine.graph.nodes]).toEqual([
    ...buildHabitat(structuredClone(next)).nodes,
  ]);
});

it("rechecks clearance locally instead of recasting the whole habitat", () => {
  const world = emptyWorld();
  const solids = new Solids(world);
  const graph = buildHabitat(world, solids);
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.25 }).dab(
    2,
    0,
  );
  const changes = HabitatChanges.between(world, next)!;
  const nextSolids = finishWork(Solids.build(next, solids, changes));
  const local = vi.spyOn(nextSolids, "cast");
  finishWork(buildHabitatSteps(next, nextSolids, { graph, changes }));
  const fullSolids = new Solids(structuredClone(next));
  const full = vi.spyOn(fullSolids, "cast");
  buildHabitat(next, fullSolids);
  expect(local.mock.calls.length).toBeLessThan(full.mock.calls.length / 4);
});

it("holds an animal whose simplified route crosses the edit even when both endpoints are outside it", () => {
  const world = emptyWorld();
  const graph = new HabitatGraph(
    ["a", "b"].map((id, i) => ({
      id,
      position: { x: -2 + i, y: 1, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      surface: "ground" as const,
      wet: false,
      shelter: 0,
      neighbors: [i ? "a" : "b"],
    })),
  );
  const engine = new Ecosystem(
    graph,
    [
      {
        id: "frog",
        species: { id: "frog", nocturnal: false, climbs: false, speed: 0.1 },
        nodeId: "a",
        direction: { x: 1, y: 0, z: 0 },
        needs: { hunger: 0.9, hydration: 0.9, energy: 0.9 },
      },
    ],
    { speed: 1, elapsed: 0, random: () => 0.5 },
  );
  engine.addFood("b", 5);
  engine.advance(0.1);
  const before = engine.getAnimal("frog")!;
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.2 }).dab(
    -1.5,
    0,
  );
  const changes = HabitatChanges.between(world, next)!;
  expect(changes.touches(graph.node("a").position)).toBe(false);
  expect(changes.touches(graph.node("b").position)).toBe(false);
  expect(engine.affectedByHabitat(changes).has("frog")).toBe(true);
  engine.holdHabitat(changes);
  engine.advance(0.1);
  expect(engine.getAnimal("frog")).toEqual(before);
  engine.holdHabitat();
  engine.advance(0.1);
  expect(engine.getAnimal("frog")!.position.x).toBeGreaterThan(
    before.position.x,
  );
});

it("can abandon a partial edit and build another from the untouched live habitat", () => {
  const world = emptyWorld();
  const engine = createWorldEcosystem(world, undefined, () => 0.5);
  const original = structuredClone([...engine.graph.nodes]);
  const abandoned = new TerrainStroke(world, {
    mode: "raise",
    radius: 0.4,
  }).dab(-1, 0);
  const firstChanges = HabitatChanges.between(world, abandoned)!;
  engine.holdHabitat(firstChanges);
  const steps = prepareHabitatEdit(abandoned, { world, engine }, firstChanges);
  for (let i = 0; i < 100; i++) steps.next();
  steps.return(() => {});
  engine.holdHabitat();
  expect([...engine.graph.nodes]).toEqual(original);
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.4 }).dab(
    2,
    0,
  );
  const changes = HabitatChanges.between(world, next)!;
  engine.holdHabitat(changes);
  finishWork(prepareHabitatEdit(next, { world, engine }, changes))();
  expect([...engine.graph.nodes]).toEqual([
    ...buildHabitat(structuredClone(next)).nodes,
  ]);
});

it("invalidates warmed foliage costs when terrain moves a plant", () => {
  const world = emptyWorld();
  world.environment.water = 0;
  world.objects = [
    {
      id: "plant",
      kind: "fern",
      x: -1.5,
      z: 0,
      rotation: 0,
      scale: 1,
      seed: 173,
    },
  ];
  const solids = new Solids(world);
  const graph = buildHabitat(world, solids);
  const species = {
    id: "frog",
    nocturnal: false,
    climbs: false,
    speed: 1,
    radius: 0.1,
    body: { width: 0.1, height: 0.1, length: 0.15 },
  };
  const start = graph.nearest({ x: -1.8, y: 1, z: 0 }, species)!;
  const near = start.neighbors.filter(
    (id) => graph.node(id).surface === "ground",
  );
  for (const id of near) graph.edgeCost(start, graph.node(id), species);
  const next = new TerrainStroke(world, { mode: "lower", radius: 0.35 }).dab(
    -1.5,
    0,
  );
  const changes = HabitatChanges.between(world, next)!;
  const updated = finishWork(
    buildHabitatSteps(next, finishWork(Solids.build(next, solids, changes)), {
      graph,
      changes,
    }),
  );
  const full = buildHabitat(structuredClone(next));
  for (const id of near)
    expect(
      updated.edgeCost(updated.node(start.id), updated.node(id), species),
    ).toBe(full.edgeCost(full.node(start.id), full.node(id), species));
});

it("keeps a held animal's pending decision suspended until the edit is released", () => {
  const world = emptyWorld();
  world.objects = [
    {
      id: "frog",
      kind: "dart-frog",
      x: -2,
      z: 0,
      rotation: 0,
      scale: 1,
      seed: 173,
    },
  ];
  const engine = createWorldEcosystem(world, undefined, () => 0.5);
  engine.advance(0.1, false, undefined, () => false);
  const before = engine.getAnimal("frog")!;
  const next = new TerrainStroke(world, { mode: "raise", radius: 0.3 }).dab(
    before.position.x,
    before.position.z,
  );
  const changes = HabitatChanges.between(world, next)!;
  engine.holdHabitat(changes);
  engine.advance(0.1);
  expect(engine.getAnimal("frog")).toEqual(before);
  expect(engine.affectedByHabitat(changes).has("frog")).toBe(true);
  engine.holdHabitat();
  engine.advance(0.1);
  expect(engine.getAnimal("frog")!.needs).not.toEqual(before.needs);
});
