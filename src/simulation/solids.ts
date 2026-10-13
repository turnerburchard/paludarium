import * as THREE from "three";
import { assets } from "../assets";
import { collisionShape, placeShape } from "../assets/collisionShape";
import { objectBase } from "../model/stacking";
import {
  buildCollisionTree,
  visitRayFaces,
  type CollisionTree,
} from "../assets/collisionTree";
import type { World } from "../model/schema";
import { groundHeight } from "../model/terrain";
import { LandSurfaces } from "./landSurfaces";
import type { Vec3 } from "./types";

export interface SurfaceHit {
  point: Vec3;
  distance: number;
}

/** Anything an animal's body can rest against or bump into. */
export interface Caster {
  cast(origin: Vec3, direction: Vec3, far: number): SurfaceHit | undefined;
}

/** The ground, the glass, and stone and wood, as one thing to cast rays at.
 * Soft foliage is left out; stems and firm living surfaces count. */
export class Solids implements Caster {
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly plantSupports = new Map<string, Caster>();

  readonly surfaces: LandSurfaces;

  /** With the solids from before an edit, checks away from it carry over. */
  constructor(
    private readonly world: World,
    previous?: Solids,
    surfaces = new LandSurfaces(world, previous?.surfaces),
  ) {
    this.surfaces = surfaces;
  }
  static *build(world: World, previous?: Solids): Generator<void, Solids> {
    const surfaces = yield* LandSurfaces.build(world, previous?.surfaces);
    return new Solids(world, previous, surfaces);
  }

  /** The ground under a point, and which way it faces. */
  ground(x: number, z: number) {
    const env = this.world.environment;
    const e = 0.01;
    const dx = groundHeight(x + e, z, env) - groundHeight(x - e, z, env);
    const dz = groundHeight(x, z + e, env) - groundHeight(x, z - e, env);
    const length = Math.hypot(dx, 2 * e, dz);
    return {
      position: { x, y: groundHeight(x, z, env), z },
      normal: { x: -dx / length, y: (2 * e) / length, z: -dz / length },
    };
  }

  /** A moss mat is a contact layer on its underlying route, not hundreds
   * of tiny destinations. Start above its skin so body probes never begin
   * inside a cushion and miss the surface. */
  covered(position: Vec3, normal: Vec3, supportId?: string) {
    const cover = this.surfaces.at(
      position.x,
      position.z,
      (object) =>
        !!assets[object.kind].groundCover &&
        object.support === supportId &&
        (supportId !== undefined || (object.lift ?? 0) <= 0.025),
    );
    return cover &&
      cover.position.y > position.y &&
      cover.position.y - position.y <= 0.4
      ? { position: cover.position, normal: cover.normal }
      : { position, normal };
  }

  cast(
    origin: Vec3,
    direction: Vec3,
    far: number,
    includeCover = true,
  ): SurfaceHit | undefined {
    let best = this.groundHit(origin, direction, far);
    const glass = this.glass(origin, direction, best?.distance ?? far);
    if (glass) best = glass;
    const solid = this.objectHit(
      origin,
      direction,
      best?.distance ?? far,
      includeCover,
    );
    return solid ?? best;
  }

  /** Leaves support their visitor without becoming obstacles for animals
   * passing underneath or pushing through the rest of the foliage. */
  onPlant(objectId: string): Caster {
    const known = this.plantSupports.get(objectId);
    if (known) return known;
    const object = this.world.objects.find((object) => object.id === objectId)!;
    const shape = placeShape(
      collisionShape(object),
      object,
      objectBase(object, this.world.environment),
    );
    const tree = buildCollisionTree(shape.faces);
    const caster: Caster = {
      cast: (origin, direction, far) => {
        const solid = this.cast(origin, direction, far);
        return (
          this.meshHit(tree, origin, direction, solid?.distance ?? far, true) ??
          solid
        );
      },
    };
    this.plantSupports.set(objectId, caster);
    return caster;
  }

  /** Steps along the ray, then narrows down the crossing between the last
   * two steps. The ground is smooth at this scale, so steps can be long. */
  private groundHit(o: Vec3, d: Vec3, far: number): SurfaceHit | undefined {
    const env = this.world.environment;
    const above = (t: number) =>
      o.y + d.y * t - groundHeight(o.x + d.x * t, o.z + d.z * t, env);
    let near = 0,
      nearAbove = above(0);
    // Starting underground is as good as being stopped at once.
    if (nearAbove <= 0) return { point: { ...o }, distance: 0 };
    while (near < far) {
      const next = Math.min(near + 0.05, far),
        nextAbove = above(next);
      if (nextAbove <= 0) {
        // A few rounds of false position meet the crossing closely.
        let low = near,
          lowAbove = nearAbove,
          high = next,
          highAbove = nextAbove,
          t = high;
        for (let i = 0; i < 3; i++) {
          t = low + ((high - low) * lowAbove) / (lowAbove - highAbove);
          const at = above(t);
          if (at > 0) [low, lowAbove] = [t, at];
          else [high, highAbove] = [t, at];
        }
        const x = o.x + d.x * t,
          z = o.z + d.z * t;
        return {
          point: { x, y: groundHeight(x, z, env), z },
          distance: t,
        };
      }
      [near, nearAbove] = [next, nextAbove];
    }
    return undefined;
  }

  private glass(o: Vec3, d: Vec3, far: number): SurfaceHit | undefined {
    const env = this.world.environment;
    let best: SurfaceHit | undefined;
    for (const [axis, half] of [
      ["x", env.width / 2],
      ["z", env.depth / 2],
    ] as const)
      for (const side of [1, -1]) {
        if (d[axis] * side <= 1e-9) continue;
        const t = (side * half - o[axis]) / d[axis];
        if (t < 0 || t > (best?.distance ?? far)) continue;
        best = {
          point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t },
          distance: t,
        };
      }
    return best;
  }

  /** Only faces turned toward the ray count, so a ray that starts inside
   * stone passes out of it rather than catching its far side. */
  private objectHit(
    o: Vec3,
    d: Vec3,
    far: number,
    includeCover: boolean,
  ): SurfaceHit | undefined {
    let best: SurfaceHit | undefined;
    for (const solid of this.surfaces.solids) {
      if (!includeCover && assets[solid.object.kind].groundCover) continue;
      best = this.meshHit(solid.tree, o, d, best?.distance ?? far) ?? best;
    }
    return best;
  }

  private meshHit(
    tree: CollisionTree,
    o: Vec3,
    d: Vec3,
    far: number,
    twoSided = false,
  ) {
    this.ray.origin.set(o.x, o.y, o.z);
    this.ray.direction.set(d.x, d.y, d.z);
    let best: SurfaceHit | undefined;
    visitRayFaces(
      tree,
      this.ray,
      ({ triangle }) => {
        if (
          !twoSided &&
          triangle.getNormal(this.normal).dot(this.ray.direction) >= 0
        )
          return;
        if (
          !this.ray.intersectTriangle(
            triangle.a,
            triangle.b,
            triangle.c,
            !twoSided,
            this.hit,
          )
        )
          return;
        const distance = this.hit.distanceTo(this.ray.origin);
        if (distance > (best?.distance ?? far)) return;
        best = {
          point: { x: this.hit.x, y: this.hit.y, z: this.hit.z },
          distance,
        };
      },
      far,
    );
    return best;
  }
}
