import type { World } from "../model/schema";
import { applyTerrainBrush, type TerrainBrush } from "../model/terrainBrush";
import { boundedPosition } from "../model/terrain";
import { keepStacked } from "../model/stacking";

/** A stroke owns a preview; history receives only its final world on release. */
export class TerrainStroke {
  private last?: { x: number; z: number };
  private distanceSinceDab = 0;
  current: World;
  constructor(
    readonly original: World,
    readonly brush: TerrainBrush,
  ) {
    this.current = original;
  }
  dab(x: number, z: number): World {
    const point = boundedPosition(x, z, this.original.environment, 0);
    const from = this.last;
    this.last = point;
    if (!from) {
      this.apply(point.x, point.z);
      return this.current;
    }
    const length = Math.hypot(point.x - from.x, point.z - from.z);
    if (!length) return this.current;
    const spacing = this.brush.radius * 0.22;
    let traveled = spacing - this.distanceSinceDab;
    // Sample distance along the stroke, independent of pointer event frequency.
    for (; traveled <= length; traveled += spacing) {
      const t = traveled / length;
      this.apply(
        from.x + (point.x - from.x) * t,
        from.z + (point.z - from.z) * t,
      );
    }
    this.distanceSinceDab = length - (traveled - spacing);
    return this.current;
  }
  private apply(x: number, z: number) {
    const environment = applyTerrainBrush(
      this.current.environment,
      x,
      z,
      this.brush,
      0.025,
    );
    if (environment === this.current.environment) return;
    const reshaped =
      environment.terrain?.heights !==
      this.current.environment.terrain?.heights;
    this.current = {
      ...this.current,
      environment,
      // Paint keeps the objects as they are, so the simulation can tell
      // nothing moved.
      objects: reshaped
        ? keepStacked(
            this.current.objects,
            this.current.environment,
            environment,
          )
        : this.current.objects,
    };
  }
}
