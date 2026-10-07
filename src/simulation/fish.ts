/** Fish swim in open water as a loose school. Like the frog engine, this owns
 * positions and decisions; the renderer only reads them. Units are scene
 * units and real seconds. */

import type { Environment } from "../model/schema";

export interface Fish {
  id: string;
  /** Fish school only with their own species. */
  species: string;
  /** Cruising speed in scene units per second. */
  speed: number;
  x: number;
  z: number;
  /** Steady swimming height, when supplied by the habitat. */
  y?: number;
  /** Available vertical motion without touching the floor or surface. */
  bob?: number;
  /** Swimming direction in radians; 0 points toward -z. */
  heading: number;
}

export interface SchoolOptions {
  random?: () => number;
  previous?: FishSchool;
  canSwim?: (
    fish: Fish,
    x: number,
    z: number,
    heading: number,
    padding?: number,
  ) => boolean;
  height?: (fish: Fish, x: number, z: number, preview?: Environment) => number;
  bob?: (fish: Fish, x: number, z: number, preview?: Environment) => number;
}

const TURN_RATE = 2.2;
const TURN_ACCELERATION = 6;
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
  avoidSide: number;
  clearFor: number;
  untilProbe: number;
  avoidHeading?: number;
  avoidFor: number;
  turnRate: number;
  retreatFor: number;
  stillFor: number;
  retreatDistance: number;
  trail: Array<Pick<Fish, "x" | "z" | "heading">>;
}

const direction = (heading: number) => ({
  x: -Math.sin(heading),
  z: -Math.cos(heading),
});
/** Smallest signed angle from a to b. */
const turnBetween = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));

function turnToward(
  heading: number,
  rate: number,
  target: number,
  seconds: number,
) {
  const turn = turnBetween(heading, target);
  const wanted = Math.max(-TURN_RATE, Math.min(TURN_RATE, turn / seconds));
  const acceleration = TURN_ACCELERATION * seconds;
  rate += Math.max(-acceleration, Math.min(acceleration, wanted - rate));
  const rotation = rate * seconds;
  if (
    Math.sign(rotation) === Math.sign(turn) &&
    Math.abs(rotation) >= Math.abs(turn)
  )
    return { heading: heading + turn, rate: 0 };
  return { heading: heading + rotation, rate };
}

export class FishSchool {
  private readonly fish = new Map<string, Swimmer>();
  private readonly random: () => number;
  private readonly options: Pick<SchoolOptions, "canSwim" | "height" | "bob">;

  constructor(
    fish: readonly Fish[],
    /** Whether a point is open water a fish can be in. */
    private readonly isWater: (x: number, z: number) => boolean,
    options: SchoolOptions = {},
  ) {
    this.random = options.random ?? options.previous?.random ?? Math.random;
    this.options = {
      canSwim: options.canSwim,
      height: options.height,
      bob: options.bob,
    };
    for (const f of fish) {
      const old = options.previous?.fish.get(f.id);
      const unchanged =
        old &&
        old.species === f.species &&
        old.x === f.x &&
        old.z === f.z &&
        old.heading === f.heading;
      this.fish.set(
        f.id,
        unchanged
          ? { ...old, ...f, trail: old.trail.map((pose) => ({ ...pose })) }
          : {
              ...f,
              pace: 0.85 + this.random() * 0.3,
              wander: 0,
              roaming: false,
              // Fish start schooled, then each drifts off on its own schedule.
              untilChange: 3 + this.random() * 15,
              avoidSide: 0,
              clearFor: 0,
              untilProbe: 0,
              avoidFor: 0,
              turnRate: 0,
              retreatFor: 0,
              stillFor: 0,
              retreatDistance: 0,
              trail: [],
            },
      );
    }
  }

