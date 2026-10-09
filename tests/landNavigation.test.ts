import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { assets } from "../src/assets";
import {
  emptyWorld,
  type AssetKind,
  type HabitatObject,
  type World,
} from "../src/model/schema";
import { groundHeight } from "../src/model/terrain";
import { LandSurfaces } from "../src/simulation/landSurfaces";
import { buildHabitat } from "../src/simulation/worldHabitat";
import type { SpeciesProfile } from "../src/simulation/types";

const profile = (kind: AssetKind): SpeciesProfile => {
  const behavior = assets[kind].behavior;
  if (!behavior) throw new Error("Expected a land animal");
  return { id: kind, ...behavior };
};
function object(
  id: string,
  kind: AssetKind,
  extra: Partial<HabitatObject> = {},
): HabitatObject {
  return {
    id,
    kind,
    x: -1.2,
    z: 0,
    scale: 1,
    rotation: 0,
    seed: 173,
    ...extra,
  };
}
function stackedWorld() {
  const world = emptyWorld();
  world.environment.water = 0;
  world.objects = [object("lower", "rock", { scale: 1.4, rotation: 0.7 })];
  const top = new LandSurfaces(world).at(-1.2, 0)!.position.y - 0.015;
  world.objects.push(
    object("upper", "rock", {
      scale: 0.65,
      support: "lower",
      lift: top - groundHeight(-1.2, 0, world.environment),
      rotation: -0.4,
    }),
  );
  const upperTop = new LandSurfaces(world).at(-1.2, 0)!.position.y - 0.015;
  world.objects.push(
    object("plant", "fern", {
      scale: 0.6,
      support: "upper",
      lift: upperTop - groundHeight(-1.2, 0, world.environment),
    }),
  );
  return world;
}

