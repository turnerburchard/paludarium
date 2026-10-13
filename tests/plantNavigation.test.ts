import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  assets,
  animalBody,
  assetRadius,
  buildAsset,
  disposeAsset,
} from "../src/assets";
import { structuralShape, collisionShape } from "../src/assets/collisionShape";
import {
  emptyWorld,
  type AssetKind,
  type HabitatObject,
} from "../src/model/schema";
import { groundHeight } from "../src/model/terrain";
import { objectBase } from "../src/model/stacking";
import { Solids } from "../src/simulation/solids";
import { PlantObstacles } from "../src/simulation/plantObstacles";
import { buildHabitat } from "../src/simulation/worldHabitat";
import { HabitatGraph, distance } from "../src/simulation/navigation";
import { Ecosystem } from "../src/simulation/engine";
import { randomFromSeed } from "../src/model/random";
import type { HabitatNode, SpeciesProfile } from "../src/simulation/types";

const object = (
  kind: AssetKind,
  extra: Partial<HabitatObject> = {},
): HabitatObject => ({
  id: "plant",
  kind,
  x: 0,
  z: 0,
  scale: 1,
  rotation: 0,
  seed: 173,
  ...extra,
});
function habitat(...objects: HabitatObject[]) {
  const world = emptyWorld();
  world.environment.water = 0;
  world.objects = objects;
  return world;
}
function species(kind: AssetKind): SpeciesProfile {
  const behavior = assets[kind].behavior;
  if (!behavior) throw new Error("Expected land animal");
  return {
    id: kind,
    ...behavior,
    radius: assetRadius(kind),
    body: animalBody(kind, 173),
  };
}
const node = (
  id: string,
  x: number,
  y: number,
  z: number,
  neighbors: string[] = [],
): HabitatNode => ({
  id,
  position: { x, y, z },
  normal: { x: 0, y: 1, z: 0 },
  surface: "ground",
  wet: false,
  shelter: 0,
  neighbors,
});

describe("plant structure and ground routes", () => {
  it.each([
    "barrel-cactus",
    "hedgehog-cactus",
    "saguaro",
    "organ-pipe",
    "beavertail",
    "cholla",
    "prickly-pear",
  ] as const)(
    "%s blocks bodies without becoming a climbing surface",
    (kind) => {
      const world = habitat(object(kind));
      const solids = new Solids(world);
      const base = objectBase(world.objects[0], world.environment);
      expect(solids.surfaces.solids).toHaveLength(1);
      expect(solids.surfaces.routes(0.1)).toHaveLength(0);
      const tree = solids.surfaces.solids[0];
      const face = tree.faces.reduce((largest, next) =>
        next.triangle.getArea() > largest.triangle.getArea() ? next : largest,
      );
      const normal = face.triangle.getNormal(new THREE.Vector3());
      const origin = face.triangle
        .getMidpoint(new THREE.Vector3())
        .addScaledVector(normal, 0.3);
      expect(solids.cast(origin, normal.clone().negate(), 0.31)).toBeDefined();
      const graph = buildHabitat(world, solids);
      const turtle = species("turtle");
      const start = graph.nearest({ x: -1.5, y: base, z: 0 }, turtle)!;
      const end = graph.nearest({ x: 1.5, y: base, z: 0 }, turtle)!;
      const route = graph.routes(start.id, turtle).pathTo(end.id);
      let previous = start;
      for (const id of route) {
        const next = graph.node(id);
        expect(graph.edgeCost(previous, next, turtle)).toBeLessThan(Infinity);
        previous = next;
      }
      expect(
        route.some((id) => Math.abs(graph.node(id).position.z) > 0.15),
      ).toBe(true);
    },
  );

  it.each(["monstera", "philodendron"] as const)(
    "%s has smaller structure than its canopy and preserves climbing",
    (kind) => {
      const plant = object(kind);
      const world = habitat(plant);
      const structure = structuralShape(plant),
        model = collisionShape(plant);
      expect(structure.faces.length).toBeLessThan(model.faces.length);
      expect(structure.bounds.getSize(new THREE.Vector3()).x).toBeLessThan(
        model.bounds.getSize(new THREE.Vector3()).x,
      );
      const solids = new Solids(world);
      const graph = buildHabitat(world, solids);
      const frog = species("tree-frog");
      const start = graph.nearest(
        { x: -0.8, y: objectBase(plant, world.environment), z: 0 },
        frog,
      )!;
      const reachable = graph.routes(start.id, frog);
      const leaves = [...graph.nodes.values()].filter(
        (n) => n.plantId === plant.id && n.surface === "leaf",
      );
      expect(leaves.length).toBeGreaterThan(0);
      expect(leaves.some((leaf) => reachable.distances.has(leaf.id))).toBe(
        true,
      );
      const leaf = leaves.find((leaf) => reachable.distances.has(leaf.id))!;
      expect(graph.routes(leaf.id, frog).distances.has(start.id)).toBe(true);
      for (const stem of [...graph.nodes.values()].filter(
        (n) => n.plantId === plant.id && n.surface === "stem",
      )) {
        expect(
          Math.hypot(stem.normal.x, stem.normal.y, stem.normal.z),
        ).toBeCloseTo(1);
        expect(solids.surfaces.inside(stem.position)).toBe(false);
      }
    },
  );

  it("detects a thin pole between clear endpoints, and invalidates it after an edit", () => {
    const plant = object("philodendron", { scale: 0.5, rotation: 0.7 });
    const world = habitat(plant);
    const y = groundHeight(-0.4, 0, world.environment);
    const a = node("a", -0.4, y, 0),
      b = node("b", 0.4, y, 0);
    const turtle = species("turtle");
    const solids = new Solids(world);
    expect(new PlantObstacles(world, solids.surfaces).cost(a, b, turtle)).toBe(
      Infinity,
    );
    const next = habitat({ ...plant, z: 1 });
    const moved = new Solids(next, solids);
    expect(
      new PlantObstacles(next, moved.surfaces).cost(a, b, turtle),
    ).toBeCloseTo(0.8);
  });
});

