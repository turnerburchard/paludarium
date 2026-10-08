import type { Vec3 } from "../simulation/types";

export interface FoliageVisitor {
  id: string;
  position: Vec3;
  radius: number;
}

/** Visual motion only: plant anchors and navigation surfaces stay fixed. */
export class FoliageMotion {
  private previous = new Map<string, Vec3>();
  private bendX = 0;
  private bendZ = 0;
  private time = 0;
  readonly tilt = { x: 0, z: 0 };

  constructor(private readonly seed: number) {}

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
    const next = new Map<string, Vec3>();
    for (const visitor of visitors) {
      const p = visitor.position;
      const old = this.previous.get(visitor.id);
      next.set(visitor.id, { ...p });
      // A new creature or a placement edit must not look like a fast pass.
      if (!old) continue;
      const travel = Math.hypot(p.x - old.x, p.y - old.y, p.z - old.z);
      if (travel > 0.3 || travel === 0) continue;
      const speed = Math.min(1, travel / dt / 0.5);
      const dx = base.x - p.x,
        dz = base.z - p.z;
      const distance = Math.hypot(dx, dz);
      const reach = radius + visitor.radius + 0.25;
      const verticalGap = Math.max(base.y - p.y, p.y - base.y - height, 0);
      const proximity = Math.max(0, 1 - distance / reach);
      const vertical = Math.max(0, 1 - verticalGap / (visitor.radius + 0.15));
      const strength = proximity * proximity * vertical * speed * 0.18;
      if (distance > 0.001) {
        pushX += (dx / distance) * strength;
        pushZ += (dz / distance) * strength;
      } else {
        const horizontalTravel = Math.hypot(p.x - old.x, p.z - old.z);
        if (horizontalTravel > 0) {
          pushX -= ((p.x - old.x) / horizontalTravel) * strength;
          pushZ -= ((p.z - old.z) / horizontalTravel) * strength;
        }
      }
    }
    this.previous = next;
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