  get(id: string, preview?: Environment): Fish | undefined {
    const f = this.fish.get(id);
    return (
      f && {
        id: f.id,
        species: f.species,
        speed: f.speed,
        x: f.x,
        z: f.z,
        heading: f.heading,
        ...(this.options.height && {
          y: this.options.height(f, f.x, f.z, preview),
        }),
        ...(this.options.bob && {
          bob: this.options.bob(f, f.x, f.z, preview),
        }),
      }
    );
  }

  all(): Fish[] {
    return [...this.fish.keys()].map((id) => this.get(id)!);
  }

  /** Long frames are capped, like the frog engine, so a hidden tab can't jump. */
  advance(realSeconds: number, paused = false, heldIds?: ReadonlySet<string>) {
    if (paused || realSeconds <= 0) return;
    const dt = Math.min(realSeconds, 0.1);
    for (const f of this.fish.values())
      if (!heldIds?.has(f.id)) this.swim(f, dt);
  }

  private swim(f: Swimmer, dt: number) {
    if (f.retreatFor > 0) {
      f.retreatFor -= dt;
      const previous = f.trail.at(-1);
      if (previous) {
        const distance = Math.hypot(previous.x - f.x, previous.z - f.z);
        const turn = turnBetween(f.heading, previous.heading);
        const fraction =
          1 /
          Math.max(
            1,
            distance / (f.speed * f.pace * 0.5 * dt),
            Math.abs(turn) / (TURN_RATE * dt),
          );
        const x = f.x + (previous.x - f.x) * fraction;
        const z = f.z + (previous.z - f.z) * fraction;
        const heading = f.heading + turn * fraction;
        if (this.pathClear(f, x, z, heading)) {
          f.x = x;
          f.z = z;
          f.heading = heading;
          f.retreatDistance += distance * fraction;
          if (fraction === 1) f.trail.pop();
          if (f.retreatDistance >= 0.08) f.retreatFor = 0;
        } else f.retreatFor = 0;
      } else f.retreatFor = 0;
      f.untilProbe = 0;
      f.turnRate = 0;
      return;
    }
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
    const desired = Math.atan2(-steerX, -steerZ) + f.wander * dt;
    f.avoidFor -= dt;
    f.untilProbe -= dt;
    // Steering decisions needn't rebuild nine routes on every rendered
    // frame. The swept body check still guards every movement step.
    if (f.untilProbe <= 0) {
      f.untilProbe = 0.15;
      const lookAhead = Math.max(LOOK_AHEAD, f.speed * f.pace * 1.8);
      if (this.route(f, desired, lookAhead) < lookAhead) {
        f.clearFor = 0;
        f.avoidFor = 0.6;
        // Keep a chosen route while it remains clear; replanning the turn
        // on every probe makes a fish zigzag along a jagged stone edge.
        const continuing =
          f.avoidHeading !== undefined &&
          this.route(f, f.avoidHeading, lookAhead, 0.55) === lookAhead;
        if (!continuing) {
          let best = -Infinity;
          for (const angle of ESCAPE_ANGLES) {
            const heading = f.heading + angle;
            const side = Math.sign(angle);
            const penalty =
              Math.abs(angle) * 0.025 +
              (f.avoidSide && side !== f.avoidSide ? lookAhead * 0.2 : 0);
            if (lookAhead - penalty <= best) continue;
            // Slowing gives a fish room to bend around nearby obstacles.
            const clear = this.route(f, heading, lookAhead, 0.55);
            // A preferred side must never win over the only passable route.
            const score = clear * (1 - penalty / lookAhead);
            if (score > best) {
              best = score;
              f.avoidHeading = heading;
            }
          }
        }
        f.avoidSide = Math.sign(turnBetween(f.heading, f.avoidHeading!));
      } else {
        if (f.avoidFor <= 0) f.avoidHeading = undefined;
        f.clearFor += 0.15;
        if (f.clearFor > 1) f.avoidSide = 0;
      }
    }
    this.move(
      f,
      f.avoidHeading ?? desired,
      f.speed * f.pace * (f.avoidHeading === undefined ? 1 : 0.55) * dt,
      dt,
    );
  }

