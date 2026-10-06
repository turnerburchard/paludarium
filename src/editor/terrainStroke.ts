import type { World } from "../model/schema";
import { applyTerrainBrush, type TerrainBrush } from "../model/terrainBrush";
import { boundedPosition } from "../model/terrain";

/** A stroke owns a preview; history receives only its final world on release. */
export class TerrainStroke {
  private last?: { x: number; z: number };
  current: World;
  constructor(
    readonly original: World,
    readonly brush: TerrainBrush,
  ) {
    this.current = original;
  }
  dab(x: number, z: number): World {
    const point = boundedPosition(x, z, this.original.environment, 0);
    const from = this.last ?? point;
    const steps = Math.max(
      1,
      Math.ceil(
        Math.hypot(point.x - from.x, point.z - from.z) /
          (this.brush.radius * 0.22),
      ),
    );
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const environment = applyTerrainBrush(
        this.current.environment,
        from.x + (point.x - from.x) * t,
        from.z + (point.z - from.z) * t,
        this.brush,
      );
      if (environment !== this.current.environment)
        this.current = { ...this.current, environment };
    }
    this.last = point;
    return this.current;
  }
}
