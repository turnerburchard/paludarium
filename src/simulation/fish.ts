/** How fish move through the water. The engine chooses where each fish is
 * going; this turns that into fluid swimming: capped turning, a loose school,
 * a meandering wander, and avoiding obstacles with the fish's real body.
 * Times are real seconds at normal simulation speed. */

import type { Vec3 } from "./types";

/** The water fish swim in. Heights are steady swimming heights, before the
 * bob that is drawn on top. */
export interface SwimWater {
  /** The nearest height to `wanted` that keeps the body off the floor and
   * below the surface, and how far it can bob there. */
  steady(
    id: string,
    x: number,
    z: number,
    wanted: number,
  ): { y: number; bob: number };
  canSwim(
    id: string,
    x: number,
    y: number,
    z: number,
    heading: number,
    clearance?: Clearance,
  ): boolean;
  /** Half the length of the fish's body. */
  reach(id: string): number;
}

/** What a fish's body has to keep clear of. */
export interface Clearance {
  /** Extra room around the body, for steering. */
  padding?: number;
  /** Curled up from a tight turn: a shorter body that pushes leaves aside,
   * so only stone, wood and glass are in the way. */
  curled?: boolean;
}

export interface Fish {
  id: string;
  /** Fish school only with their own species. */
  species: string;
  /** Cruising speed in scene units per second. */
  speed: number;
  x: number;
  y: number;
  z: number;
  /** Swimming direction in radians; 0 points toward -z. */
  heading: number;
}

const TURN_RATE = 2.2;
const TURN_ACCELERATION = 6;
const NEIGHBOR_RANGE = 1.3;
const PERSONAL_SPACE = 0.3;
const LOOK_AHEAD = 0.4;
/** How strongly a fish heads for where it is going, against schooling. */
const GOAL_PULL = 1.5;
/** How sharply (radians) a fish veers away from an obstacle beside it. */
const SHY_TURN = 0.4;
/** Climbing and diving are slower than swimming forward, and ease in. */
const CLIMB_SHARE = 0.35;
const CLIMB_ACCELERATION = 0.15;
const BOB_RATE = 1.3;
/** A fish with no room to swim on turns sharply on the spot, drifting
 * forward a little as it goes. */
const TIGHT_TURN_RATE = 3;
const TIGHT_TURN_PACE = 0.2;
/** How far a fish bends, in radians from head to tail, curled up for a
 * tight turn. */
export const CURL = 2.8;
/** The curled body's span along its old length, and how far it bows
 * sideways, as shares of its length. The curl is centered on the fish. */
export const CURLED_LENGTH = Math.sin(CURL / 2) / (CURL / 2);
export const CURLED_BOW = (1 - Math.cos(CURL / 2)) / CURL;
/** Probe angles, nearest first, for finding open water when the shore is ahead. */
const ESCAPE_ANGLES = [0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI];

/** A fish with its swimming state: a slightly different pace, a gentle
 * turning rate (radians per second) that drifts so each fish meanders its
 * own way, and a clock for when it next leaves or rejoins the others. */
export interface Swimmer extends Fish {
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
  /** Vertical speed. */
  climb: number;
  /** Where the bob is in its cycle. */
  bobPhase: number;
  /** Which way it is turning on the spot: 1 left, -1 right, 0 not. */
  tightTurn: number;
  /** Which way it is curled up from a tight turn, 0 once it has room to
   * straighten out again. */
  curl: number;
  /** Which way, and how strongly, it drifts away from something beside it. */
  shy: number;
  /** Set when it has had to turn out of a dead end. */
  blocked: boolean;
}

export function newSwimmer(fish: Fish, random: () => number): Swimmer {
  return {
    ...fish,
    pace: 0.85 + random() * 0.3,
    wander: 0,
    roaming: false,
    // Fish start schooled, then each drifts off on its own schedule.
    untilChange: 3 + random() * 15,
    avoidSide: 0,
    clearFor: 0,
    untilProbe: 0,
    avoidFor: 0,
    turnRate: 0,
    climb: 0,
    bobPhase: random() * Math.PI * 2,
    tightTurn: 0,
    curl: 0,
    shy: 0,
    blocked: false,
  };
}

