/** Fish swim in open water as a loose school. Like the frog engine, this owns
 * positions and decisions; the renderer only reads them. Units are scene
 * units and real seconds. */

export interface Fish {
  id: string;
  /** Fish school only with their own species. */
  species: string;
  /** Cruising speed in scene units per second. */
  speed: number;
  x: number;
  z: number;
  /** Swimming direction in radians; 0 points toward -z. */
  heading: number;
}

export interface SchoolOptions {
  random?: () => number;
}

const TURN_RATE = 2.2;
const NEIGHBOR_RANGE = 1.3;
const PERSONAL_SPACE = 0.3;
const LOOK_AHEAD = 0.4;
/** Probe angles, nearest first, for finding open water when the shore is ahead. */
const ESCAPE_ANGLES = [0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI];

/** Internal per-fish state: a slightly different pace, a gentle turning
 * rate (radians per second) that drifts so each fish meanders its own way,
 * and a clock for when it next leaves or rejoins the others. */
interface Swimmer extends Fish {
  pace: number;
  wander: number;
  roaming: boolean;
  untilChange: number;
}

const direction = (heading: number) => ({
  x: -Math.sin(heading),
  z: -Math.cos(heading),
});
/** Smallest signed angle from a to b. */
const turnBetween = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class FishSchool {
  private readonly fish = new Map<string, Swimmer>();
  private readonly random: () => number;

  constructor(
    fish: readonly Fish[],
    /** Whether a point is open water a fish can be in. */
    private readonly isWater: (x: number, z: number) => boolean,
    options: SchoolOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    for (const f of fish)
      this.fish.set(f.id, {
        ...f,
        pace: 0.85 + this.random() * 0.3,
        wander: 0,
        roaming: false,
        // Fish start schooled, then each drifts off on its own schedule.
        untilChange: 3 + this.random() * 15,
      });
  }

  get(id: string): Fish | undefined {
    const f = this.fish.get(id);
    return (
      f && {
        id: f.id,
        species: f.species,
        speed: f.speed,
        x: f.x,
        z: f.z,
        heading: f.heading,
      }
    );
  }

  all(): Fish[] {
    return [...this.fish.keys()].map((id) => this.get(id)!);
  }

  /** Long frames are capped, like the frog engine, so a hidden tab can't jump. */
  advance(realSeconds: number, paused = false, heldIds?: ReadonlySet<string>) {
    if (paused) return;
    const dt = Math.min(realSeconds, 0.1);
    for (const f of this.fish.values())
      if (!heldIds?.has(f.id)) this.swim(f, dt);
  }

  private swim(f: Swimmer, dt: number) {
    f.untilChange -= dt;
    if (f.untilChange <= 0) {
      // Fish spend most of their time schooled, with a few seconds off alone.
      f.roaming = !f.roaming;
      f.untilChange = f.roaming
        ? 3 + this.random() * 4
        : 10 + this.random() * 20;
    }
    const heading = direction(f.heading);
    let steerX = heading.x,
      steerZ = heading.z;

    let neighbors = 0,
      alignX = 0,
      alignZ = 0,
      centerX = 0,
      centerZ = 0;
    for (const other of this.fish.values()) {
      if (other === f || other.species !== f.species) continue;
      const dx = other.x - f.x,
        dz = other.z - f.z,
        d = Math.hypot(dx, dz);
      if (d > NEIGHBOR_RANGE) continue;
      if (d < PERSONAL_SPACE && d > 0) {
        steerX -= (dx / d) * (PERSONAL_SPACE - d) * 6;
        steerZ -= (dz / d) * (PERSONAL_SPACE - d) * 6;
      }
      // The school doesn't follow a fish that has wandered off on its own.
      if (other.roaming) continue;
      neighbors++;
      const otherHeading = direction(other.heading);
      alignX += otherHeading.x;
      alignZ += otherHeading.z;
      centerX += other.x;
      centerZ += other.z;
    }
    if (neighbors && !f.roaming) {
      steerX += (alignX / neighbors) * 0.6;
      steerZ += (alignZ / neighbors) * 0.6;
      steerX += (centerX / neighbors - f.x) * 0.5;
      steerZ += (centerZ / neighbors - f.z) * 0.5;
    }

    // A roaming fish meanders more widely than one keeping with the school.
    const reach = f.roaming ? 1.6 : 0.8;
    f.wander += (this.random() - 0.5) * 3 * dt;
    f.wander = Math.max(-reach, Math.min(reach, f.wander));
    let target = Math.atan2(-steerX, -steerZ) + f.wander * dt;
    if (!this.waterAhead(f, target)) {
      const escape = ESCAPE_ANGLES.map((a) => target + a).find((angle) =>
        this.waterAhead(f, angle),
      );
      if (escape !== undefined) target = escape;
    }
    const turn = turnBetween(f.heading, target);
    f.heading += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, turn));

    const step = direction(f.heading),
      distance = f.speed * f.pace * dt;
    const x = f.x + step.x * distance,
      z = f.z + step.z * distance;
    if (this.isWater(x, z)) {
      f.x = x;
      f.z = z;
    }
  }

  private waterAhead(f: Fish, heading: number) {
    const ahead = direction(heading);
    return this.isWater(f.x + ahead.x * LOOK_AHEAD, f.z + ahead.z * LOOK_AHEAD);
  }
}
