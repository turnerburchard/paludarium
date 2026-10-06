import type { World } from "../model/schema";
import { isFrogKind } from "../model/species";
import { groundHeight } from "../model/terrain";
import { assets } from "../model/catalog";
import { Ecosystem } from "./engine";
import { HabitatGraph, distance } from "./navigation";
import { frogProfiles } from "./species";
import type { AnimalSeed, HabitatNode, FoodPatch } from "./types";

/** Conservative ground navigation. The graph describes surfaces, not animal mesh anatomy. */
export function buildHabitat(world: World): HabitatGraph {
  const env = world.environment,
    nodes: HabitatNode[] = [],
    grid = new Map<string, HabitatNode>();
  const clearance = Math.max(
    0.16,
    ...world.objects
      .filter((o) => isFrogKind(o.kind))
      .map((o) => assets[o.kind].radius * o.scale),
  );
  const margin = clearance + 0.08,
    spacing = 0.32;
  const nx = Math.ceil((env.width - 2 * margin) / spacing),
    nz = Math.ceil((env.depth - 2 * margin) / spacing);
  const objects = world.objects.filter(
    (o) => !isFrogKind(o.kind) && o.kind !== "fish",
  );
  for (let ix = 0; ix <= nx; ix++)
    for (let iz = 0; iz <= nz; iz++) {
      const x = -env.width / 2 + margin + (ix * (env.width - 2 * margin)) / nx;
      const z = -env.depth / 2 + margin + (iz * (env.depth - 2 * margin)) / nz;
      const y = groundHeight(x, z, env);
      // Shallow shoreline is reachable; open/deep water is not a frog walking surface.
      if (env.water - y > 0.025) continue;
      const solid = objects.some(
        (o) =>
          (o.kind === "rock" || o.kind === "wood") &&
          Math.hypot(x - o.x, z - o.z) <
            assets[o.kind].radius * o.scale + clearance,
      );
      if (solid) continue;
      const shelter = objects.reduce(
        (best, o) =>
          Math.max(
            best,
            assets[o.kind].category === "Plants" || o.kind === "moss"
              ? Math.max(
                  0,
                  1 -
                    Math.hypot(x - o.x, z - o.z) /
                      (assets[o.kind].radius * o.scale + 0.4),
                )
              : 0,
          ),
        0,
      );
      const node: HabitatNode = {
        id: `g:${ix}:${iz}`,
        position: { x, y, z },
        normal: { x: 0, y: 1, z: 0 },
        surface: "ground",
        wet: env.water > 0 && y <= env.water + 0.065,
        shelter,
        neighbors: [],
      };
      grid.set(`${ix}:${iz}`, node);
      nodes.push(node);
    }
  for (let ix = 0; ix <= nx; ix++)
    for (let iz = 0; iz <= nz; iz++) {
      const node = grid.get(`${ix}:${iz}`);
      if (!node) continue;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const neighbor = grid.get(`${ix + dx}:${iz + dz}`);
        if (neighbor && Math.abs(node.position.y - neighbor.position.y) < 0.2)
          node.neighbors.push(neighbor.id);
      }
    }
  // Wall ladders start on dry boundary cells, with an explicit bridge to the glass.
  // No ladder crosses a pond; non-climbing species cannot enter these nodes.
  for (const ground of [...nodes]) {
    const [ix, iz] = ground.id.split(":").slice(1).map(Number);
    const sides: Array<{
      tag: string;
      x: number;
      z: number;
      normal: { x: number; y: number; z: number };
    }> = [];
    if (ix === 0)
      sides.push({
        tag: "left",
        x: -env.width / 2 + 0.05,
        z: ground.position.z,
        normal: { x: 1, y: 0, z: 0 },
      });
    if (ix === nx)
      sides.push({
        tag: "right",
        x: env.width / 2 - 0.05,
        z: ground.position.z,
        normal: { x: -1, y: 0, z: 0 },
      });
    if (iz === 0)
      sides.push({
        tag: "back",
        x: ground.position.x,
        z: -env.depth / 2 + 0.05,
        normal: { x: 0, y: 0, z: 1 },
      });
    if (iz === nz)
      sides.push({
        tag: "front",
        x: ground.position.x,
        z: env.depth / 2 - 0.05,
        normal: { x: 0, y: 0, z: -1 },
      });
    for (const side of sides) {
      let previous = ground;
      for (let level = 0; level < 5; level++) {
        const node: HabitatNode = {
          id: `wall:${side.tag}:${ground.id}:${level}`,
          position: {
            x: side.x,
            y: ground.position.y + level * 0.28,
            z: side.z,
          },
          normal: side.normal,
          surface: "glass",
          wet: false,
          shelter: ground.shelter * 0.7,
          neighbors: [previous.id],
        };
        previous.neighbors.push(node.id);
        nodes.push(node);
        previous = node;
      }
    }
  }
  return new HabitatGraph(nodes);
}

export function createWorldEcosystem(
  world: World,
  previous?: { world: World; engine: Ecosystem },
): Ecosystem {
  const graph = buildHabitat(world),
    snapshot = previous?.engine.snapshot();
  const animals: AnimalSeed[] = [];
  for (const object of world.objects) {
    if (!isFrogKind(object.kind)) continue;
    const species = frogProfiles[object.kind];
    const oldObject = previous?.world.objects.find((o) => o.id === object.id);
    const oldState = snapshot?.animals.find(
      (a) => a.id === object.id && a.speciesId === object.kind,
    );
    const moved =
      !oldObject || oldObject.x !== object.x || oldObject.z !== object.z;
    const position =
      !moved && oldState
        ? oldState.position
        : {
            x: object.x,
            y: groundHeight(object.x, object.z, world.environment),
            z: object.z,
          };
    const node = graph.nearest(position, species);
    if (node)
      animals.push({
        id: object.id,
        species,
        nodeId: node.id,
        needs: oldState?.needs,
        direction:
          oldObject?.rotation === object.rotation && oldState
            ? oldState.direction
            : {
                x: -Math.sin(object.rotation),
                y: 0,
                z: -Math.cos(object.rotation),
              },
      });
  }
  let food: FoodPatch[];
  if (snapshot) {
    food = snapshot.food.flatMap((patch) => {
      const oldNode = previous!.engine.graph.node(patch.nodeId);
      const target = graph.nearest(oldNode.position, frogProfiles["dart-frog"]);
      return target ? [{ nodeId: target.id, amount: patch.amount }] : [];
    });
  } else {
    food = feedingStations(graph).map((node) => ({
      nodeId: node.id,
      amount: 3,
    }));
  }
  return new Ecosystem(graph, animals, { elapsed: snapshot?.elapsed, food });
}
export function feedingStations(graph: HabitatGraph) {
  const ground = [...graph.nodes.values()].filter(
    (n) => n.surface === "ground" && !n.wet,
  );
  const selected: HabitatNode[] = [];
  for (const node of ground.sort((a, b) => b.shelter - a.shelter)) {
    if (
      selected.every((other) => distance(other.position, node.position) > 1.2)
    )
      selected.push(node);
    if (selected.length === 3) break;
  }
  return selected;
}
