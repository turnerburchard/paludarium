import * as THREE from "three";
import { assets, isAnimal } from "../assets";
import { collisionShape, type CollisionFace } from "../assets/collisionShape";
import {
  buildCollisionTree,
  type CollisionTree,
} from "../assets/collisionTree";
import type { Environment, HabitatObject, World } from "../model/schema";
import { objectBase } from "../model/stacking";
import { highestWater, placementProblem, waterLevel } from "../model/water";
import { groundHeight } from "../model/terrain";
import type { Vec3 } from "./types";

const CLEARANCE = 0.015;
const SWIM_BOB = 0.025;

/** Collision trees for the plants, wood and stone, which only depend on
 * those objects and the environment. */
interface Scenery {
  objects: HabitatObject[];
  obstacles: CollisionTree;
  solids: CollisionTree[];
}

// Kills, births and moved fish leave the scenery alone. Rebuilding its trees
// for each of them made every fish death in a planted tank hitch.
const sceneries = new WeakMap<Environment, Scenery>();

function sameObjects(a: HabitatObject[], b: HabitatObject[]) {
  return a.length === b.length && a.every((object, i) => object === b[i]);
}

interface Crossing {
  distance: number;
  side: number;
}

/** Fish-sized, oriented clearance against the actual leaves, branches and
 * hardscape. A hierarchy keeps queries local even in a heavily planted tank. */
export class SwimSpace {
  private readonly obstacles: CollisionTree;
  private readonly solids: CollisionTree[];
  private readonly bodies = new Map<string, THREE.Box3>();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly matrix = new THREE.Matrix4();
  private readonly inverse = new THREE.Matrix4();
  private readonly query = new THREE.Box3();
  private readonly bodyBox = new THREE.Box3();
  private readonly triangle = new THREE.Triangle();
  private readonly unitScale = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();

  constructor(private readonly world: World) {
    for (const object of world.objects) {
      const asset = assets[object.kind];
      if (!isAnimal(object.kind) || !asset.swims) continue;
      const bounds = collisionShape(object).bounds.clone();
      bounds.min.multiplyScalar(object.scale);
      bounds.max.multiplyScalar(object.scale);
      // Include the tail's sway and the renderer's vertical bob.
      const sway = object.kind === "tiger-barb" ? 0.025 * object.scale : 0;
      bounds.min.x -= sway + CLEARANCE;
      bounds.max.x += sway + CLEARANCE;
      bounds.min.y -= CLEARANCE;
      bounds.max.y += CLEARANCE;
      bounds.min.z -= CLEARANCE;
      bounds.max.z += CLEARANCE;
      this.bodies.set(object.id, bounds);
    }
    const objects = world.objects.filter((o) => !isAnimal(o.kind));
    const built = sceneries.get(world.environment);
    const scenery =
      built && sameObjects(built.objects, objects)
        ? built
        : this.buildScenery(objects);
    sceneries.set(world.environment, scenery);
    this.obstacles = scenery.obstacles;
    this.solids = scenery.solids;
  }

  private buildScenery(objects: HabitatObject[]): Scenery {
    const env = this.world.environment;
    // Only what reaches into some water can get in a fish's way.
    const surface = highestWater(env);
    const faces: CollisionFace[] = [];
    const solids: CollisionTree[] = [];
    for (const object of objects) {
      this.matrix.compose(
        this.position.set(object.x, objectBase(object, env), object.z),
        this.rotation.setFromAxisAngle(this.up, object.rotation),
        this.unitScale.clone().multiplyScalar(object.scale),
      );
      const geometry = collisionShape(object);
      const submergedBounds = geometry.bounds.clone().applyMatrix4(this.matrix);
      if (submergedBounds.min.y >= surface) continue;
      const transformed = geometry.faces.map(({ triangle }) => {
        const moved = triangle.clone();
        for (const point of [moved.a, moved.b, moved.c])
          point.applyMatrix4(this.matrix);
        return {
          triangle: moved,
          bounds: new THREE.Box3().setFromPoints([moved.a, moved.b, moved.c]),
        };
      });
      faces.push(...transformed.filter((face) => face.bounds.min.y < surface));
      if (assets[object.kind].hardscape)
        solids.push(buildCollisionTree(transformed));
    }
    return { objects, obstacles: buildCollisionTree(faces), solids };
  }

  /** How much open water a fish needs around it: its height, and room to
   * turn around in. Water nodes record how big a fish they have room for. */
  room(id: string) {
    const body = this.bodies.get(id)!;
    return Math.max((body.max.y - body.min.y) / 2, this.reach(id) * 0.75);
  }

  reach = (id: string) => {
    const body = this.bodies.get(id)!;
    return Math.max(-body.min.z, body.max.z);
  };

