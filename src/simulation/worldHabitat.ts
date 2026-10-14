import { type HabitatChanges, objectBounds } from "./habitatChanges";
import { finishWork } from "../work";
import {
  MAX_SCALE,
  assetKinds,
  type Environment,
  type HabitatObject,
  type World,
} from "../model/schema";
import {
  animalBodySteps,
  assetRadius,
  assets,
  isAnimal,
  isLandAnimal,
  objectDens,
  plantPerches,
} from "../assets";
import { plantCondition } from "../model/plants";
import { groundHeight } from "../model/terrain";
import { objectBase } from "../model/stacking";
import { streamSurface, swimmingHeight, waterLevel } from "../model/water";
import { transformPlantPoint } from "../model/plantSurfaces";
import type { Fish } from "./fish";
import { SwimSpace } from "./swimSpace";
import { WIDEST_ROOM } from "./waterNodes";
import { HabitatNodeGrid } from "./nodeGrid";
import { LandSurfaces } from "./landSurfaces";
import { PlantObstacles } from "./plantObstacles";
import { Solids } from "./solids";
import { Ecosystem } from "./engine";
import { readyToBreed, youngAndParents } from "./lifeCycle";
import type { Body } from "./bodyPose";
import { juvenileScale } from "../model/life";
import { HabitatGraph, distance } from "./navigation";
import type {
  AnimalSeed,
  AnimalState,
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

/** Every land animal gets at least this much room, however small. */
const CLEARANCE = 0.16;
/** Room is measured outward in steps of this size. */
const ROOM_STEP = 0.04;
/** The most room any animal can need: the biggest at its largest size. */
const LARGEST_FOOTPRINT =
  Math.max(
    ...assetKinds.filter(isLandAnimal).map((kind) => assetRadius(kind)),
  ) * MAX_SCALE;

/** The widest gap of water a hopping frog leaps. */
const LEAP = 0.6;

/** Larger animals step off stone, reach plants and climb the glass from
 * farther out. Rather than a way for every size, each band of room gets
 * one, each band half again as wide as the last. */
const roomBand = (room: number) =>
  Math.floor(Math.log(room / CLEARANCE) / Math.log(1.5));

/** Room left before an animal's footprint, plus a little air, meets the glass. */
function wallRoom(x: number, z: number, env: Environment) {
  return (
    Math.min(env.width / 2 - Math.abs(x), env.depth / 2 - Math.abs(z)) - 0.08
  );
}

/** The largest footprint that fits on the ground here, probing farther out
 * until stone or wood is in the way. The spot is clear at CLEARANCE. */
function groundRoom(
  surfaces: LandSurfaces,
  x: number,
  z: number,
  env: Environment,
) {
  const wall = wallRoom(x, z, env);
  let room = CLEARANCE;
  for (
    let r = CLEARANCE + ROOM_STEP;
    r <= Math.min(wall, LARGEST_FOOTPRINT);
    r += ROOM_STEP
  ) {
    if (surfaces.blocksGround(x, z, r)) return room;
    room = r;
  }
  return wall;
}

const hasFish = (world: World) =>
  world.objects.some((object) => assets[object.kind].swims);

/** Animals come and go without changing the surfaces, since each one checks
 * the room it needs as it moves. Only the first fish or the last changes
 * them, by opening or closing the water. */
function sameHabitat(a: World, b: World) {
  if (a.environment !== b.environment || hasFish(a) !== hasFish(b))
    return false;
  const objects = a.objects.filter((object) => !isAnimal(object.kind));
  const next = b.objects.filter((object) => !isAnimal(object.kind));
  return (
    objects.length === next.length &&
    objects.every((object, i) => object === next[i])
  );
}

/** Conservative ground navigation. The graph describes surfaces, not animal mesh anatomy. */
export function buildHabitat(
  world: World,
  solids = new Solids(world),
): HabitatGraph {
  return finishWork(buildHabitatSteps(world, solids));
}
interface ObjectRoutes {
  nodes: HabitatNode[];
  links: [string, string][];
}
interface HabitatParts {
  objects: Map<string, ObjectRoutes>;
  landChecks: Map<string, boolean>;
  connections: Map<string, [string, string][]>;
  leaps: Map<string, string[]>;
  plants: PlantObstacles;
  water?: SwimSpace;
}
const habitatParts = new WeakMap<HabitatGraph, HabitatParts>();
interface EarlierHabitat {
  graph: HabitatGraph;
  changes: HabitatChanges;
}
export function* buildHabitatSteps(
  world: World,
  solids: Solids,
  earlier?: EarlierHabitat,
): Generator<void, HabitatGraph> {
  const oldParts = earlier && habitatParts.get(earlier.graph);
  const objects = new Map<string, ObjectRoutes>();
  const landChecks = new Map<string, boolean>();
  const connections = new Map<string, [string, string][]>();
  const leaps = new Map<string, string[]>();
  const env = world.environment,
    nodes: HabitatNode[] = [],
    grid = new Map<string, HabitatNode>();
  const margin = CLEARANCE + 0.08,
    spacing = 0.32;
  const nx = Math.ceil((env.width - 2 * margin) / spacing),
    nz = Math.ceil((env.depth - 2 * margin) / spacing);
  const surfaces = solids.surfaces;
  // Reaching half a spacing past a stream's edge, even a trickle between
  // two rows of nodes wets one of them.
  const streamLevelAt = streamSurface(env, spacing / 2);
  // A struggling plant still gives some cover, just much less.
  const shelters = world.objects
    .filter((o) => assets[o.kind].shelter)
    .map((o) => ({
      ...o,
      vigor: plantCondition(o, env)?.thriving === false ? 0.4 : 1,
    }));
  for (let ix = 0; ix <= nx; ix++)
    for (let iz = 0; iz <= nz; iz++) {
      yield;
      const x = -env.width / 2 + margin + (ix * (env.width - 2 * margin)) / nx;
      const z = -env.depth / 2 + margin + (iz * (env.depth - 2 * margin)) / nz;
      const old = earlier?.graph.nodes.get(`g:${ix}:${iz}`);
      if (
        old &&
        !earlier!.changes.touches({ x, z }, LARGEST_FOOTPRINT + spacing / 2)
      ) {
        const node = { ...old, neighbors: [], leaps: undefined };
        grid.set(`${ix}:${iz}`, node);
        nodes.push(node);
        continue;
      }
      const y = groundHeight(x, z, env);
      if (surfaces.blocksGround(x, z, CLEARANCE)) continue;
      const shelter = shelters.reduce(
        (best, o) =>
          Math.max(
            best,
            o.vigor *
              (1 -
                Math.hypot(x - o.x, z - o.z) /
                  (assetRadius(o.kind) * o.scale + 0.4)),
          ),
        0,
      );
      // Animals wade in streams rather than swim, so a stream bed is wet
      // but never submerged.
      const streamLevel = streamLevelAt(x, z);
      const level = waterLevel(x, z, env);
      const node: HabitatNode = {
        id: `g:${ix}:${iz}`,
        position: { x, y, z },
        normal: { x: 0, y: 1, z: 0 },
        surface: "ground",
        wet:
          y <= level + 0.065 ||
          (streamLevel !== null && y <= streamLevel + 0.065),
        // Shallow shoreline is dry enough for land animals.
        submerged: level - y > 0.025,
        shelter,
        room: groundRoom(surfaces, x, z, env),
        neighbors: [],
      };
      grid.set(`${ix}:${iz}`, node);
      nodes.push(node);
    }
  for (let ix = 0; ix <= nx; ix++)
    for (let iz = 0; iz <= nz; iz++) {
      yield;
      const node = grid.get(`${ix}:${iz}`);
      if (!node) continue;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const neighbor = grid.get(`${ix + dx}:${iz + dz}`);
        if (!neighbor) continue;
        // Diagonals cannot cut a corner around blocked cells, or one too
        // tight for an animal that fits at both ends.
        const corners = [
          grid.get(`${ix + dx}:${iz}`),
          grid.get(`${ix}:${iz + dz}`),
        ];
        if (
          dx &&
          dz &&
          corners.some(
            (corner) =>
              !corner || corner.room! < Math.min(node.room!, neighbor.room!),
          )
        )
          continue;
        if (
          Math.abs(node.position.y - neighbor.position.y) < 0.2 &&
          surfaces.clearRoute(node.position, neighbor.position)
        )
          node.neighbors.push(neighbor.id);
      }
    }
  // Wall ladders start on dry boundary cells, with an explicit bridge to the glass.
  // No ladder crosses a pond; non-climbing species cannot enter these nodes.
  for (const ground of [...nodes]) {
    yield;
    if (ground.submerged) continue;
    const [ix, iz] = ground.id.split(":").slice(1).map(Number);
    const sides: Array<{
      tag: string;
      x: number;
      z: number;
      normal: { x: number; y: number; z: number };
      inward: { x: number; z: number };
    }> = [];
    if (ix === 0)
      sides.push({
        tag: "left",
        x: -env.width / 2 + 0.05,
        z: ground.position.z,
        normal: { x: 1, y: 0, z: 0 },
        inward: { x: 1, z: 0 },
      });
    if (ix === nx)
      sides.push({
        tag: "right",
        x: env.width / 2 - 0.05,
        z: ground.position.z,
        normal: { x: -1, y: 0, z: 0 },
        inward: { x: -1, z: 0 },
      });
    if (iz === 0)
      sides.push({
        tag: "back",
        x: ground.position.x,
        z: -env.depth / 2 + 0.05,
        normal: { x: 0, y: 0, z: 1 },
        inward: { x: 0, z: 1 },
      });
    if (iz === nz)
      sides.push({
        tag: "front",
        x: ground.position.x,
        z: env.depth / 2 - 0.05,
        normal: { x: 0, y: 0, z: -1 },
        inward: { x: 0, z: -1 },
      });
    for (const side of sides) {
      // Larger climbers can't stand on the edge cell, so the first cells in
      // from it with more room get ladders of their own.
      let band = -1;
      for (let step = 0; band < roomBand(LARGEST_FOOTPRINT); step++) {
        const cell = grid.get(
          `${ix + side.inward.x * step}:${iz + side.inward.z * step}`,
        );
        if (!cell || cell.submerged) break;
        const foot = { x: side.x, y: cell.position.y, z: side.z };
        if (
          roomBand(cell.room!) <= band ||
          (step && !surfaces.clearRoute(cell.position, foot))
        )
          continue;
        band = roomBand(cell.room!);
        let previous = cell;
        for (let level = 0; level < 5; level++) {
          const node: HabitatNode = {
            id: `wall:${side.tag}:${cell.id}:${level}`,
            position: { ...foot, y: foot.y + level * 0.28 },
            normal: side.normal,
            surface: "glass",
            wet: false,
            shelter: cell.shelter * 0.7,
            neighbors: [previous.id],
          };
          previous.neighbors.push(node.id);
          // A climbing frog can leap from the ground straight onto the
          // glass, and back down, as well as walking up to it.
          if (level === 1) {
            (cell.leaps ??= []).push(node.id);
            node.leaps = [cell.id];
          }
          nodes.push(node);
          previous = node;
        }
      }
    }
  }
  const groundNodes = nodes.filter((node) => node.surface === "ground");
  const groundGrid = new HabitatNodeGrid(groundNodes, spacing);
  const hardscapeNodes = yield* surfaces.routeSteps(margin);
  for (const node of hardscapeNodes)
    node.room = wallRoom(node.position.x, node.position.z, env);
  nodes.push(...hardscapeNodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  let connecting: [string, string][] = [];
  const connect = (a: HabitatNode, b: HabitatNode) => {
    if (!surfaces.clearRoute(a.position, b.position)) return false;
    a.neighbors.push(b.id);
    b.neighbors.push(a.id);
    connecting.push([a.id, b.id]);
    return true;
  };
  // Nearby mesh surfaces can meet across a stack, while isolated or floating
  // pieces remain disconnected. Spatial buckets avoid comparing every pair.
  const buckets = new Map<number, HabitatNode[]>();
  const bucketSize = 0.16;
  /** A bucket's number. Tanks are far fewer than 512 buckets across. */
  const bucketKey = (x: number, y: number, z: number) =>
    (x * 1024 + y) * 1024 + z;
  /** How far an animal steps off stone onto ground with this much room. */
  const reach = (room: number) => spacing + room + 0.06;
  /** Stepping off stone onto dry ground keeps to dry ground or the stone
   * itself, rather than striding over a pond in the air. */
  const overLand = (from: Vec3, to: Vec3) => {
    const key = `${from.x},${from.y},${from.z}:${to.x},${to.y},${to.z}`;
    const cached = earlier?.changes.crosses(from, to)
      ? undefined
      : oldParts?.landChecks.get(key);
    if (typeof cached === "boolean") {
      landChecks.set(key, cached);
      return cached;
    }
    const result = checkLand(from, to);
    landChecks.set(key, result);
    return result;
  };
  const checkLand = (from: Vec3, to: Vec3) => {
    const steps = Math.ceil(distance(from, to) / 0.08);
    for (let i = 1; i < steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const z = from.z + ((to.z - from.z) * i) / steps;
      if (
        groundHeight(x, z, env) < waterLevel(x, z, env) - 0.025 &&
        !surfaces.at(x, z)
      )
        return false;
    }
    return true;
  };
  for (const node of hardscapeNodes) {
    yield;
    const cell = [node.position.x, node.position.y, node.position.z].map((n) =>
      Math.floor(n / bucketSize),
    );
    const known = oldParts?.connections.get(node.id);
    if (
      known &&
      !earlier!.changes.touches(
        node.position,
        reach(LARGEST_FOOTPRINT) + Math.max(LARGEST_FOOTPRINT, OPEN),
      )
    ) {
      for (const [from, to] of known) {
        nodesById.get(from)!.neighbors.push(to);
        nodesById.get(to)!.neighbors.push(from);
      }
      connections.set(node.id, known);
      const key = bucketKey(cell[0], cell[1], cell[2]);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(node);
      else buckets.set(key, [node]);
      continue;
    }
    connecting = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const other of buckets.get(
            bucketKey(cell[0] + dx, cell[1] + dy, cell[2] + dz),
          ) ?? [])
            if (
              node.supportId !== other.supportId &&
              distance(node.position, other.position) <= 0.13
            )
              connect(node, other);
    const key = bucketKey(cell[0], cell[1], cell[2]);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(node);
    else buckets.set(key, [node]);
    // Ground right beside the stone, then the nearest ground in each wider
    // band of room, for larger animals that step off from farther away.
    let band = -1;
    for (const { ground, d } of groundGrid
      .near(
        node.position,
        reach(LARGEST_FOOTPRINT),
        (ground) =>
          Math.abs(node.position.y - ground.position.y) <= 0.18 &&
          distance(node.position, ground.position) <= reach(ground.room!),
      )
      .map((ground) => ({
        ground,
        d: distance(node.position, ground.position),
      }))
      .sort((a, b) => a.d - b.d)) {
      const beside = d <= reach(CLEARANCE);
      if (!beside && roomBand(ground.room!) <= band) continue;
      if (!ground.submerged && !overLand(node.position, ground.position))
        continue;
      // One try per band keeps far sides of the stone from retrying every
      // cell out to the glass.
      if (connect(node, ground) || !beside)
        band = Math.max(band, roomBand(ground.room!));
    }
    connections.set(node.id, connecting);
  }
  // Frogs cross a narrow channel by leaping between dry ground and the flat
  // tops of stone and wood on either side, rather than wading.
  const landings = [...groundNodes, ...hardscapeNodes].filter(
    (node) => !node.submerged && node.normal.y >= 0.85,
  );
  const landingGrid = new HabitatNodeGrid(landings, LEAP);
  for (const node of landings) {
    yield;
    const known = oldParts?.leaps.get(node.id);
    if (known && !earlier!.changes.touches(node.position, LEAP + OPEN)) {
      for (const id of known) {
        (node.leaps ??= []).push(id);
        (nodesById.get(id)!.leaps ??= []).push(node.id);
      }
      leaps.set(node.id, known);
      continue;
    }
    const targets: string[] = [];
    for (const other of landingGrid.near(
      node.position,
      LEAP,
      (other) =>
        node.id < other.id &&
        distance(node.position, other.position) <= LEAP &&
        Math.abs(node.position.y - other.position.y) <= 0.18,
    ))
      if (
        !overLand(node.position, other.position) &&
        surfaces.clearRoute(node.position, other.position)
      ) {
        targets.push(other.id);
        (node.leaps ??= []).push(other.id);
        (other.leaps ??= []).push(node.id);
      }
    leaps.set(node.id, targets);
  }
  const anchors = new HabitatNodeGrid(
    [...groundNodes, ...hardscapeNodes],
    0.65,
  );
  /** Stems and dens start on a nearby dry surface at their actual base,
   * including the top of a support. Never bridge up through stacked stone.
   * Larger animals don't fit everywhere, so the base also joins the nearest
   * surfaces with more room. */
  const dryAnchors = (point: Vec3, range: number) => {
    const found: HabitatNode[] = [];
    for (const node of anchors
      .near(
        point,
        range,
        (node) =>
          !node.submerged &&
          distance(node.position, point) <= range &&
          Math.abs(node.position.y - point.y) <= 0.18,
      )
      .sort(
        (a, b) =>
          Number(a.surface !== "ground") - Number(b.surface !== "ground") ||
          distance(a.position, point) - distance(b.position, point),
      ))
      if (
        (!found.length ||
          roomBand(node.room!) > roomBand(found[found.length - 1].room!)) &&
        surfaces.clearRoute(node.position, point)
      )
        found.push(node);
    return found;
  };
  function* objectRoutes(object: HabitatObject): Generator<void, ObjectRoutes> {
    const nodes: HabitatNode[] = [];
    const links: [string, string][] = [];
    const link = (a: HabitatNode, b: HabitatNode) => {
      links.push([a.id, b.id]);
      b.neighbors.push(a.id);
    };
    const up = { x: 0, y: 1, z: 0 };
    const baseY = objectBase(object, env);
    if (baseY < waterLevel(object.x, object.z, env) + 0.025)
      return { nodes, links };
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
      const contact = (position: Vec3, normal: Vec3) =>
        assets[object.kind].buildStructure
          ? surfaces.plantContact(position, normal, object.id)
          : { position, normal };
      const first = contact(
        transformPlantPoint(route.stem[0], object, baseY),
        outward(
          transformPlantPoint(route.stem[1] ?? route.stem[0], object, baseY),
          object,
        ),
      );
      if (assets[object.kind].buildStructure)
        first.position.y = Math.max(
          first.position.y,
          groundHeight(first.position.x, first.position.z, env) + 0.02,
        );
      const [anchor, ...wider] = dryAnchors(first.position, 0.65);
      if (!anchor) continue;
      const stem = [
        anchor.position,
        first.position,
        ...route.stem
          .slice(1)
          .map((point) => transformPlantPoint(point, object, baseY)),
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
        const spacing = assets[object.kind].buildStructure ? 0.04 : 0.18;
        const steps = Math.max(1, Math.ceil(distance(from, to) / spacing));
        for (let step = 1; step <= steps; step++) {
          const t = step / steps;
          const position = {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + (to.z - from.z) * t,
          };
          const normal = barkNormals
            ? blend(barkNormals[segment], barkNormals[segment + 1], t)
            : outward(to, object);
          const approach = segment === 0 && step < steps;
          if (approach && anchor.surface === "ground")
            position.y = groundHeight(position.x, position.z, env);
          const onSurface = approach
            ? { position, normal: anchor.normal }
            : barkNormals
              ? { position, normal }
              : contact(position, normal);
          const node: HabitatNode = {
            id: `plant:${object.id}:${routeIndex}:${segment}:${step}`,
            position: onSurface.position,
            normal: onSurface.normal,
            surface: barkNormals ? "bark" : "stem",
            wet: false,
            shelter: 0.3,
            perchHeight: position.y - groundHeight(position.x, position.z, env),
            plantId: object.id,
            neighbors: [previous.id],
          };
          if (previous === anchor) links.push([previous.id, node.id]);
          else previous.neighbors.push(node.id);
          if (previous === anchor) for (const other of wider) link(other, node);
          nodes.push(node);
          previous = node;
        }
      }
      const node: HabitatNode = {
        id: `${barkNormals ? "bark" : "leaf"}:${object.id}:${routeIndex}`,
        position: perch,
        normal: turn(route.perchNormal),
        supportWidth:
          route.perchWidth === undefined
            ? undefined
            : route.perchWidth * object.scale,
        surface: barkNormals ? "bark" : "leaf",
        wet: false,
        shelter: barkNormals ? 0.5 : 1,
        perchHeight: perch.y - groundHeight(perch.x, perch.z, env),
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
      const [anchor, ...wider] = dryAnchors(entrance, 0.6);
      if (
        !anchor ||
        entrance.y < waterLevel(entrance.x, entrance.z, env) + 0.025
      )
        continue;
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
          wet: position.y <= waterLevel(position.x, position.z, env) + 0.065,
          shelter,
          neighbors: [previous.id],
        };
        if (previous === anchor) links.push([previous.id, node.id]);
        else previous.neighbors.push(node.id);
        if (previous === anchor) for (const other of wider) link(other, node);
        nodes.push(node);
        previous = node;
      }
    }
    return { nodes, links };
  }
  const anchorsById = new Map(nodes.map((node) => [node.id, node]));
  for (const object of world.objects) {
    yield;
    if (isAnimal(object.kind)) continue;
    const known = oldParts?.objects.get(object.id);
    const part =
      known &&
      !earlier!.changes.intersects(
        objectBounds(object),
        LARGEST_FOOTPRINT + spacing / 25,
      )
        ? known
        : yield* objectRoutes(object);
    objects.set(object.id, part);
    for (const node of part.nodes)
      nodes.push({
        ...node,
        neighbors: [...node.neighbors],
        leaps: node.leaps && [...node.leaps],
      });
    for (const [from, to] of part.links)
      anchorsById.get(from)!.neighbors.push(to);
  }
  const perches = nodes.filter((node) => node.surface === "leaf");
  const perchGrid = new HabitatNodeGrid(perches, 0.65);
  const perchOrder = new Map(perches.map((node, index) => [node.id, index]));
  for (const [i, perch] of perches.entries())
    for (const other of perchGrid.near(perch.position, 0.65))
      if (
        perchOrder.get(other.id)! > i &&
        distance(perch.position, other.position) <= 0.65
      ) {
        perch.neighbors.push(other.id);
        other.neighbors.push(perch.id);
      }
  for (const node of nodes) {
    yield;
    const old = earlier?.graph.nodes.get(node.id);
    if (
      old &&
      distance(old.position, node.position) < 1e-9 &&
      !earlier!.changes.touches(node.position, OPEN)
    ) {
      node.headroom = old.headroom;
      node.width = old.width;
    } else {
      delete node.headroom;
      delete node.width;
      measureSpace(node, solids);
    }
  }
  const water = hasFish(world)
    ? yield* SwimSpace.build(world, oldParts?.water)
    : undefined;
  if (water)
    nodes.push(
      ...(yield* water.routeSteps(earlier?.graph.nodes, earlier?.changes)),
    );
  const plants = yield* PlantObstacles.build(
    world,
    surfaces,
    oldParts?.plants,
    earlier?.changes,
  );
  const graph = yield* HabitatGraph.build(nodes, (from, to, species) =>
    plants.cost(from, to, species),
  );
  habitatParts.set(graph, {
    objects,
    landChecks,
    connections,
    leaps,
    plants,
    water,
  });
  return graph;
}