describe("exposed hardscape routes", () => {
  it("connects ground, stacked stone and a plant on top, with a route back down", () => {
    const world = stackedWorld();
    const graph = buildHabitat(world);
    const species = profile("tree-frog");
    const start = graph.nearest(
      { x: -2.3, y: groundHeight(-2.3, 0, world.environment), z: 0 },
      species,
    )!;
    const paths = graph.paths(start.id, species);
    const upper = [...graph.nodes.values()].filter(
      (node) => node.supportId === "upper",
    );
    const leaves = [...graph.nodes.values()].filter(
      (node) => node.plantId === "plant" && node.surface === "leaf",
    );
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.some((node) => paths.has(node.id))).toBe(true);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((node) => paths.has(node.id))).toBe(true);
    expect(graph.paths(leaves[0].id, species).has(start.id)).toBe(true);
    for (const node of graph.nodes.values())
      for (const neighbor of node.neighbors)
        expect(graph.node(neighbor).neighbors).toContain(node.id);
  });

  it("samples the outer skin, with no nodes hidden inside another stacked stone", () => {
    const world = stackedWorld();
    const surfaces = new LandSurfaces(world);
    const graph = buildHabitat(world);
    for (const node of graph.nodes.values()) {
      if (!node.supportId) continue;
      expect(surfaces.inside(node.position)).toBe(false);
      const solid = surfaces.solids.find(
        (solid) => solid.object.id === node.supportId,
      )!;
      const point = new THREE.Vector3(
        node.position.x,
        node.position.y,
        node.position.z,
      );
      const distance = Math.min(
        ...solid.faces.map(({ triangle }) =>
          triangle
            .closestPointToPoint(point, new THREE.Vector3())
            .distanceTo(point),
        ),
      );
      expect(distance).toBeLessThanOrEqual(0.025);
      for (const id of node.neighbors) {
        const next = graph.node(id);
        if (next.supportId)
          expect(surfaces.clearRoute(node.position, next.position)).toBe(true);
      }
      expect(
        Math.hypot(node.normal.x, node.normal.y, node.normal.z),
      ).toBeCloseTo(1);
    }
  });

  it("does not invent bridges to a floating stone or across deep water", () => {
    for (const water of [false, true]) {
      const world = emptyWorld();
      world.environment.water = water ? 0.7 : 0;
      world.objects = [
        object("island", "rock", { x: 2, scale: 0.8, lift: water ? 0 : 1.4 }),
      ];
      const graph = buildHabitat(world);
      const species = profile("tree-frog");
      const start = graph.nearest(
        { x: -2, y: groundHeight(-2, 0, world.environment), z: 0 },
        species,
      )!;
      const paths = graph.paths(start.id, species);
      const island = [...graph.nodes.values()].filter(
        (node) => node.supportId === "island",
      );
      expect(island.length).toBeGreaterThan(0);
      expect(island.every((node) => !paths.has(node.id))).toBe(true);
    }
  });

  it("lets geckos climb the stack but keeps mossy frogs below their height limit", () => {
    const world = stackedWorld();
    const graph = buildHabitat(world);
    for (const kind of ["gecko", "mossy-frog", "dart-frog"] as const) {
      const species = profile(kind);
      const start = graph.nearest(
        { x: -2.3, y: groundHeight(-2.3, 0, world.environment), z: 0 },
        species,
      )!;
      const paths = graph.paths(start.id, species);
      const upper = [...graph.nodes.values()].filter(
        (node) => node.supportId === "upper",
      );
      expect(upper.some((node) => paths.has(node.id))).toBe(kind === "gecko");
      if (kind === "mossy-frog")
        for (const id of paths.keys())
          expect(graph.node(id).perchHeight ?? 0).toBeLessThanOrEqual(0.65);
    }
  });

  it("gives each animal the room it needs, in a graph that doesn't depend on who lives there", () => {
    const world = emptyWorld();
    world.environment.water = 0;
    world.objects = [object("stone", "rock", { x: 0, scale: 1.2 })];
    const graph = buildHabitat(world);
    const small = profile("dart-frog");
    const large = { ...profile("chuckwalla"), radius: 0.63 };
    expect(
      [...graph.nodes.values()].some(
        (node) =>
          node.surface === "ground" &&
          graph.allowed(node.id, small) &&
          !graph.allowed(node.id, large),
      ),
    ).toBe(true);
    // A large climber still finds a way onto the stone and up the glass,
    // keeping to places it fits.
    const gecko = { ...profile("gecko"), radius: 0.45 };
    const start = graph.nearest(
      { x: -3, y: groundHeight(-3, 0, world.environment), z: 0 },
      gecko,
    )!;
    const reached = [...graph.paths(start.id, gecko).keys()].map((id) =>
      graph.node(id),
    );
    expect(reached.some((node) => node.supportId === "stone")).toBe(true);
    expect(reached.some((node) => node.surface === "glass")).toBe(true);
    for (const node of reached)
      expect(node.room ?? Infinity).toBeGreaterThanOrEqual(gecko.radius);
  });

  it("opens diagonal ground routes without cutting through stone or flooded corners", () => {
    const world = emptyWorld();
    const graph = buildHabitat(world);
    const surfaces = new LandSurfaces(world);
    let diagonals = 0;
    for (const node of graph.nodes.values()) {
      if (!node.id.startsWith("g:")) continue;
      for (const id of node.neighbors) {
        if (!id.startsWith("g:")) continue;
        const next = graph.node(id);
        expect(surfaces.clearRoute(node.position, next.position)).toBe(true);
        if (
          node.position.x !== next.position.x &&
          node.position.z !== next.position.z
        )
          diagonals++;
      }
    }
    expect(diagonals).toBeGreaterThan(0);
  });

  it("keeps land animals dry, water dwellers under the water, and lets visitors cross the shore", () => {
    const reached = (world: World, species: SpeciesProfile, x: number) => {
      const graph = buildHabitat(world);
      const start = graph.nearest(
        { x, y: groundHeight(x, 0, world.environment), z: 0 },
        species,
      )!;
      return [...graph.paths(start.id, species).keys()].map((id) =>
        graph.node(id),
      );
    };
    const land = profile("dart-frog");
    const visitor = profile("vampire-crab");
    const dweller: SpeciesProfile = { ...visitor, water: "lives" };
    const pond = emptyWorld();
    const landRoutes = reached(pond, land, -2.5);
    const visitorRoutes = reached(pond, visitor, -2.5);
    expect(landRoutes.every((node) => !node.submerged)).toBe(true);
    expect(reached(pond, dweller, 2.5).every((node) => node.submerged)).toBe(
      true,
    );
    expect(visitorRoutes.some((node) => node.submerged)).toBe(true);
    expect(visitorRoutes.some((node) => !node.submerged)).toBe(true);
    // The top of a sunken stone is walkable too.
    const deep = emptyWorld();
    deep.environment.water = 0.8;
    deep.objects = [object("rock", "rock", { x: 2, scale: 0.4 })];
    expect(
      reached(deep, dweller, 2.5).some((node) => node.supportId === "rock"),
    ).toBe(true);
  });
});