  /** The nearest steady height to `wanted` that keeps the body clear of the
   * floor and surface, with room to bob. */
  steady = (
    id: string,
    x: number,
    z: number,
    wanted: number,
    env = this.world.environment,
  ) => {
    const body = this.bodies.get(id)!;
    const floor = groundHeight(x, z, env) - body.min.y + 0.005;
    const ceiling = waterLevel(x, z, env) - body.max.y - 0.005;
    const bob = Math.max(0, Math.min(SWIM_BOB, (ceiling - floor) / 2));
    return {
      y: Math.max(floor + bob, Math.min(ceiling - bob, wanted)),
      bob,
    };
  };

  canSwim = (
    id: string,
    x: number,
    y: number,
    z: number,
    heading: number,
    padding = 0,
  ): boolean => {
    // Every swimmer shares the open-water placement rule.
    if (placementProblem("fish", x, z, this.world.environment)) return false;
    const { bob } = this.steady(id, x, z, y);
    this.bodyBox.copy(this.bodies.get(id)!);
    this.bodyBox.min.y -= bob;
    this.bodyBox.max.y += bob;
    // Extra horizontal breathing room for steering, without changing depth.
    this.bodyBox.min.x -= padding;
    this.bodyBox.max.x += padding;
    this.bodyBox.min.z -= padding;
    this.bodyBox.max.z += padding;
    this.matrix.compose(
      this.position.set(x, y, z),
      this.rotation.setFromAxisAngle(this.up, heading),
      this.unitScale,
    );
    this.inverse.copy(this.matrix).invert();
    this.query.copy(this.bodyBox).applyMatrix4(this.matrix);
    // Retreats can keep their previous depth, so check the floor here too.
    if (this.query.min.y < groundHeight(x, z, this.world.environment))
      return false;
    return this.clear();
  };

  /** Whether a box of open water fits around a point, for the water graph.
   * The caller keeps it clear of the floor. */
  open(point: Vec3, half: number, height: number) {
    this.bodyBox.min.set(-half, -height, -half);
    this.bodyBox.max.set(half, height, half);
    this.matrix.makeTranslation(point.x, point.y, point.z);
    this.inverse.copy(this.matrix).invert();
    this.query.copy(this.bodyBox).applyMatrix4(this.matrix);
    return this.clear();
  }

  /** Whether the posed body in `query` stays inside the tank and water, and
   * clear of everything in it. */
  private clear() {
    const env = this.world.environment;
    if (
      this.query.min.x <= -env.width / 2 ||
      this.query.max.x >= env.width / 2 ||
      this.query.min.z <= -env.depth / 2 ||
      this.query.max.z >= env.depth / 2 ||
      this.query.max.y >=
        waterLevel(
          (this.query.min.x + this.query.max.x) / 2,
          (this.query.min.z + this.query.max.z) / 2,
          env,
        )
    )
      return false;
    return !this.intersects(this.obstacles, this.bodyBox);
  }

  /** A new or edited object can surround a fish without crossing its skin.
   * Check solid interiors when finding a starting position, too. Hollow log
   * walls and shelter openings retain their real gaps. */
  canStart(id: string, x: number, y: number, z: number, heading: number) {
    if (!this.canSwim(id, x, y, z, heading)) return false;
    this.ray.set(
      this.position,
      new THREE.Vector3(0.937, 0.213, 0.277).normalize(),
    );
    for (const solid of this.solids) {
      if (!solid.bounds.containsPoint(this.position)) continue;
      const hits: Crossing[] = [];
      this.crossings(solid, hits);
      hits.sort((a, b) => a.distance - b.distance);
      // Shared triangle edges count as one crossing.
      const crossings = hits.filter(
        (hit, i) => i === 0 || hit.distance - hits[i - 1].distance > 1e-6,
      );
      // Signed crossings also detect overlapping stones in one shelter.
      if (crossings.reduce((sum, hit) => sum + hit.side, 0) !== 0) return false;
    }
    return true;
  }

  private intersects(node: CollisionTree, body: THREE.Box3): boolean {
    if (!node.bounds.intersectsBox(this.query)) return false;
    if (node.children)
      return node.children.some((child) => this.intersects(child, body));
    return node.faces!.some((face) => {
      if (!face.bounds.intersectsBox(this.query)) return false;
      this.triangle.copy(face.triangle);
      for (const point of [this.triangle.a, this.triangle.b, this.triangle.c])
        point.applyMatrix4(this.inverse);
      return body.intersectsTriangle(this.triangle);
    });
  }

  private crossings(node: CollisionTree, hits: Crossing[]) {
    if (!this.ray.intersectsBox(node.bounds)) return;
    if (node.children) {
      for (const child of node.children) this.crossings(child, hits);
      return;
    }
    for (const { triangle } of node.faces!) {
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
          distance: this.hit.distanceTo(this.ray.origin),
          side: Math.sign(
            triangle.getNormal(this.normal).dot(this.ray.direction),
          ),
        });
    }
  }
}