function scaled(body: Body, scale: number): Body {
  return {
    length: body.length * scale,
    width: body.width * scale,
    height: body.height * scale,
  };
}

/** Space reaching past this is plenty for any animal. */
const OPEN = 0.6;

/** How far the space over a surface reaches before something solid, and
 * how wide a den is between its walls. */
function measureSpace(node: HabitatNode, solids: Solids) {
  const start = { ...node.position };
  start.x += node.normal.x * 0.005;
  start.y += node.normal.y * 0.005;
  start.z += node.normal.z * 0.005;
  const over = solids.cast(
    start,
    node.normal,
    OPEN,
    node.surface !== "ground" || !!node.supportId,
  );
  if (over) node.headroom = over.distance;
  if (!node.id.startsWith("den:")) return;
  // Just off the floor, in four directions across and their opposites.
  const low = { ...node.position, y: node.position.y + 0.03 };
  let width = Infinity;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 4;
    const across = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    const back = { x: -across.x, y: 0, z: -across.z };
    width = Math.min(
      width,
      (solids.cast(low, across, OPEN)?.distance ?? OPEN) +
        (solids.cast(low, back, OPEN)?.distance ?? OPEN),
    );
  }
  if (width < 2 * OPEN) node.width = width;
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
  random?: () => number,
): Ecosystem {
  return finishWork(createWorldEcosystemSteps(world, previous, random));
}
export function* createWorldEcosystemSteps(
  world: World,
  previous?: { world: World; engine: Ecosystem },
  random?: () => number,
): Generator<void, Ecosystem> {
  const reuse = previous && sameHabitat(previous.world, world);
  const solids =
    (reuse && previous.engine.solids) ||
    (yield* Solids.build(world, previous?.engine.solids));
  const graph = reuse
      ? previous.engine.graph
      : yield* buildHabitatSteps(world, solids),
    snapshot = previous?.engine.snapshot();
  const animals: AnimalSeed[] = [];
  const water = hasFish(world) ? yield* SwimSpace.build(world) : undefined;
  for (const object of world.objects) {
    yield;
    const fish =
      water && (yield* swimmingFish(world, object, water, graph, previous));
    if (fish) animals.push(fish);
    const animal = yield* landAnimalSeed(
      world,
      object,
      graph,
      previous,
      snapshot?.animals.find(
        (a) => a.id === object.id && a.speciesId === object.kind,
      ),
    );
    if (animal) animals.push(animal);
  }
  const food = yield* relocateFood(
    graph,
    previous?.engine.graph,
    snapshot?.food,
  );
  const engine = new Ecosystem(graph, animals, {
    random,
    water,
    solids,
    elapsed: snapshot?.elapsed,
    discoveries: snapshot?.discoveries,
    food,
  });
  engine.court(
    readyToBreed(world),
    previous?.engine.courtships ??
      world.objects.flatMap((object) =>
        object.courtship ? [{ id: object.id, ...object.courtship }] : [],
      ),
    () => false,
  );
  yield* engine.finishPlanning();
  engine.raise(youngAndParents(world));
  return engine;
}
function* landAnimalSeed(
  world: World,
  object: HabitatObject,
  graph: HabitatGraph,
  previous?: { world: World; engine: Ecosystem },
  oldState?: AnimalState,
): Generator<void, AnimalSeed | undefined> {
  const behavior = assets[object.kind].behavior;
  if (!behavior) return undefined;
  const species: SpeciesProfile = {
    id: object.kind,
    ...behavior,
    radius: assetRadius(object.kind) * object.scale,
    body: scaled(
      yield* animalBodySteps(object.kind, object.seed),
      object.scale * juvenileScale(object),
    ),
  };
  const oldObject = previous?.world.objects.find((o) => o.id === object.id);
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
  const node = yield* graph.nearestSteps(position, species);
  // An animal that visits the water still needs dry land to live on.
  const land =
    behavior.water !== "visits" ||
    (yield* graph.nearestSteps(position, { ...species, water: undefined }));
  if (node && land)
    return {
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
    };
  return undefined;
}