describe("plant contact", () => {
  it("keeps the pole fixed when its calibrated foliage bends", () => {
    const model = buildAsset("philodendron", 173);
    const foliage = model.getObjectByName("foliage")!;
    const structure = new THREE.Box3().setFromObject(model.children[0]);
    const before = new THREE.Box3().setFromObject(foliage);
    foliage.rotation.z = 0.12;
    model.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(model.children[0])).toEqual(
      structure,
    );
    expect(new THREE.Box3().setFromObject(foliage)).not.toEqual(before);
    const collision = structuralShape(object("philodendron"));
    expect(collision.bounds.max.y).toBeCloseTo(structure.max.y);
    disposeAsset(model);
  });

  it("fits a visitor to its actual leaf without making that leaf solid for ground travel", () => {
    const plant = object("monstera");
    const world = habitat(plant);
    const solids = new Solids(world);
    const graph = buildHabitat(world, solids);
    const leaf = [...graph.nodes.values()]
      .filter((n) => n.surface === "leaf")
      .sort((a, b) => b.position.y - a.position.y)[0];
    const origin = new THREE.Vector3(
      leaf.position.x,
      leaf.position.y,
      leaf.position.z,
    ).addScaledVector(
      new THREE.Vector3(leaf.normal.x, leaf.normal.y, leaf.normal.z),
      0.1,
    );
    const down = new THREE.Vector3(
      -leaf.normal.x,
      -leaf.normal.y,
      -leaf.normal.z,
    ).normalize();
    expect(solids.cast(origin, down, 0.2)).toBeUndefined();
    expect(
      solids.onPlant(plant.id).cast(origin, down, 0.2)?.distance,
    ).toBeLessThan(0.15);
  });

  it.each([0.6, 1, 1.5])(
    "preserves routes up and down a rotated plant at scale %s",
    (scale) => {
      const world = habitat(object("monstera", { scale, rotation: 0.7 }));
      const graph = buildHabitat(world);
      const frog = species("tree-frog");
      frog.radius! *= 0.6;
      frog.body = {
        width: frog.body!.width * 0.6,
        length: frog.body!.length * 0.6,
        height: frog.body!.height * 0.6,
      };
      const start = graph.nearest(
        { x: -0.8, y: objectBase(world.objects[0], world.environment), z: 0 },
        frog,
      )!;
      const routes = graph.routes(start.id, frog);
      const leaves = [...graph.nodes.values()].filter(
        (n) => n.surface === "leaf" && routes.distances.has(n.id),
      );
      expect(leaves.length).toBeGreaterThan(0);
      expect(graph.routes(leaves[0].id, frog).distances.has(start.id)).toBe(
        true,
      );
    },
  );
});

