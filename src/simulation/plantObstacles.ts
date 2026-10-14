import { distance } from "./navigation";
import type { HabitatChanges } from "./habitatChanges";
import { finishWork } from "../work";
import * as THREE from "three";
import { assets, categoryOf } from "../assets";
import { collisionShapeSteps, placeShapeSteps } from "../assets/collisionShape";
import {
  collisionTreeSteps,
  type CollisionTree,
} from "../assets/collisionTree";
import { objectBase } from "../model/stacking";
import type { HabitatObject, World } from "../model/schema";
import type { LandSurfaces } from "./landSurfaces";
import type { HabitatNode, SpeciesProfile, Vec3 } from "./types";

interface Foliage {
  object: HabitatObject;
  base: number;
  tree: CollisionTree;
}
/** Actual foliage remains passable. The cost is bounded even where many
 * plants overlap, so an animal can always push through to food or water. */
export class PlantObstacles {
  private readonly foliage: Foliage[];
  private readonly cache = new Map<string, number>();
  private readonly previousCosts?: ReadonlyMap<string, number>;
  private readonly inverse = new THREE.Matrix4();
  private readonly query = new THREE.Box3();
  private readonly body = new THREE.Box3();
  private readonly triangle = new THREE.Triangle();

  constructor(
    world: World,
    private readonly surfaces: LandSurfaces,
    foliage = finishWork(foliageSteps(world)),
    previous?: PlantObstacles,
    private readonly changes?: HabitatChanges,
  ) {
    this.foliage = foliage;
    this.previousCosts = previous?.cache;
  }
  static *build(
    world: World,
    surfaces: LandSurfaces,
    previous?: PlantObstacles,
    changes?: HabitatChanges,
  ): Generator<void, PlantObstacles> {
    return new PlantObstacles(
      world,
      surfaces,
      yield* foliageSteps(world, previous?.foliage),
      previous,
      changes,
    );
  }

  /** Only ground travel pushes through foliage. Authored climbing routes
   * remain available, including stems smaller than an animal's body. */
  cost(from: HabitatNode, to: HabitatNode, species: SpeciesProfile) {
    if (species.swims || from.leaps?.includes(to.id))
      return distance(from.position, to.position);
    if (from.surface !== "ground" || to.surface !== "ground") {
      const key = `contact:${from.id}:${to.id}`;
      const known = this.knownCost(key, from, to);
      if (known !== undefined) return known;
      // Authored climbs can touch their own support, but never pass
      // through another solid. Ground travel does not get this exception.
      const supportId =
        from.plantId && to.plantId && from.plantId !== to.plantId
          ? undefined
          : (from.plantId ?? to.plantId);
      const cost = this.surfaces.clearRoute(
        from.position,
        to.position,
        supportId,
      )
        ? distance(from.position, to.position)
        : Infinity;
      this.cache.set(key, cost);
      return cost;
    }
    const width = species.body?.width ?? 2 * (species.radius ?? 0);
    const bodyLength = species.body?.length ?? width;
    const height = species.body?.height ?? 0.1;
    const key = `${from.id}:${to.id}:${width}:${bodyLength}:${height}`;
    const known = this.knownCost(key, from, to, width + bodyLength);
    if (known !== undefined) return known;
    const length = distance(from.position, to.position);
    // The swept box includes the entire segment, so even a thin stem between
    // graph nodes cannot disappear between clearance samples.
    this.box(from.position, to.position, width, bodyLength, height);
    const center = this.query.getCenter(new THREE.Vector3());
    if (
      this.surfaces.solids.some(
        (solid) =>
          !assets[solid.object.kind].groundCover && this.intersects(solid.tree),
      ) ||
      this.surfaces.inside(center, true)
    ) {
      this.cache.set(key, Infinity);
      return Infinity;
    }
    let occupied = 0;
    const steps = Math.max(1, Math.ceil(length / 0.08));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: from.position.x + (to.position.x - from.position.x) * t,
        y: from.position.y + (to.position.y - from.position.y) * t,
        z: from.position.z + (to.position.z - from.position.z) * t,
      };
      this.box(
        point,
        point,
        width,
        bodyLength,
        height,
        from.position,
        to.position,
      );
      if (this.foliage.some(({ tree }) => this.intersects(tree))) occupied++;
    }
    const cost = length * (1 + (0.5 * occupied) / (steps + 1));
    this.cache.set(key, cost);
    return cost;
  }

  private knownCost(
    key: string,
    from: HabitatNode,
    to: HabitatNode,
    padding = 0,
  ) {
    const known = this.cache.get(key);
    if (known !== undefined) return known;
    if (
      !this.previousCosts ||
      this.changes?.crosses(from.position, to.position, padding)
    )
      return undefined;
    const previous = this.previousCosts.get(key);
    if (previous !== undefined) this.cache.set(key, previous);
    return previous;
  }

  private box(
    from: Vec3,
    to: Vec3,
    width: number,
    length: number,
    height: number,
    headingFrom = from,
    headingTo = to,
  ) {
    const dx = headingTo.x - headingFrom.x,
      dz = headingTo.z - headingFrom.z;
    const heading = Math.atan2(dx, dz);
    const span = Math.hypot(to.x - from.x, to.z - from.z);
    const matrix = new THREE.Matrix4().makeRotationY(heading);
    matrix.setPosition(
      (from.x + to.x) / 2,
      Math.min(from.y, to.y),
      (from.z + to.z) / 2,
    );
    // Feet may touch the surface. The box starts just above them, so a
    // route on the ground does not collide with an object's buried base.
    this.body.min.set(-width / 2, 0.025, -(length + span) / 2);
    this.body.max.set(
      width / 2,
      Math.max(0.03, height) + Math.abs(to.y - from.y),
      (length + span) / 2,
    );
    this.inverse.copy(matrix).invert();
    this.query.copy(this.body).applyMatrix4(matrix);
  }

  private intersects(tree: CollisionTree): boolean {
    if (!tree.bounds.intersectsBox(this.query)) return false;
    if (tree.children)
      return tree.children.some((child) => this.intersects(child));
    return tree.faces!.some((face) => {
      if (!face.bounds.intersectsBox(this.query)) return false;
      this.triangle.copy(face.triangle);
      for (const point of [this.triangle.a, this.triangle.b, this.triangle.c])
        point.applyMatrix4(this.inverse);
      return this.body.intersectsTriangle(this.triangle);
    });
  }
}

function* foliageSteps(
  world: World,
  previous: readonly Foliage[] = [],
): Generator<void, Foliage[]> {
  const foliage: Foliage[] = [];
  for (const object of world.objects) {
    yield;
    const asset = assets[object.kind];
    if (
      categoryOf(asset) !== "Plants" ||
      !asset.shelter ||
      asset.supportsAnimals ||
      asset.blocksMovement
    )
      continue;
    const base = objectBase(object, world.environment);
    const known = previous.find(
      (piece) => piece.object === object && piece.base === base,
    );
    if (known) {
      foliage.push(known);
      continue;
    }
    const { faces } = yield* placeShapeSteps(
      yield* collisionShapeSteps(object),
      object,
      objectBase(object, world.environment),
    );
    foliage.push({ object, base, tree: yield* collisionTreeSteps(faces) });
  }
  return foliage;
}
