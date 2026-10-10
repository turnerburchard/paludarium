import type { Caster } from "./solids";
import type { Vec3 } from "./types";

/** An animal's size as built and scaled: nose to tail, side to side, and
 * feet to back. */
export interface Body {
  length: number;
  width: number;
  height: number;
}

export interface BodyPose {
  position: Vec3;
  normal: Vec3;
  direction: Vec3;
}

const add = (a: Vec3, b: Vec3, s = 1): Vec3 => ({
  x: a.x + b.x * s,
  y: a.y + b.y * s,
  z: a.z + b.z * s,
});
const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const scale = (v: Vec3, s: number): Vec3 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});
const negate = (v: Vec3) => scale(v, -1);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (v: Vec3): Vec3 | undefined => {
  const length = Math.hypot(v.x, v.y, v.z);
  return length < 1e-6
    ? undefined
    : { x: v.x / length, y: v.y / length, z: v.z / length };
};

/** Where the feet are, in halves of the body's length and width. */
const FOOTPRINT = [
  [0.85, 0],
  [-0.85, 0],
  [0, 0.7],
  [0, -0.7],
  [0.6, 0.6],
  [0.6, -0.6],
  [-0.6, 0.6],
  [-0.6, -0.6],
];

/** The most any foot would have to rise to stand on what is under it, and
 * where that foot is from the middle of the body. */
function footing(
  position: Vec3,
  normal: Vec3,
  direction: Vec3,
  body: Body,
  solids: Caster,
) {
  const right = cross(direction, normal),
    reach = Math.max(body.height, 0.03);
  let highest = { lift: 0, offset: direction };
  for (const [a, b] of FOOTPRINT) {
    const offset = add(
      scale(direction, (a * body.length) / 2),
      right,
      (b * body.width) / 2,
    );
    const foot = add(position, offset);
    const hit = solids.cast(add(foot, normal, reach), negate(normal), reach);
    if (hit && reach - hit.distance > highest.lift)
      highest = { lift: reach - hit.distance, offset };
  }
  return highest;
}

/** Over a bump higher than its two ends, a body tips onto the bump and the
 * higher end rather than balancing with both in the air. The lower end is
 * replaced by the higher one mirrored through the bump. */
function tip(a: Vec3, b: Vec3, bump: Vec3 | undefined, up: Vec3): [Vec3, Vec3] {
  if (!bump || 2 * dot(bump, up) <= dot(a, up) + dot(b, up)) return [a, b];
  const mirror = (end: Vec3) => add(scale(bump, 2), end, -1);
  return dot(a, up) >= dot(b, up) ? [a, mirror(a)] : [mirror(b), b];
}

/** How far below the given spot a body still finds the surface to rest on. */
const FALL = 0.4;

/** Sets the body down on whatever is under it. The nose, tail and sides each
 * feel for the surface: straight ahead first, so a wall or a steep rise in
 * front tips the body up onto it, then down, so slopes and the far side of
 * a bump tip it to follow. The body then rests on what it found, raised
 * over anything under its middle, and is kept out of whatever its ends and
 * feet would reach into. */
export function fitBody(
  pose: BodyPose,
  body: Body,
  solids: Caster,
  /** Whether the body may come down onto what is under it, or only be
   * kept clear of it, as in the air or on a leaf. */
  settle = true,
): BodyPose {
  let { position, normal, direction } = pose;
  const rise = Math.max(body.height / 2, 0.015);
  // Where the given spot is in the air, as where a long step's straight
  // line passes over a dip, the body first comes down onto what is below.
  if (settle) {
    const below = solids.cast(
      add(position, normal, rise),
      negate(normal),
      rise + FALL,
    );
    if (below && below.distance > rise) position = below.point;
  }
  // A second pass feels again from the pose the first one found.
  for (let pass = 0; pass < 2; pass++) {
    const up = normal,
      down = negate(up);
    // Facing straight into the surface, as on reaching the glass, it
    // heads up it instead.
    const forward = [direction, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }]
      .map((v) => unit(add(v, up, -dot(v, up))))
      .find((v) => v !== undefined)!;
    const right = cross(forward, up);
    const middle = add(position, up, rise);
    const feel = (along: Vec3, reach: number) => {
      const ahead = solids.cast(middle, along, reach);
      if (ahead) return ahead.point;
      const end = add(middle, along, reach);
      // Kept clear rather than settled, only what is higher counts.
      const below = solids.cast(end, down, settle ? rise + reach : rise);
      return below ? below.point : add(end, down, rise);
    };
    const centre = solids.cast(middle, down, 2 * rise)?.point;
    const [nose, tail] = tip(
      feel(forward, body.length / 2),
      feel(negate(forward), body.length / 2),
      centre,
      up,
    );
    const [left, side] = tip(
      feel(negate(right), body.width / 2),
      feel(right, body.width / 2),
      centre,
      up,
    );
    const lifted = unit(
      cross(unit(sub(side, left)) ?? right, unit(sub(nose, tail)) ?? forward),
    );
    if (!lifted) return pose;
    // On even ground the first pass already has it.
    const settled = dot(lifted, up) > 0.9995;
    normal = lifted;
    direction = unit(sub(nose, tail)) ?? forward;
    // The body rests on the plane through what its ends and sides found,
    // over the same spot, and never below whatever is under its middle.
    const base = scale(add(add(nose, tail), add(left, side)), 0.25);
    let height = dot(sub(base, position), normal);
    if (centre) height = Math.max(height, dot(sub(centre, position), normal));
    if (!settle) height = Math.max(0, height);
    position = add(position, normal, height);
    if (settled) break;
  }
  // Neither end may reach into anything, as where a stem meets the ground
  // or the nose meets the glass: the body slides back along itself.
  const middle = add(position, normal, rise),
    half = (FOOTPRINT[0][0] * body.length) / 2;
  const blocked = (along: Vec3) =>
    half - (solids.cast(middle, along, half)?.distance ?? half);
  position = add(
    position,
    direction,
    blocked(negate(direction)) - blocked(direction),
  );
  // Nothing under the feet may stand above them, as at the lip of a ledge
  // or the crest of a bump the probes stepped over. The body tilts away
  // from the highest such spot, half lifted there and half kept down on
  // the far side, and is then raised over whatever still is.
  const highest = footing(position, normal, direction, body, solids);
  if (highest.lift > 0) {
    const lift = highest.lift / 2;
    const reach = Math.hypot(
      highest.offset.x,
      highest.offset.y,
      highest.offset.z,
    );
    position = add(position, normal, lift);
    normal =
      unit(add(normal, highest.offset, -lift / (reach * reach))) ?? normal;
    direction =
      unit(add(direction, normal, -dot(direction, normal))) ?? direction;
    const rest = footing(position, normal, direction, body, solids);
    position = add(position, normal, rest.lift);
  }
  return { position, normal, direction };
}