function* relocateFood(
  graph: HabitatGraph,
  previousGraph?: HabitatGraph,
  previousFood?: readonly FoodPatch[],
): Generator<void, FoodPatch[]> {
  const colonies = insectColonies(
    graph,
    previousFood
      ?.filter((patch) => patch.capacity > 0)
      .map((patch) => previousGraph!.node(patch.nodeId).position),
  );
  const food = new Map(
    colonies.map((colony) => [
      colony.nodeId,
      { ...colony, amount: previousFood ? 0 : colony.capacity },
    ]),
  );
  // Insects survive edits. Edits can shift where colonies sit, so an old
  // colony's insects move to the nearest new colony within the spacing
  // between colonies; anything else stays where it was as scattered food.
  for (const patch of previousFood ?? []) {
    yield;
    const position = previousGraph!.node(patch.nodeId).position;
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
  return [...food.values()];
}

/** Prepare a terrain edit without changing the running graph. Only animals
 * whose movement intersects the edit need a new starting state. */
export function* prepareHabitatEdit(
  world: World,
  previous: { world: World; engine: Ecosystem },
  changes: HabitatChanges,
): Generator<void, () => void> {
  const solids = yield* Solids.build(world, previous.engine.solids, changes);
  const graph = yield* buildHabitatSteps(world, solids, {
    graph: previous.engine.graph,
    changes,
  });
  const water = habitatParts.get(graph)!.water;
  const affected = new Set<string>();
  const prepared = new Set<string>();
  const animals: AnimalSeed[] = [];
  // Other animals can approach the edit while these seeds are prepared.
  // Once held, they cannot move again until publication.
  while (true) {
    for (const id of previous.engine.affectedByHabitat(changes))
      affected.add(id);
    const waiting = world.objects.filter(
      (object) =>
        isAnimal(object.kind) &&
        !prepared.has(object.id) &&
        (affected.has(object.id) || !previous.engine.getAnimal(object.id)),
    );
    if (!waiting.length) break;
    for (const object of waiting) {
      prepared.add(object.id);
      yield;
      const fish =
        water && (yield* swimmingFish(world, object, water, graph, previous));
      const land = yield* landAnimalSeed(
        world,
        object,
        graph,
        previous,
        previous.engine.getAnimal(object.id),
      );
      if (fish) animals.push(fish);
      if (land) animals.push(land);
    }
  }
  return () => {
    const engine = previous.engine;
    const food = finishWork(
      relocateFood(graph, engine.graph, engine.snapshot().food),
    );
    engine.replaceHabitat(graph, solids, water, affected, animals, food);
    engine.holdHabitat();
    engine.court(readyToBreed(world), [], () => false);
    engine.raise(youngAndParents(world));
  };
}

/** Ordinary edits preserve live fish. A moved fish starts where it was
 * placed; a newly blocked fish finds nearby clear water. A fish with no open
 * water anywhere is stranded and left out. */
function* swimmingFish(
  world: World,
  object: HabitatObject,
  water: SwimSpace,
  graph: HabitatGraph,
  previous?: { world: World; engine: Ecosystem },
): Generator<void, AnimalSeed | undefined> {
  const swims = assets[object.kind].swims;
  if (!swims) return undefined;
  const env = world.environment;
  const species: SpeciesProfile = {
    id: object.kind,
    nocturnal: false,
    climbs: false,
    speed: swims.speed,
    water: "lives",
    swims: {
      ...swims,
      room: Math.min(water.room(object.id), WIDEST_ROOM),
      height: water.height(object.id),
    },
  };
  const old = previous?.world.objects.find((o) => o.id === object.id);
  const swimming = previous?.engine.swimmer(object.id);
  const unmoved =
    swimming &&
    old &&
    old.kind === object.kind &&
    old.x === object.x &&
    old.z === object.z;
  const fish: Fish = unmoved
    ? {
        id: object.id,
        species: object.kind,
        speed: swims.speed,
        x: swimming.x,
        y: swimming.y,
        z: swimming.z,
        heading: swimming.heading + (object.rotation - old.rotation),
      }
    : {
        id: object.id,
        species: object.kind,
        speed: swims.speed,
        x: object.x,
        y: swimmingHeight(object.x, object.z, env, swims.depth),
        z: object.z,
        heading: object.rotation,
      };
  const start = (x: number, z: number, wanted: number, curl = 0) => {
    const y = water.steady(object.id, x, z, wanted).y;
    if (!water.canStart(object.id, x, y, z, fish.heading, { curl }))
      return undefined;
    const position = { ...fish, x, y, z };
    const node = graph.nearest(position, species);
    return node && { position, node };
  };
  // A fish curled in a tight turn has pushed into the leaves, so its own
  // spot is judged by the curled body it has there.
  let found = start(fish.x, fish.z, fish.y, unmoved ? swimming.curl : 0);
  // An edit may put stone or wood around a live fish. Only that fish moves
  // to the nearest available gap; the rest of the school stays put.
  const reach = Math.hypot(env.width, env.depth);
  for (let radius = 0.08; !found && radius < reach; radius += 0.08)
    for (let i = 0; !found && i < 32; i++) {
      yield;
      const angle = (i * Math.PI * 2) / 32;
      const x = fish.x + Math.cos(angle) * radius;
      const z = fish.z + Math.sin(angle) * radius;
      found = start(x, z, swimmingHeight(x, z, env, swims.depth));
    }
  if (!found) return undefined;
  const carriesOn =
    unmoved &&
    found.position.x === swimming.x &&
    found.position.y === swimming.y &&
    found.position.z === swimming.z &&
    fish.heading === swimming.heading;
  return {
    id: object.id,
    species,
    nodeId: found.node.id,
    needs: previous?.engine.getAnimal(object.id)?.needs,
    ...(carriesOn ? { swimmer: swimming } : { fish: found.position }),
  };
}

/** Insects breed under cover: well-sheltered dry ground becomes a colony whose
 * size follows how much cover it has. Bare ground supports none. */
/** Colonies that existed before an edit keep their place when there is still
 * shelter near it, so a resize or a small move does not scatter them. */
export function insectColonies(
  graph: HabitatGraph,
  previous: readonly HabitatNode["position"][] = [],
): FoodPatch[] {
  return shelteredSpots(graph, 8, COLONY_SPACING, 0.3, previous).map(
    (node) => ({
      nodeId: node.id,
      amount: 0,
      capacity: 5 * node.shelter,
    }),
  );
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
  anchors: readonly HabitatNode["position"][] = [],
) {
  const ground = [...graph.nodes.values()]
    .filter((n) => n.surface === "ground" && !n.wet && n.shelter >= minShelter)
    .sort((a, b) => b.shelter - a.shelter);
  const selected: HabitatNode[] = [];
  const add = (node: HabitatNode | undefined) => {
    if (
      node &&
      selected.length < count &&
      selected.every(
        (other) => distance(other.position, node.position) > spacing,
      )
    )
      selected.push(node);
  };
  for (const anchor of anchors)
    add(ground.find((node) => distance(node.position, anchor) < spacing));
  for (const node of ground) add(node);
  return selected;
}
