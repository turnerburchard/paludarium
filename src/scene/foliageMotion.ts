import type { Vec3 } from "../simulation/types";

export interface FoliageVisitor {
  position: Vec3;
  radius: number;
  perchedOn?: string;
}

/** Visual motion only: plant anchors and navigation surfaces stay fixed. */
export class FoliageMotion {
  private bendX = 0;
  private bendZ = 0;
  private time = 0;
  readonly tilt = { x: 0, z: 0 };

  constructor(
    private readonly seed: number,
    private readonly plantId: string,
  ) {}

  update(
    dt: number,
    base: Vec3,
    radius: number,
    height: number,
    visitors: readonly FoliageVisitor[],
  ) {
    if (dt <= 0) return this.tilt;
    this.time += dt;
    let pushX = 0,
      pushZ = 0;
    for (const visitor of visitors) {
      const p = visitor.position;
      const dx = base.x - p.x,
        dz = base.z - p.z;
      if (visitor.perchedOn === this.plantId) {
        // Size stands in for weight; the offset from the stem supplies leverage.
        const weight =
          (Math.min(1, visitor.radius / 0.2) * 0.08) / Math.max(height, 0.1);
        pushX -= dx * weight;
        pushZ -= dz * weight;
        continue;
      }
      const reach = radius + visitor.radius + 0.25;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared >= reach * reach) continue;
      const verticalGap = Math.max(base.y - p.y, p.y - base.y - height, 0);
      const verticalReach = visitor.radius + 0.15;
      if (verticalGap >= verticalReach) continue;
      const distance = Math.sqrt(distanceSquared);
      const proximity = 1 - distance / reach;
      const vertical = 1 - verticalGap / verticalReach;
      const strength = proximity * proximity * vertical * 0.18;
      if (distance > 0.001) {
        pushX += (dx / distance) * strength;
        pushZ += (dz / distance) * strength;
      }
    }
    const limit = Math.max(1, Math.hypot(pushX, pushZ) / 0.18);
    pushX /= limit;
    pushZ /= limit;
    // Bend quickly on contact, then settle more slowly after a creature passes.
    const response = 1 - Math.exp(-(pushX || pushZ ? 10 : 3) * dt);
    this.bendX += (pushX - this.bendX) * response;
    this.bendZ += (pushZ - this.bendZ) * response;
    this.tilt.x = this.bendX + Math.sin(this.time * 0.7 + this.seed) * 0.009;
    this.tilt.z =
      this.bendZ + Math.sin(this.time * 0.53 + this.seed * 1.7) * 0.007;
    return this.tilt;
  }
}
