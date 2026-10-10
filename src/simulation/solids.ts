import * as THREE from "three";
import { visitRayFaces } from "../assets/collisionTree";
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
 * Plants are soft and left out. */
export class Solids implements Caster {
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly reach = new THREE.Box3();

  constructor(
    private readonly world: World,
    readonly surfaces = new LandSurfaces(world),
  ) {}

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

  cast(origin: Vec3, direction: Vec3, far: number): SurfaceHit | undefined {
    let best = this.groundHit(origin, direction, far);
    const glass = this.glass(origin, direction, best?.distance ?? far);
    if (glass) best = glass;
    const solid = this.hardscape(origin, direction, best?.distance ?? far);
    return solid ?? best;
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
  private hardscape(o: Vec3, d: Vec3, far: number): SurfaceHit | undefined {
    this.ray.origin.set(o.x, o.y, o.z);
    this.ray.direction.set(d.x, d.y, d.z);
    let best: SurfaceHit | undefined;
    const end = this.end
      .copy(this.ray.direction)
      .multiplyScalar(far)
      .add(this.ray.origin);
    this.reach.setFromPoints([this.ray.origin, end]);
    for (const solid of this.surfaces.solids)
      if (solid.bounds.intersectsBox(this.reach))
        visitRayFaces(
          solid.tree,
          this.ray,
          ({ triangle }) => {
            const normal = triangle.getNormal(this.normal);
            if (normal.dot(this.ray.direction) >= 0) return;
            if (
              !this.ray.intersectTriangle(
                triangle.a,
                triangle.b,
                triangle.c,
                true,
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
          best?.distance ?? far,
        );
    return best;
  }
}
