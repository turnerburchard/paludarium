import * as THREE from "three";
import { assets } from "../assets";
import { collisionShape, type CollisionFace } from "../assets/collisionShape";
import {
  buildCollisionTree,
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

/** Exposed stone and wood surfaces, sampled from the same geometry used for
 * placement and fish clearance. Overlapping stacks expose only their outer skin. */
export class LandSurfaces {
  readonly solids: Solid[] = [];
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
   * changed are made again. Terrain and water touch every check and skin. */
  constructor(
    private readonly world: World,
    previous?: LandSurfaces,
  ) {
    for (const object of world.objects) {
      if (!assets[object.kind].hardscape) continue;
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(
          object.x,
          objectBase(object, world.environment),
          object.z,
        ),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          object.rotation,
        ),
        new THREE.Vector3().setScalar(object.scale),
      );
      const shape = collisionShape(object);
      const faces = shape.faces.map(({ triangle }) => {
        const moved = triangle.clone();
        for (const point of [moved.a, moved.b, moved.c])
          point.applyMatrix4(matrix);
        return {
          triangle: moved,
          bounds: new THREE.Box3().setFromPoints([moved.a, moved.b, moved.c]),
        };
      });
      this.solids.push({
        object,
        bounds: shape.bounds.clone().applyMatrix4(matrix),
        faces,
        tree: buildCollisionTree(faces),
        faceOrder: new Map(faces.map((face, index) => [face, index])),
      });
    }
    if (previous?.world.environment !== world.environment) return;
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

  /** A check between two points only depends on the ground, the water and
   * the solids whose bounds it reaches. */
  private remember(
    kind: "inside" | "route",
    a: Vec3,
    b: Vec3,
    check: () => boolean,
  ) {
    const key = `${kind}:${a.x},${a.y},${a.z},${b.x},${b.y},${b.z}`;
    const known = this.checks.get(key);
    if (known !== undefined) return known;
    // Moving checks across, rather than copying them, leaves the old map
    // holding only what the edit made stale.
    let result = this.earlier?.checks.get(key);
    this.earlier?.checks.delete(key);
    if (
      result === undefined ||
      this.earlier!.changed.some((bounds) => reaches(bounds, a, b))
    )
      result = check();
    this.checks.set(key, result);
    return result;
  }

  at(x: number, z: number) {
    let highest:
      | { position: Vec3; normal: Vec3; object: HabitatObject }
      | undefined;
    for (const solid of this.solids) {
      if (
        x < solid.bounds.min.x ||
        x > solid.bounds.max.x ||
        z < solid.bounds.min.z ||
        z > solid.bounds.max.z
      )
        continue;
      this.ray.set(new THREE.Vector3(x, solid.bounds.max.y + 1, z), this.down);
      for (const { triangle, bounds } of solid.faces) {
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

  blocksGround(x: number, z: number, clearance: number) {
    const floor = groundHeight(x, z, this.world.environment);
    // Probe the animal's footprint, rather than excluding a whole bounding
    // circle around thin branches and irregular stones.
    return [
      [0, 0],
      [clearance, 0],
      [-clearance, 0],
      [0, clearance],
      [0, -clearance],
    ].some(([dx, dz]) => {
      const surface = this.at(x + dx, z + dz);
      return surface && surface.position.y > floor + 0.04;
    });
  }

  /** The skin of every solid that no other solid covers. */
  routes(margin: number): HabitatNode[] {
    const nodes: HabitatNode[] = [];
    for (const solid of this.solids) {
      // Only a solid touching this one can cover any of its skin, which
      // sits just outside its bounds.
      const near = solid.bounds.clone().expandByScalar(0.05);
      const exposed =
        this.exposed.get(solid.object) ??
        (this.earlier?.changed.some((bounds) => bounds.intersectsBox(near))
          ? undefined
          : this.earlier?.exposed.get(solid.object)) ??
        this.expose(solid, margin);
      this.exposed.set(solid.object, exposed);
      // The habitat adds links and room to these, so it gets its own copies.
      for (const node of exposed)
        nodes.push({ ...node, neighbors: [...node.neighbors] });
    }
    return nodes;
  }

  /** The part of a solid's skin that no other solid covers. */
  private expose(solid: Solid, margin: number): HabitatNode[] {
    const env = this.world.environment;
    const skin =
      this.skins.get(solid.object) ??
      this.earlier?.skins.get(solid.object) ??
      this.sampleSkin(solid);
    this.skins.set(solid.object, skin);
    const nodes: HabitatNode[] = [];
    for (const node of skin) {
      const { x, y, z } = node.position;
      if (
        Math.abs(x) > env.width / 2 - margin ||
        Math.abs(z) > env.depth / 2 - margin ||
        y < groundHeight(x, z, env) - 0.015 ||
        this.remember("inside", node.position, node.position, () =>
          this.inside(node.position),
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
    for (const node of nodes)
      node.neighbors = node.neighbors.filter((id) => {
        if (node.id > id) return true;
        const neighbor = exposed.get(id)!;
        if (this.clearRoute(node.position, neighbor.position)) return true;
        neighbor.neighbors = neighbor.neighbors.filter(
          (next) => next !== node.id,
        );
        return false;
      });
    return nodes;
  }

  /** Mesh vertices, edge samples and face centers share connections along
   * the actual skin, including steep sides that a top-down height map misses. */
  private sampleSkin(solid: Solid): HabitatNode[] {
    const env = this.world.environment;
    const samples = new Map<
      string,
      { point: THREE.Vector3; normal: THREE.Vector3; node: HabitatNode }
    >();
    const stone = assets[solid.object.kind].hardscape === "stone";
    const sample = (point: THREE.Vector3, normal: THREE.Vector3) => {
      const key = [point.x, point.y, point.z]
        .map((value) => Math.round(value * 100000))
        .join(":");
      const existing = samples.get(key);
      if (existing) {
        existing.normal.add(normal);
        return existing.node;
      }
      const node: HabitatNode = {
        id: `hardscape:${solid.object.id}:${key}`,
        position: { x: point.x, y: point.y, z: point.z },
        normal: { x: 0, y: 1, z: 0 },
        surface: stone ? "stone" : "bark",
        wet: point.y <= waterLevel(point.x, point.z, env) + 0.065,
        submerged: waterLevel(point.x, point.z, env) - point.y > 0.025,
        shelter: solid.object.moss ? 0.5 : 0.2,
        perchHeight: point.y - groundHeight(point.x, point.z, env),
        supportId: solid.object.id,
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
      normal.normalize();
      const lifted = point.clone().addScaledVector(normal, 0.018);
      node.position = { x: lifted.x, y: lifted.y, z: lifted.z };
      node.normal = { x: normal.x, y: normal.y, z: normal.z };
    }
    return [...samples.values()].map(({ node }) => node);
  }

  /** Signed crossings handle both overlapping stones and hollow wood. A
   * point within the skin tolerance can lie on a shared triangle edge. */
  inside(point: Vec3) {
    const origin = this.origin.set(point.x, point.y, point.z);
    this.ray.set(origin, this.direction);
    for (const solid of this.solids) {
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
  clearRoute(from: Vec3, to: Vec3) {
    return this.remember("route", from, to, () => this.traceRoute(from, to));
  }

  private traceRoute(from: Vec3, to: Vec3) {
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
        this.inside(point)
      )
        return false;
    }
    return true;
  }
}
