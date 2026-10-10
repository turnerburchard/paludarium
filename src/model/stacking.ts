import { assets, modelHeight } from "../assets";
import type { Environment, HabitatObject } from "./schema";
import { groundHeight } from "./terrain";
import { waterLevel } from "./water";

/** Where an object's base sits: on the ground, on the stone or wood it was
 * placed on, or on the surface for floating plants. Stone and wood settle to
 * the lowest ground under them, so on a slope no side hangs in the air. */
export function objectBase(object: HabitatObject, env: Environment) {
  const asset = assets[object.kind];
  const points =
    asset.groundPoints ?? (asset.hardscape && footprintRing(asset.radius));
  let ground = groundHeight(object.x, object.z, env);
  if (points && !object.support) {
    // Never so deep it vanishes, as a stone at the lip of a drop would.
    const deepest =
      ground - 0.9 * modelHeight(object.kind, object.seed) * object.scale;
    ground = Math.max(lowestGround(object, points, env), deepest);
  }
  const base = ground + (object.lift ?? 0);
  return asset.floats
    ? Math.max(base, waterLevel(object.x, object.z, env))
    : base;
}

/** Points around a piece's footprint. The radius bounds the whole model, so
 * the ring sits inside it, where the piece meets the ground. */
function footprintRing(radius: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * 2 * Math.PI;
    return {
      x: 0.7 * radius * Math.cos(angle),
      z: 0.7 * radius * Math.sin(angle),
    };
  });
}

/** The lowest ground under points on a model, after it is turned and
 * scaled into place. */
function lowestGround(
  object: HabitatObject,
  points: readonly { x: number; z: number }[],
  env: Environment,
) {
  const grow = object.scale * (assets[object.kind].size ?? 1);
  const cos = Math.cos(object.rotation),
    sin = Math.sin(object.rotation);
  return Math.min(
    ...points.map((p) =>
      // Matches how Three.js turns a model about its vertical axis.
      groundHeight(
        object.x + (p.x * cos + p.z * sin) * grow,
        object.z + (-p.x * sin + p.z * cos) * grow,
        env,
      ),
    ),
  );
}

/** A spot the pointer found on a stone or wood piece: which one, and the
 * height of the spot. */
export interface Surface {
  support: string;
  y: number;
}

/** How an object placed at x, z rests on a surface. Spots barely above the
 * ground count as ground. */
export function restingOn(
  surface: Surface | undefined,
  x: number,
  z: number,
  env: Environment,
): Pick<HabitatObject, "support" | "lift"> {
  const lift = surface ? surface.y - groundHeight(x, z, env) : 0;
  return surface && lift > 0.02
    ? { support: surface.support, lift }
    : { support: undefined, lift: undefined };
}

/** Replaces one object and carries whatever rests on it along, so plants and
 * stones stacked on a rock follow it when it moves, turns or grows. Without a
 * replacement the object is removed and what rested on it settles to the
 * ground. */
export function replaceObject(
  objects: HabitatObject[],
  env: Environment,
  id: string,
  next?: HabitatObject,
): HabitatObject[] {
  const updates = new Map<string, HabitatObject | undefined>([[id, next]]);
  const carry = (before: HabitatObject, after: HabitatObject | undefined) => {
    for (const child of objects) {
      if (child.support !== before.id || updates.has(child.id)) continue;
      const moved = after
        ? carried(child, before, after, env)
        : { ...child, lift: undefined, support: undefined };
      updates.set(child.id, moved);
      carry(child, moved);
    }
  };
  const before = objects.find((o) => o.id === id);
  if (before) carry(before, next);
  return objects.flatMap((o) => {
    if (!updates.has(o.id)) return [o];
    const update = updates.get(o.id);
    return update ? [update] : [];
  });
}

/** The same spot on a support after the support moves, turns or rescales. */
function carried(
  child: HabitatObject,
  before: HabitatObject,
  after: HabitatObject,
  env: Environment,
): HabitatObject {
  const turn = after.rotation - before.rotation,
    grow = after.scale / before.scale;
  const dx = child.x - before.x,
    dz = child.z - before.z;
  // Matches how Three.js turns a model about its vertical axis.
  const x = after.x + (dx * Math.cos(turn) + dz * Math.sin(turn)) * grow;
  const z = after.z + (-dx * Math.sin(turn) + dz * Math.cos(turn)) * grow;
  const height = objectBase(child, env) - objectBase(before, env);
  const base = objectBase(after, env) + height * grow;
  return {
    ...child,
    x,
    z,
    rotation: child.rotation + turn,
    lift: Math.max(0, base - groundHeight(x, z, env)),
  };
}

/** Keeps stacked objects at their height on their supports when the ground
 * under them changes, as it does when sculpting or resizing the tank. */
export function keepStacked(
  objects: HabitatObject[],
  before: Environment,
  after: Environment,
): HabitatObject[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const settled = new Map<string, HabitatObject>();
  // Supports settle first, so a whole stack keeps its shape.
  const settle = (object: HabitatObject): HabitatObject => {
    const done = settled.get(object.id);
    if (done) return done;
    const support = object.support && byId.get(object.support);
    let result = object;
    if (support) {
      const height = objectBase(object, before) - objectBase(support, before);
      const base = objectBase(settle(support), after) + height;
      result = {
        ...object,
        lift: Math.max(0, base - groundHeight(object.x, object.z, after)),
      };
    }
    settled.set(object.id, result);
    return result;
  };
  return objects.map(settle);
}

/** Whether `lower` holds up `upper`, directly or through things stacked
 * between them. */
export function holdsUp(
  objects: HabitatObject[],
  lower: string,
  upper: string,
) {
  const seen = new Set<string>();
  for (
    let id: string | undefined = upper;
    id && !seen.has(id);
    id = objects.find((o) => o.id === id)?.support
  ) {
    if (id === lower) return true;
    seen.add(id);
  }
  return false;
}