  private open(f: Fish, x: number, z: number, heading: number, padding = 0) {
    return (
      this.isWater(x, z) &&
      (this.options.canSwim?.(f, x, z, heading, padding) ?? true)
    );
  }

  /** Probe the arc the fish can actually turn through, not a ray it would
   * need to snap onto. Every probe includes the whole animated body. */
  private route(f: Swimmer, target: number, reach: number, pace = 1) {
    let x = f.x,
      z = f.z,
      heading = f.heading,
      rate = f.turnRate,
      traveled = 0;
    const speed = f.speed * f.pace * pace;
    while (traveled < reach) {
      const turn = turnBetween(heading, target);
      // A long tail sweeps sideways during a turn. Probe those intermediate
      // orientations closely, even when a slow fish barely moves forward.
      const seconds = Math.min(
        0.025 / speed,
        Math.abs(turn) > 0.05 ? 0.05 / TURN_RATE : Infinity,
      );
      const step = Math.min(reach - traveled, speed * seconds);
      const turning = turnToward(heading, rate, target, seconds);
      heading = turning.heading;
      rate = turning.rate;
      const forward = direction(heading);
      x += forward.x * step;
      z += forward.z * step;
      if (!this.open(f, x, z, heading, 0.012 * Math.min(1, traveled / 0.08)))
        return traveled;
      traveled += step;
    }
    return reach;
  }

  private pathClear(f: Fish, x: number, z: number, heading: number) {
    // Sweep both translation and rotation so a fin or tail cannot cut
    // through a thin branch between two otherwise clear positions.
    const samples = Math.max(
      1,
      Math.ceil(Math.hypot(x - f.x, z - f.z) / 0.01),
      Math.ceil(Math.abs(heading - f.heading) / 0.04),
    );
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      if (
        !this.open(
          f,
          f.x + (x - f.x) * t,
          f.z + (z - f.z) * t,
          f.heading + (heading - f.heading) * t,
        )
      )
        return false;
    }
    return true;
  }

  private move(f: Swimmer, target: number, distance: number, dt: number) {
    const turning = turnToward(f.heading, f.turnRate, target, dt);
    const step = direction(turning.heading);
    const x = f.x + step.x * distance,
      z = f.z + step.z * distance;
    if (this.pathClear(f, x, z, turning.heading)) {
      this.remember(f);
      f.x = x;
      f.z = z;
      f.heading = turning.heading;
      f.turnRate = turning.rate;
      f.stillFor = 0;
      return;
    }
    f.untilProbe = 0;
    f.stillFor += dt;
    if (
      f.stillFor < 0.8 &&
      Math.abs(turning.heading - f.heading) > 0.001 &&
      this.pathClear(f, f.x, f.z, turning.heading)
    ) {
      this.remember(f);
      f.heading = turning.heading;
      f.turnRate = turning.rate;
      return;
    }
    f.turnRate = 0;
    const forward = direction(f.heading);
    if (
      this.pathClear(
        f,
        f.x + forward.x * distance,
        f.z + forward.z * distance,
        f.heading,
      )
    ) {
      this.remember(f);
      f.x += forward.x * distance;
      f.z += forward.z * distance;
      f.stillFor = 0;
      return;
    }
    // A tall fish can enter a gap it cannot turn around in. Retrace its
    // recent poses, including the turn, rather than backing into another
    // leaf at its current heading. Every retreat step is checked again.
    f.retreatFor = 2;
    f.retreatDistance = 0;
    f.stillFor = 0;
    f.avoidSide = -f.avoidSide || -1;
    f.avoidHeading = f.heading + f.avoidSide * 1.6;
    f.avoidFor = 1.2;
  }

  private remember(f: Swimmer) {
    f.trail.push({ x: f.x, z: f.z, heading: f.heading });
    if (f.trail.length > 120) f.trail.shift();
  }
}