const direction = (heading: number) => ({
  x: -Math.sin(heading),
  z: -Math.cos(heading),
});
/** Smallest signed angle from a to b. */
const turnBetween = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

function turnToward(
  heading: number,
  rate: number,
  target: number,
  seconds: number,
) {
  const turn = turnBetween(heading, target);
  const wanted = clamp(turn / seconds, TURN_RATE);
  rate += clamp(wanted - rate, TURN_ACCELERATION * seconds);
  const rotation = rate * seconds;
  if (
    Math.sign(rotation) === Math.sign(turn) &&
    Math.abs(rotation) >= Math.abs(turn)
  )
    return { heading: heading + turn, rate: 0 };
  return { heading: heading + rotation, rate };
}

export class Steering {
  constructor(
    private readonly water: SwimWater,
    private readonly random: () => number,
  ) {}

  /** Swim for `dt` seconds toward `goal`, among the rest of the `fish`.
   * Returns how far the bob lifts the body. */
  swim(
    f: Swimmer,
    fish: Iterable<Swimmer>,
    goal: Vec3 | undefined,
    dt: number,
  ) {
    f.bobPhase += BOB_RATE * dt;
    this.steer(f, fish, goal, dt);
    return Math.sin(f.bobPhase) * this.water.steady(f.id, f.x, f.z, f.y).bob;
  }

  /** The slope of the fish's climb or dive. */
  pitch(f: Swimmer) {
    return Math.atan2(f.climb, f.speed * f.pace);
  }

