import { type HabitatChanges, objectBounds } from "./habitatChanges";
import { finishWork } from "../work";
import * as THREE from "three";
import { assets } from "../assets";
import {
  structuralShape,
  placeShape,
  type CollisionFace,
} from "../assets/collisionShape";
import {
  collisionTreeSteps,
  intersectsBox,
  visitRayFaces,
  type CollisionTree,
} from "../assets/collisionTree";
import type { HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { groundHeight } from "../model/terrain";
import { waterLevel } from "../model/water";
import type { HabitatNode, Vec3 } from "./types";

interface Solid {
  object: HabitatObject;
  bounds: THREE.Box3;
  faces: CollisionFace[];
  tree: CollisionTree;
  faceOrder: Map<CollisionFace, number>;
  base: number;
}

/** Whether a box reaches the box spanned by two points. */
function reaches(box: THREE.Box3, a: Vec3, b: Vec3) {
  return (
    Math.max(a.x, b.x) >= box.min.x &&
    Math.min(a.x, b.x) <= box.max.x &&
    Math.max(a.y, b.y) >= box.min.y &&
    Math.min(a.y, b.y) <= box.max.y &&
    Math.max(a.z, b.z) >= box.min.z &&
    Math.min(a.z, b.z) <= box.max.z
  );
}

/** Solid structure and firm walking surfaces. Overlapping objects expose
 * only their outer skin; soft leaves never obstruct land routes. */
export class LandSurfaces {
  readonly solids: Solid[];
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3(
    0.937,
    0.213,
    0.277,
  ).normalize();
  private readonly normal = new THREE.Vector3();
  private readonly down = new THREE.Vector3(0, -1, 0);
  /** Route and inside checks made for this world, by the points checked. */
  private readonly checks = new Map<string, boolean>();
  /** Each solid's sampled skin, before other solids cover any of it. */
  private readonly skins = new Map<HabitatObject, HabitatNode[]>();
  /** What is left of each solid's skin once others cover what they touch. */
  private readonly exposed = new Map<HabitatObject, HabitatNode[]>();
  /** The checks and skins from before an edit, and the bounds of every
   * solid it moved, added or removed. A check away from those still holds. */
  private readonly earlier?: {
    checks: Map<string, boolean>;
    skins: ReadonlyMap<HabitatObject, HabitatNode[]>;
    exposed: ReadonlyMap<HabitatObject, HabitatNode[]>;
    changed: THREE.Box3[];
  };

  /** Rebuilding the habitat after an edit repeats tens of thousands of these
   * checks, so with the surfaces from before the edit, only checks near what
   * changed are made again. Terrain edits supply their affected areas. */
  constructor(
    private readonly world: World,
    previous?: LandSurfaces,
    solids = finishWork(solidSteps(world)),
    private readonly changes?: HabitatChanges,
  ) {
    this.solids = solids;
    if (
      !previous ||
      (previous.world.environment !== world.environment && !changes)
    )
      return;
    const now = new Set(this.solids.map((solid) => solid.object));
    const before = new Set(previous.solids.map((solid) => solid.object));
    this.earlier = {
      checks: previous.checks,
      skins: previous.skins,
      exposed: previous.exposed,
      changed: [
        ...previous.solids.filter((solid) => !now.has(solid.object)),
        ...this.solids.filter((solid) => !before.has(solid.object)),
      ].map((solid) => solid.bounds),
    };
  }

  static *build(
    world: World,
    previous?: LandSurfaces,
    changes?: HabitatChanges,
  ): Generator<void, LandSurfaces> {
    return new LandSurfaces(
      world,
      previous,
      yield* solidSteps(world, previous),
      changes,
    );
  }

  /** A check between two points only depends on the ground, the water and
   * the solids whose bounds it reaches. */
  private remember(kind: string, a: Vec3, b: Vec3, check: () => boolean) {
    const key = `${kind}:${a.x},${a.y},${a.z},${b.x},${b.y},${b.z}`;
    const known = this.checks.get(key);
    if (known !== undefined) return known;
    let result = this.earlier?.checks.get(key);
    if (
      result === undefined ||
      this.changes?.crosses(a, b) ||
      this.earlier!.changed.some((bounds) => reaches(bounds, a, b))
    )
      result = check();
    this.checks.set(key, result);
    return result;
  }

  at(x: number, z: number, accepts?: (object: HabitatObject) => boolean) {
    let highest:
      | { position: Vec3; normal: Vec3; object: HabitatObject }
      | undefined;
    for (const solid of this.solids) {
      if (accepts && !accepts(solid.object)) continue;
      if (
        x < solid.bounds.min.x ||
        x > solid.bounds.max.x ||
        z < solid.bounds.min.z ||
        z > solid.bounds.max.z
      )
        continue;
      this.ray.set(new THREE.Vector3(x, solid.bounds.max.y + 1, z), this.down);
      const candidates: CollisionFace[] = [];
      visitRayFaces(solid.tree, this.ray, (face) => candidates.push(face));
      // Equal-height contacts keep the mesh's original tie breaks.
      candidates.sort(
        (a, b) => solid.faceOrder.get(a)! - solid.faceOrder.get(b)!,
      );
      for (const { triangle, bounds } of candidates) {
        if (
          x < bounds.min.x ||
          x > bounds.max.x ||
          z < bounds.min.z ||
          z > bounds.max.z
        )
          continue;
        if (
          !this.ray.intersectTriangle(
            triangle.a,
            triangle.b,
            triangle.c,
            true,
            this.hit,
          )
        )
          continue;
        if (highest && highest.position.y - 0.015 >= this.hit.y) continue;
        const normal = triangle.getNormal(new THREE.Vector3());
        if (normal.y < 0.05) continue;
        highest = {
          position: { x, y: this.hit.y + 0.015, z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          object: solid.object,
        };
      }
    }
    return highest;
  }

  /** Snap an authored stem contact onto its own visible structure, without
   * inflating a thin stem into a broad imaginary platform. */
  plantContact(point: Vec3, normal: Vec3, objectId: string) {
    const solid = this.solids.find((solid) => solid.object.id === objectId);
    if (!solid) return { position: point, normal };
    const origin = new THREE.Vector3(point.x, point.y, point.z);
    let closest = 0.1;
    let contact: { position: Vec3; normal: Vec3 } | undefined;
    for (const { triangle } of solid.faces) {
      const faceNormal = triangle.getNormal(new THREE.Vector3());
      if (
        faceNormal.x * normal.x +
          faceNormal.y * normal.y +
          faceNormal.z * normal.z <=
        0
      )
        continue;
      triangle.closestPointToPoint(origin, this.hit);
      const distance = this.hit.distanceTo(origin);
      if (distance >= closest) continue;
      closest = distance;
      const position = this.hit.clone().addScaledVector(faceNormal, 0.002);
      contact = {
        position: { x: position.x, y: position.y, z: position.z },
        normal: { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z },
      };
    }
    return contact ?? { position: point, normal };
  }

  blocksGround(x: number, z: number, clearance: number) {
    const floor = groundHeight(x, z, this.world.environment);
    const low = new THREE.Box3(
      new THREE.Vector3(x - clearance, floor + 0.025, z - clearance),
      new THREE.Vector3(x + clearance, floor + 0.065, z + clearance),
    );
    // A tall cap does not block the ground beneath it. Headroom and the
    // swept body query decide which animals actually fit under the cap.
    if (
      this.solids.some(
        (solid) =>
          !assets[solid.object.kind].hardscape &&
          !assets[solid.object.kind].groundCover &&
          intersectsBox(solid.tree, low),
      )
    )
      return true;
    if (this.inside({ x, y: floor + 0.045, z }, true)) return true;
    // Keep hardscape's established footprint probes and surface approaches.
    return [
      [0, 0],
      [clearance, 0],
      [-clearance, 0],
      [0, clearance],
      [0, -clearance],
    ].some(([dx, dz]) => {
      const surface = this.at(
        x + dx,
        z + dz,
        (object) => !!assets[object.kind].hardscape,
      );
      return (
        surface &&
        assets[surface.object.kind].hardscape &&
        surface.position.y > floor + 0.04
      );
    });
  }

  /** The skin of every solid that no other solid covers. */
  routes(margin: number): HabitatNode[] {
    return finishWork(this.routeSteps(margin));
  }
  *routeSteps(margin: number): Generator<void, HabitatNode[]> {
    const nodes: HabitatNode[] = [];
    for (const solid of this.solids) {
      yield;
      const asset = assets[solid.object.kind];
      // Low cover follows the ground or its supporting stone/wood route.
      // Its decorative lumps support bodies without adding navigation cells.
      if (asset.groundCover || (!asset.hardscape && !asset.supportsAnimals))
        continue;
      // Only a solid touching this one can cover any of its skin, which
      // sits just outside its bounds.
      const near = solid.bounds.clone().expandByScalar(0.05);
      const exposed =
        this.exposed.get(solid.object) ??
        (this.changes?.intersects(objectBounds(solid.object), 0.6) ||
        this.earlier?.changed.some((bounds) => bounds.intersectsBox(near))
          ? undefined
          : this.earlier?.exposed.get(solid.object)) ??
        (yield* this.expose(solid, margin));
      this.exposed.set(solid.object, exposed);
      // The habitat adds links and room to these, so it gets its own copies.
      for (const node of exposed)
        nodes.push({ ...node, neighbors: [...node.neighbors] });
    }
    return nodes;
  }

  /** The part of a solid's skin that no other solid covers. */
  private *expose(
    solid: Solid,
    margin: number,
  ): Generator<void, HabitatNode[]> {
    const env = this.world.environment;
    const skin =
      this.skins.get(solid.object) ??
      (!this.changes?.intersects(objectBounds(solid.object), 0.6)
        ? this.earlier?.skins.get(solid.object)
        : undefined) ??
      (yield* this.sampleSkin(solid));
    this.skins.set(solid.object, skin);
    const nodes: HabitatNode[] = [];
    for (const node of skin) {
      yield;
      const { x, y, z } = node.position;
      if (
        Math.abs(x) > env.width / 2 - margin ||
        Math.abs(z) > env.depth / 2 - margin ||
        y < groundHeight(x, z, env) - 0.015 ||
        this.remember("inside", node.position, node.position, () =>
          this.inside(node.position, true),
        )
      )
        continue;
      nodes.push({ ...node, neighbors: [...node.neighbors] });
    }
    const exposed = new Map(nodes.map((node) => [node.id, node]));
    for (const node of nodes)
      node.neighbors = node.neighbors.filter((id) => exposed.has(id));
    // Exposed endpoints alone are insufficient: another stacked piece can
    // still intersect the face between them. Check each edge once.
    for (const node of nodes) {
      yield;
      node.neighbors = node.neighbors.filter((id) => {
        if (node.id > id) return true;
        const neighbor = exposed.get(id)!;
        if (this.clearRoute(node.position, neighbor.position)) return true;
        neighbor.neighbors = neighbor.neighbors.filter(
          (next) => next !== node.id,
        );
        return false;
      });
    }
    return nodes;
  }

  /** Mesh vertices, edge samples and face centers share connections along
   * the actual skin, including steep sides that a top-down height map misses. */
  private *sampleSkin(solid: Solid): Generator<void, HabitatNode[]> {
    const env = this.world.environment;
    const samples = new Map<
      string,
      { point: THREE.Vector3; normal: THREE.Vector3; node: HabitatNode }
    >();
    const stone = assets[solid.object.kind].hardscape === "stone";
    const sample = (point: THREE.Vector3, normal: THREE.Vector3) => {
      // Moss and caps contain many decorative faces. Nearby contacts share
      // a node so their detail does not turn a small patch into thousands of routes.
      const asset = assets[solid.object.kind];
      const precision = asset.supportsAnimals ? 25 : 100000;
      const cell = [point.x, point.y, point.z]
        .map((value) => Math.round(value * precision))
        .join(":");
      const components = [normal.x, normal.y, normal.z];
      const axis = components.reduce(
        (best, value, i) =>
          Math.abs(value) > Math.abs(components[best]) ? i : best,
        0,
      );
      // A thin cap's top and underside can share a cell, but must never
      // average into an imaginary surface between them.
      const key = assets[solid.object.kind].supportsAnimals
        ? `${cell}:${axis}:${Math.sign(components[axis])}`
        : cell;
      const existing = samples.get(key);
      if (existing) {
        existing.normal.add(normal);
        return existing.node;
      }
      const node: HabitatNode = {
        id: `hardscape:${solid.object.id}:${key}`,
        position: { x: point.x, y: point.y, z: point.z },
        normal: { x: 0, y: 1, z: 0 },
        surface: stone
          ? "stone"
          : assets[solid.object.kind].hardscape === "wood"
            ? "bark"
            : "plant",
        wet: point.y <= waterLevel(point.x, point.z, env) + 0.065,
        submerged: waterLevel(point.x, point.z, env) - point.y > 0.025,
        shelter: solid.object.moss ? 0.5 : 0.2,
        perchHeight: point.y - groundHeight(point.x, point.z, env),
        supportId: solid.object.id,
        plantId: assets[solid.object.kind].supportsAnimals
          ? solid.object.id
          : undefined,
        neighbors: [],
      };
      samples.set(key, {
        point: point.clone(),
        normal: normal.clone(),
        node,
      });
      return node;
    };
    const connect = (a: HabitatNode, b: HabitatNode) => {
      if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
      if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
    };
    for (const { triangle } of solid.faces) {
      yield;
      const normal = triangle.getNormal(new THREE.Vector3());
      // Do not offer the flat underside as a walking surface. Sloping
      // sides below a stone's equator are useful approaches for climbers.
      if (normal.y < -0.95) continue;
      const center = sample(triangle.getMidpoint(new THREE.Vector3()), normal);
      const corners = [triangle.a, triangle.b, triangle.c];
      for (let edge = 0; edge < 3; edge++) {
        const from = corners[edge],
          to = corners[(edge + 1) % 3];
        const steps = Math.max(1, Math.ceil(from.distanceTo(to) / 0.16));
        let previous = sample(from, normal);
        connect(center, previous);
        for (let i = 1; i <= steps; i++) {
          const next = sample(from.clone().lerp(to, i / steps), normal);
          connect(previous, next);
          connect(center, next);
          previous = next;
        }
      }
    }
    for (const { point, normal, node } of samples.values()) {
      yield;
      normal.normalize();
      const lifted = point.clone().addScaledVector(normal, 0.018);
      node.position = { x: lifted.x, y: lifted.y, z: lifted.z };
      node.normal = { x: normal.x, y: normal.y, z: normal.z };
      if (assets[solid.object.kind].supportsAnimals)
        node.supportWidth = this.supportWidth(solid, point, normal);
    }
    return [...samples.values()].map(({ node }) => node);
  }

  /** Nearby contact in every direction lets the feet fit while the body
   * can overhang a cap. Decorative edges remain usable for climbing. */
  private supportWidth(
    solid: Solid,
    point: THREE.Vector3,
    normal: THREE.Vector3,
  ) {
    const across = new THREE.Vector3()
      .crossVectors(
        normal,
        Math.abs(normal.y) > 0.9
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0),
      )
      .normalize();
    const along = new THREE.Vector3().crossVectors(normal, across).normalize();
    let radius = 0;
    for (let r = 0.03; r <= 0.3; r += 0.03) {
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const origin = point
          .clone()
          .addScaledVector(across, Math.cos(angle) * r)
          .addScaledVector(along, Math.sin(angle) * r)
          .addScaledVector(normal, 0.04);
        this.ray.set(origin, normal.clone().negate());
        let contact = false;
        visitRayFaces(
          solid.tree,
          this.ray,
          ({ triangle }) => {
            if (
              this.ray.intersectTriangle(
                triangle.a,
                triangle.b,
                triangle.c,
                true,
                this.hit,
              ) &&
              this.hit.distanceTo(origin) <= 0.08
            )
              contact = true;
          },
          0.08,
        );
        if (!contact) return radius * 2;
      }
      radius = r;
    }
    return radius * 2;
  }

  /** Signed crossings handle both overlapping stones and hollow wood. A
   * point within the skin tolerance can lie on a shared triangle edge. */
  inside(point: Vec3, overCover = false, supportId?: string) {
    const origin = this.origin.set(point.x, point.y, point.z);
    this.ray.set(origin, this.direction);
    for (const solid of this.solids) {
      if (
        solid.object.id === supportId ||
        (overCover && assets[solid.object.kind].groundCover)
      )
        continue;
      if (!solid.bounds.containsPoint(origin)) continue;
      const hits: { distance: number; side: number; order: number }[] = [];
      visitRayFaces(solid.tree, this.ray, (face) => {
        const { triangle } = face;
        if (
          this.ray.intersectTriangle(
            triangle.a,
            triangle.b,
            triangle.c,
            false,
            this.hit,
          )
        )
          hits.push({
            distance: this.hit.distanceTo(origin),
            side: Math.sign(
              triangle.getNormal(this.normal).dot(this.direction),
            ),
            order: solid.faceOrder.get(face)!,
          });
      });
      // Preserve the mesh order at shared edges, where equal hits are deduplicated.
      hits.sort((a, b) => a.distance - b.distance || a.order - b.order);
      const crossings = hits.filter(
        (hit, i) => i === 0 || hit.distance - hits[i - 1].distance > 1e-6,
      );
      if (
        crossings.length &&
        crossings[0].distance > 0.025 &&
        crossings.reduce((sum, hit) => sum + hit.side, 0) !== 0
      )
        return true;
    }
    return false;
  }

  /** A route between two dry points can't dip underwater, so land animals
   * never wade across a pond. Underwater routes only have to stay above the
   * ground. */
  clearRoute(from: Vec3, to: Vec3, supportId?: string) {
    return this.remember(`route:${supportId ?? ""}`, from, to, () =>
      this.traceRoute(from, to, supportId),
    );
  }

  private traceRoute(from: Vec3, to: Vec3, supportId?: string) {
    const env = this.world.environment;
    const under = (point: Vec3) =>
      point.y < waterLevel(point.x, point.z, env) - 0.025;
    const underwater = under(from) || under(to);
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const steps = Math.max(2, Math.ceil(length / 0.04));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const point = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        z: from.z + (to.z - from.z) * t,
      };
      const floor = underwater ? 0 : waterLevel(point.x, point.z, env) - 0.025;
      if (
        point.y < Math.max(floor, groundHeight(point.x, point.z, env) - 0.04) ||
        this.inside(point, true, supportId)
      )
        return false;
    }
    return true;
  }
}

function* solidSteps(
  world: World,
  previous?: LandSurfaces,
): Generator<void, Solid[]> {
  const solids: Solid[] = [];
  for (const object of world.objects) {
    yield;
    const asset = assets[object.kind];
    if (
      !asset.hardscape &&
      !asset.blocksMovement &&
      !asset.buildStructure &&
      !asset.supportsAnimals
    )
      continue;
    const known = previous?.solids.find((solid) => solid.object === object);
    if (known && objectBase(object, world.environment) === known.base) {
      solids.push(known);
      continue;
    }
    const shape = placeShape(
      structuralShape(object),
      object,
      objectBase(object, world.environment),
    );
    const faces = shape.faces;
    solids.push({
      object,
      base: objectBase(object, world.environment),
      bounds: shape.bounds,
      faces,
      tree: yield* collisionTreeSteps(faces),
      faceOrder: new Map(faces.map((face, index) => [face, index])),
    });
  }
  return solids;
}