describe("passable foliage", () => {
  it("caps overlap costs in dense foliage and ignores leaves above a small animal", () => {
    const world = habitat(
      ...Array.from({ length: 12 }, (_, i) =>
        object("fern", { id: `fern:${i}` }),
      ),
    );
    const solids = new Solids(world);
    expect(solids.surfaces.solids).toHaveLength(0);
    const plants = new PlantObstacles(world, solids.surfaces);
    const y = groundHeight(0, 0, world.environment);
    const a = node("a", -0.8, y, 0),
      b = node("b", 0.8, y, 0);
    const crawler = {
      ...species("tree-frog"),
      body: { width: 0.15, length: 0.2, height: 0.3 },
    };
    const cost = plants.cost(a, b, crawler);
    expect(cost).toBeGreaterThan(1.6);
    expect(cost).toBeLessThanOrEqual(1.6 * 1.5);
    const elevated = habitat(object("fern", { lift: 1 }));
    const overhead = new PlantObstacles(
      elevated,
      new Solids(elevated).surfaces,
    );
    expect(overhead.cost(a, b, crawler)).toBeCloseTo(1.6);
    expect(
      plants.cost(a, b, {
        ...crawler,
        swims: { speed: 1, depth: [0, 1], room: 0.1, height: 0.1 },
      }),
    ).toBeCloseTo(1.6);
  });

  it("chooses modest open detours but pushes through rather than taking a long detour", () => {
    const nodes = [
      node("a", -1, 0, 0, ["b", "c"]),
      node("b", 0, 0, 0, ["a", "d"]),
      node("c", 0, 0, 0.5, ["a", "d"]),
      node("d", 1, 0, 0, ["b", "c"]),
    ];
    const graph = new HabitatGraph(
      nodes,
      (a, b) =>
        distance(a.position, b.position) *
        (a.id === "b" || b.id === "b" ? 1.5 : 1),
    );
    const frog = species("tree-frog");
    const route = graph.routes("a", frog);
    expect(route.pathTo("d")).toEqual(["c", "d"]);
    expect(route.distances.get("d")).toBeCloseTo(2 * Math.sqrt(1.25));
    const far = nodes.map((n) =>
      n.id === "c" ? { ...n, position: { ...n.position, z: 3 } } : n,
    );
    const long = new HabitatGraph(
      far,
      (a, b) =>
        distance(a.position, b.position) *
        (a.id === "b" || b.id === "b" ? 1.5 : 1),
    );
    const direct = long.routes("a", frog);
    expect(direct.pathTo("d")).toEqual(["b", "d"]);
    expect(direct.distances.get("d")).toBe(2);
    expect(direct.costs.get("d")).toBe(3);
  });

  it("pauses briefly rather than sleeping on a stem when the perch is occupied", () => {
    const frog = { ...species("tree-frog"), speed: 0.1 };
    const graph = new HabitatGraph([
      {
        ...node("stem", 0, 0.5, 0, ["leaf"]),
        surface: "stem",
        plantId: "plant",
      },
      {
        ...node("leaf", 0, 0.8, 0, ["stem"]),
        surface: "leaf",
        plantId: "plant",
      },
    ]);
    const engine = new Ecosystem(
      graph,
      [
        {
          id: "climber",
          species: frog,
          nodeId: "stem",
          needs: { hunger: 0.1, hydration: 1, energy: 0.2 },
        },
        { id: "visitor", species: frog, nodeId: "leaf" },
      ],
      { speed: 1, random: () => 0.5 },
    );
    for (let i = 0; i < 20; i++) {
      engine.advance(0.1, false, new Set(["visitor"]));
      expect(engine.getAnimal("climber")!.activity).toBe("resting");
    }
  });

  it("uses stems for travel without selecting them as resting destinations", () => {
    const world = habitat(object("philodendron"));
    const solids = new Solids(world);
    const graph = buildHabitat(world, solids);
    const frog = species("tree-frog");
    const start = graph.nearest(
      { x: -0.7, y: groundHeight(0, 0, world.environment), z: 0 },
      frog,
    )!;
    const leaf = [...graph.nodes.values()].find(
      (n) => n.surface === "leaf" && graph.allowed(n.id, frog),
    )!;
    const engine = new Ecosystem(
      graph,
      [
        {
          id: "frog",
          species: frog,
          nodeId: start.id,
          needs: { hunger: 0.9, hydration: 0.9, energy: 0.9 },
        },
      ],
      {
        solids,
        speed: 1,
        random: randomFromSeed(4),
        food: [{ nodeId: leaf.id, amount: 5, capacity: 0 }],
      },
    );
    let climbed = false;
    for (let i = 0; i < 2000; i++) {
      engine.advance(0.1);
      const state = engine.observeAnimal("frog")!;
      if (state.surface === "stem") {
        climbed = true;
        expect(state.activity).not.toBe("sleeping");
      }
    }
    expect(climbed).toBe(true);
  });
});