  private steer(
    f: Swimmer,
    fish: Iterable<Swimmer>,
    goal: Vec3 | undefined,
    dt: number,
  ) {
    if (
      f.curl &&
      !f.tightTurn &&
      this.water.canSwim(f.id, f.x, f.y, f.z, f.heading)
    )
      f.curl = 0;
    if (f.tightTurn) {
      this.turnTight(f, dt);
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
    let rise = 0;
    for (const other of fish) {
      if (other === f) continue;
      const dx = other.x - f.x,
        dy = other.y - f.y,
        dz = other.z - f.z,
        d = Math.hypot(dx, dz);
      if (d > NEIGHBOR_RANGE) continue;
      // Keep clear of any fish nearby at much the same depth, whatever its
      // kind, moving apart both sideways and up or down.
      const crowding = PERSONAL_SPACE - Math.hypot(d, dy * 2);
      if (crowding > 0 && d > 0) {
        steerX -= (dx / d) * crowding * 6;
        steerZ -= (dz / d) * crowding * 6;
        rise -= (Math.sign(dy) || (f.id < other.id ? 1 : -1)) * crowding;
      }
      // Fish school only with their own kind, and not with one that has
      // wandered off on its own.
      if (other.species !== f.species || other.roaming) continue;
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
    const climbLimit = f.speed * f.pace * CLIMB_SHARE;
    const climb = clamp(((goal?.y ?? f.y) + rise - f.y) * 0.8, climbLimit);
    f.climb += clamp(climb - f.climb, CLIMB_ACCELERATION * dt);
    if (goal) {
      const dx = goal.x - f.x,
        dz = goal.z - f.z,
        d = Math.hypot(dx, dz);
      if (d > 0.001) {
        steerX += (dx / d) * GOAL_PULL;
        steerZ += (dz / d) * GOAL_PULL;
      }
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
      f.shy = this.shyness(f);
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
          // Heading somewhere, look for a way around nearest to where it
          // wants to go, or it keeps nosing into the same corner. Just
          // milling about, look nearest to where it already faces.
          const around = goal ? desired : f.heading;
          for (const angle of ESCAPE_ANGLES) {
            const heading = around + angle;
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
    // Veer away from glass, stone or leaves alongside, even while steering
    // around something ahead, so there is always room to turn.
    this.move(
      f,
      (f.avoidHeading ?? desired) + f.shy * SHY_TURN,
      f.speed * f.pace * (f.avoidHeading === undefined ? 1 : 0.55) * dt,
      dt,
    );
  }

  /** The steady height at a point, continuing the current climb. */
  private height(f: Swimmer, x: number, z: number, seconds: number) {
    return this.water.steady(f.id, x, z, f.y + f.climb * seconds).y;
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
      const y = this.height(f, x, z, traveled / speed);
      const padding = 0.012 * Math.min(1, traveled / 0.08);
      const clearance = { padding, curled: f.curl !== 0 };
      if (!this.water.canSwim(f.id, x, y, z, heading, clearance))
        return traveled;
      traveled += step;
    }
    return reach;
  }

  private pathClear(
    f: Swimmer,
    x: number,
    y: number,
    z: number,
    heading: number,
    curled = f.curl !== 0,
  ) {
    // Sweep both translation and rotation so a fin or tail cannot cut
    // through a thin branch between two otherwise clear positions.
    const samples = Math.max(
      1,
      Math.ceil(Math.hypot(x - f.x, y - f.y, z - f.z) / 0.01),
      Math.ceil(Math.abs(heading - f.heading) / 0.04),
    );
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      if (
        !this.water.canSwim(
          f.id,
          f.x + (x - f.x) * t,
          f.y + (y - f.y) * t,
          f.z + (z - f.z) * t,
          f.heading + (heading - f.heading) * t,
          { curled },
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
    const y = this.height(f, x, z, dt);
    if (this.pathClear(f, x, y, z, turning.heading)) {
      f.x = x;
      f.y = y;
      f.z = z;
      f.heading = turning.heading;
      f.turnRate = turning.rate;
      return;
    }
    f.untilProbe = 0;
    f.turnRate = 0;
    // The turn may be what swings the tail into something.
    const forward = direction(f.heading);
    const ahead = {
      x: f.x + forward.x * distance,
      z: f.z + forward.z * distance,
    };
    const level = this.height(f, ahead.x, ahead.z, 0);
    if (this.pathClear(f, ahead.x, level, ahead.z, f.heading)) {
      f.x = ahead.x;
      f.y = level;
      f.z = ahead.z;
      return;
    }
    f.climb = 0;
    f.tightTurn = Math.sign(turnBetween(f.heading, target)) || f.avoidSide || 1;
    f.avoidHeading = undefined;
  }

  /** Turn on the spot until there is a body length of open water ahead,
   * drifting forward a little where there is room, and curling up where
   * there is not. A turn that would still swing the body into something
   * carries on the other way. */
  private turnTight(f: Swimmer, dt: number) {
    const heading = f.heading + f.tightTurn * TIGHT_TURN_RATE * dt;
    const forward = direction(heading);
    const drift = f.speed * f.pace * TIGHT_TURN_PACE * dt;
    const next = [0, f.tightTurn]
      .flatMap((curl) =>
        [drift, 0].map((distance) => {
          const x = f.x + forward.x * distance,
            z = f.z + forward.z * distance;
          return { x, y: this.water.steady(f.id, x, z, f.y).y, z, curl };
        }),
      )
      .find(({ x, y, z, curl }) =>
        this.pathClear(f, x, y, z, heading, curl !== 0),
      );
    if (!next) {
      f.tightTurn = -f.tightTurn;
      return;
    }
    Object.assign(f, next, { heading });
    const length = this.water.reach(f.id) * 2;
    if (this.route(f, f.heading, length, 0.55) === length) {
      f.tightTurn = 0;
      // Swim on the way it now faces, and choose somewhere new from here.
      f.blocked = true;
      f.avoidHeading = f.heading;
      f.avoidFor = 0.6;
    }
  }

  /** Feel half a body length to either side, the room a fish needs to turn
   * around: 1 to move left, -1 to move right, 0 if both sides are clear or
   * both are blocked. */
  private shyness(f: Swimmer) {
    const left = direction(f.heading + Math.PI / 2);
    const reach = this.water.reach(f.id);
    const open = (side: number) =>
      this.water.canSwim(
        f.id,
        f.x + left.x * side * reach,
        f.y,
        f.z + left.z * side * reach,
        f.heading,
      );
    return Number(open(1)) - Number(open(-1));
  }
}
