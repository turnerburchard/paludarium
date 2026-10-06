import type { World } from "../model/schema";
import { assets, isLandAnimal, objectDens, plantPerches } from "../assets";
import { plantCondition } from "../model/plants";
import { groundHeight, placementProblem } from "../model/terrain";
import { objectBase } from "../model/stacking";
import { transformPlantPoint } from "../model/plantSurfaces";
import { FishSchool } from "./fish";
import { Ecosystem } from "./engine";
import { HabitatGraph, distance } from "./navigation";
import type {
  AnimalSeed,
  HabitatNode,
  FoodPatch,
  SpeciesProfile,
  Vec3,
} from "./types";

/** Insect colonies are at least this far apart. */
const COLONY_SPACING = 1;

/** Food sits on ground any frog can reach. */
const groundWalker: SpeciesProfile = {
  id: "ground",
  nocturnal: false,
  climbs: false,
  speed: 1,
};

/** Conservative ground navigation. The graph describes surfaces, not animal mesh anatomy. */
export function buildHabitat(world: World): HabitatGraph {
  const env = world.environment,
    nodes: HabitatNode[] = [],
    grid = new Map<string, HabitatNode>();
  const clearance = Math.max(
    0.16,
    ...world.objects
      .filter((o) => isLandAnimal(o.kind))
      .map((o) => assets[o.kind].radius * o.scale),
  );
  const margin = clearance + 0.08,
    spacing = 0.32;
  const nx = Math.ceil((env.width - 2 * margin) / spacing),
    nz = Math.ceil((env.depth - 2 * margin) / spacing);
  const obstacles = world.objects.filter((o) => assets[o.kind].blocksMovement);
  // A struggling plant still gives some cover, just much less.
  const shelters = world.objects
    .filter((o) => assets[o.kind].shelter)
    .map((o) => ({
      ...o,
      vigor: plantCondition(o, env)?.thriving === false ? 0.4 : 1,
    }));
  for (let ix = 0; ix <= nx; ix++)
    for (let iz = 0; iz <= nz; iz++) {
      const x = -env.width / 2 + margin + (ix * (env.width - 2 * margin)) / nx;
      const z = -env.depth / 2 + margin + (iz * (env.depth - 2 * margin)) / nz;
      const y = groundHeight(x, z, env);
      // Shallow shoreline is reachable; open/deep water is not a frog walking surface.
      if (env.water - y > 0.025) continue;
      const solid = obstacles.some(
        (o) =>
          Math.hypot(x - o.x, z - o.z) <
          assets[o.kind].radius * o.scale + clearance,
      );
      if (solid) continue;
      const shelter = shelters.reduce(
        (best, o) =>
          Math.max(
            best,
            o.vigor *
              (1 -
                Math.hypot(x - o.x, z - o.z) /
                  (assets[o.kind].radius * o.scale + 0.4)),
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
  const groundNodes = nodes.filter((node) => node.surface === "ground");
  /** The nearest ground node within range of a point, if the way between stays dry. */
  const dryAnchor = (point: Vec3, range: number) => {
    const anchor = groundNodes.reduce<HabitatNode | undefined>(
      (best, node) =>
        !best || distance(node.position, point) < distance(best.position, point)
          ? node
          : best,
      undefined,
    );
    if (!anchor || distance(anchor.position, point) > range) return undefined;
    const dry = Array.from({ length: 6 }, (_, i) => i / 5).every(
      (t) =>
        groundHeight(
          anchor.position.x + (point.x - anchor.position.x) * t,
          anchor.position.z + (point.z - anchor.position.z) * t,
          env,
        ) >=
        env.water - 0.025,
    );
    return dry ? anchor : undefined;
  };
  const up = { x: 0, y: 1, z: 0 };
  for (const object of world.objects) {
    const baseY = objectBase(object, env);
    if (baseY < env.water + 0.025) continue;
    // Normals turn with the object but don't move or scale.
    const turn = (v: Vec3) =>
      transformPlantPoint(v, { ...object, x: 0, z: 0, scale: 1 });
    for (const [routeIndex, route] of plantPerches(object).entries()) {
      const perch = transformPlantPoint(route.perch, object, baseY);
      if (
        Math.abs(perch.x) > env.width / 2 - 0.08 ||
        Math.abs(perch.z) > env.depth / 2 - 0.08
      )
        continue;
      const anchor = dryAnchor(
        transformPlantPoint(route.stem[0], object, baseY),
        0.65,
      );
      if (!anchor) continue;
      const stem = [
        anchor.position,
        ...route.stem.map((point) => transformPlantPoint(point, object, baseY)),
      ];
      const barkNormals = route.barkNormals && [
        up,
        ...route.barkNormals.map(turn),
      ];
      let previous = anchor;
      // Every edge is short enough to climb rather than crossing empty air.
      for (let segment = 0; segment < stem.length - 1; segment++) {
        const from = stem[segment],
          to = stem[segment + 1];
        const steps = Math.max(1, Math.ceil(distance(from, to) / 0.18));
        for (let step = 1; step <= steps; step++) {
          const t = step / steps;
          const position = {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + (to.z - from.z) * t,
          };
          const node: HabitatNode = {
            id: `plant:${object.id}:${routeIndex}:${segment}:${step}`,
            position,
            normal: barkNormals
              ? blend(barkNormals[segment], barkNormals[segment + 1], t)
              : outward(to, object),
            surface: barkNormals ? "bark" : "stem",
            wet: false,
            shelter: 0.3,
            perchHeight: position.y - baseY,
            plantId: object.id,
            neighbors: [previous.id],
          };
          previous.neighbors.push(node.id);
          nodes.push(node);
          previous = node;
        }
      }
      const node: HabitatNode = {
        id: `${barkNormals ? "bark" : "leaf"}:${object.id}:${routeIndex}`,
        position: perch,
        normal: turn(route.perchNormal),
        surface: barkNormals ? "bark" : "leaf",
        wet: false,
        shelter: barkNormals ? 0.5 : 1,
        perchHeight: route.perch.y * object.scale,
        plantId: object.id,
        neighbors: [previous.id],
      };
      previous.neighbors.push(node.id);
      nodes.push(node);
    }
    // A den is reached through its entrance and is fully sheltered inside.
    for (const [denIndex, den] of objectDens(object).entries()) {
      const [entrance, inside] = [den.entrance, den.inside].map((point) => {
        const { x, z } = transformPlantPoint(point, object);
        return {
          x,
          y:
            groundHeight(x, z, env) +
            (object.lift ?? 0) +
            point.y * object.scale,
          z,
        };
      });
      const anchor = dryAnchor(entrance, 0.6);
      if (!anchor || entrance.y < env.water + 0.025) continue;
      let previous = anchor;
      for (const [part, position, shelter] of [
        ["entrance", entrance, 0.6],
        ["inside", inside, 1],
      ] as const) {
        const node: HabitatNode = {
          id: `den:${object.id}:${denIndex}:${part}`,
          position,
          normal: up,
          surface: "ground",
          wet: env.water > 0 && position.y <= env.water + 0.065,
          shelter,
          neighbors: [previous.id],
        };
        previous.neighbors.push(node.id);
        nodes.push(node);
        previous = node;
      }
    }
  }
  const perches = nodes.filter((node) => node.surface === "leaf");
  for (let i = 0; i < perches.length; i++)
    for (let j = i + 1; j < perches.length; j++)
      if (distance(perches[i].position, perches[j].position) <= 0.65) {
        perches[i].neighbors.push(perches[j].id);
        perches[j].neighbors.push(perches[i].id);
      }
  return new HabitatGraph(nodes);
}

/** Plant stems face away from the plant's center. */
function outward(point: Vec3, object: { x: number; z: number }): Vec3 {
  const x = point.x - object.x,
    z = point.z - object.z;
  const length = Math.hypot(x, z);
  return length > 0
    ? { x: x / length, y: 0, z: z / length }
    : { x: 1, y: 0, z: 0 };
}

function blend(a: Vec3, b: Vec3, t: number): Vec3 {
  const x = a.x + (b.x - a.x) * t,
    y = a.y + (b.y - a.y) * t,
    z = a.z + (b.z - a.z) * t;
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

export function createWorldEcosystem(
  world: World,
  previous?: { world: World; engine: Ecosystem },
): Ecosystem {
  const graph = buildHabitat(world),
    snapshot = previous?.engine.snapshot();
  const animals: AnimalSeed[] = [];
  for (const object of world.objects) {
    const behavior = assets[object.kind].behavior;
    if (!behavior) continue;
    const species: SpeciesProfile = { id: object.kind, ...behavior };
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
  const colonies = insectColonies(graph);
  const food = new Map(
    colonies.map((colony) => [
      colony.nodeId,
      { ...colony, amount: snapshot ? 0 : colony.capacity },
    ]),
  );
  // Insects survive edits. Edits can shift where colonies sit, so an old
  // colony's insects move to the nearest new colony within the spacing
  // between colonies; anything else stays where it was as scattered food.
  for (const patch of snapshot?.food ?? []) {
    const position = previous!.engine.graph.node(patch.nodeId).position;
    const colony =
      patch.capacity > 0
        ? nearestWithin(colonies, graph, position, COLONY_SPACING)
        : undefined;
    const nodeId = colony?.nodeId ?? graph.nearest(position, groundWalker)?.id;
    if (!nodeId) continue;
    const target = food.get(nodeId) ?? { nodeId, amount: 0, capacity: 0 };
    target.amount += patch.amount;
    food.set(nodeId, target);
  }
  return new Ecosystem(graph, animals, {
    elapsed: snapshot?.elapsed,
    discoveries: snapshot?.discoveries,
    food: [...food.values()],
  });
}
/** Fish keep their place through ordinary edits; a fish that was moved, or
 * whose spot is no longer water, starts again where it was placed. */
export function createFishSchool(
  world: World,
  previous?: { world: World; fish: FishSchool },
): FishSchool {
  const env = world.environment;
  const swimmers = world.objects.flatMap((object) => {
    const swims = assets[object.kind].swims;
    return swims ? [{ object, swims }] : [];
  });
  const margin = Math.max(
    0,
    ...swimmers.map(({ object }) => assets[object.kind].radius),
  );
  // Every swimmer shares the open-water placement rule.
  const isWater = (x: number, z: number) =>
    Math.abs(x) < env.width / 2 - margin &&
    Math.abs(z) < env.depth / 2 - margin &&
    !placementProblem("fish", x, z, env);
  const fish = swimmers.map(({ object, swims }) => {
    const old = previous?.world.objects.find((o) => o.id === object.id);
    const swimming = previous?.fish.get(object.id);
    const unmoved = old && old.x === object.x && old.z === object.z;
    if (swimming && unmoved && isWater(swimming.x, swimming.z)) return swimming;
    return {
      id: object.id,
      species: object.kind,
      speed: swims.speed,
      x: object.x,
      z: object.z,
      heading: object.rotation,
    };
  });
  return new FishSchool(fish, isWater);
}

/** Insects breed under cover: well-sheltered dry ground becomes a colony whose
 * size follows how much cover it has. Bare ground supports none. */
export function insectColonies(graph: HabitatGraph): FoodPatch[] {
  return shelteredSpots(graph, 8, COLONY_SPACING, 0.3).map((node) => ({
    nodeId: node.id,
    amount: 0,
    capacity: 5 * node.shelter,
  }));
}

function nearestWithin(
  colonies: readonly FoodPatch[],
  graph: HabitatGraph,
  position: HabitatNode["position"],
  range: number,
) {
  let best: FoodPatch | undefined,
    bestDistance = range;
  for (const colony of colonies) {
    const d = distance(graph.node(colony.nodeId).position, position);
    if (d < bestDistance) {
      best = colony;
      bestDistance = d;
    }
  }
  return best;
}

/** The most sheltered dry ground spots, kept a minimum distance apart. */
function shelteredSpots(
  graph: HabitatGraph,
  count: number,
  spacing: number,
  minShelter = 0,
) {
  const ground = [...graph.nodes.values()].filter(
    (n) => n.surface === "ground" && !n.wet && n.shelter >= minShelter,
  );
  const selected: HabitatNode[] = [];
  for (const node of ground.sort((a, b) => b.shelter - a.shelter)) {
    if (
      selected.every(
        (other) => distance(other.position, node.position) > spacing,
      )
    )
      selected.push(node);
    if (selected.length === count) break;
  }
  return selected;
}