describe("firm living support", () => {
  it.each(["moss", "sheet-moss", "fern-moss"] as const)(
    "%s supports a body without fragmenting ground routes",
    (kind) => {
      const world = habitat(object(kind, { scale: 1.5 }));
      const solids = new Solids(world);
      const graph = buildHabitat(world, solids);
      const ground = solids.ground(0, 0);
      const cover = solids.covered(ground.position, ground.normal);
      expect(cover.position.y).toBeGreaterThan(ground.position.y);
      expect(
        [...graph.nodes.values()].some((n) => n.supportId === "plant"),
      ).toBe(false);
      const walker = species("turtle");
      const start = graph.nearest(
        { x: -0.8, y: ground.position.y, z: 0 },
        walker,
      )!;
      const end = graph.nearest(
        { x: 0.8, y: ground.position.y, z: 0 },
        walker,
      )!;
      expect(graph.routes(start.id, walker).distances.has(end.id)).toBe(true);
      const floating = habitat(object(kind, { lift: 1 }));
      const lifted = new Solids(floating);
      expect(lifted.covered(ground.position, ground.normal)).toEqual(ground);
    },
  );

  it.each([
    "bonnet-mushrooms",
    "chicken-of-the-woods",
    "reishi",
    "oyster-mushrooms",
    "pink-oyster-mushrooms",
    "parasol-mushroom",
    "panther-caps",
    "houseplant-mushrooms",
  ] as const)(
    "%s supports a small visitor without invalid contact geometry",
    (kind) => {
      const world = habitat(object(kind, { scale: 1.5 }));
      const graph = buildHabitat(world);
      const frog = species("tree-frog");
      frog.radius! *= 0.35;
      frog.body = {
        width: frog.body!.width * 0.35,
        length: frog.body!.length * 0.35,
        height: frog.body!.height * 0.35,
      };
      const start = graph.nearest(
        { x: -0.8, y: groundHeight(0, 0, world.environment), z: 0 },
        frog,
      )!;
      const routes = graph.routes(start.id, frog);
      expect(
        [...graph.nodes.values()].some(
          (n) =>
            n.surface === "plant" &&
            routes.distances.has(n.id) &&
            graph.canRest(n.id, frog),
        ),
      ).toBe(true);
    },
  );
  it.each(["bolete", "fly-agaric", "turkey-tail"] as const)(
    "%s supplies reachable surfaces while retaining plant traits",
    (kind) => {
      const world = habitat(object(kind, { scale: 1.5 }));
      const solids = new Solids(world);
      const graph = buildHabitat(world, solids);
      const frog = species("tree-frog");
      const start = graph.nearest(
        { x: -0.8, y: groundHeight(0, 0, world.environment), z: 0 },
        frog,
      )!;
      const reachable = graph.routes(start.id, frog);
      const living = [...graph.nodes.values()].filter(
        (n) => n.surface === "plant",
      );
      expect(living.length).toBeGreaterThan(0);
      expect(living.some((n) => reachable.distances.has(n.id))).toBe(true);
      expect(assets[kind].flexibility).toBeLessThanOrEqual(0.02);
      expect(assets[kind].hardscape).toBeUndefined();
    },
  );
});
