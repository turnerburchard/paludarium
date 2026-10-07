import type { Environment, HabitatObject, AssetKind } from "./schema";
import { assets } from "../assets";
import { terrainSamples } from "./terrainData";
export const MAX_GROUND_HEIGHT = 1.25;
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
const smoothstep = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
/** One shared surface function keeps rendered terrain, placement and animals aligned. */
export function baseGroundHeight(
  x: number,
  z: number,
  env: Environment,
): number {
  const nx = x / env.width,
    nz = z / env.depth;
  const bank = 1 - smoothstep((nx + 0.08 + 0.09 * Math.sin(nz * 7)) / 0.42);
  const detail = 0.035 * Math.sin(x * 3.1) * Math.cos(z * 3.4);
  return env.substrate + bank * (0.42 + 0.16 * (nz + 0.5)) + detail;
}
export function groundHeight(x: number, z: number, env: Environment): number {
  const base = baseGroundHeight(x, z, env);
  if (!env.terrain) return base;
  const delta = terrainSamples(x, z, env).reduce(
    (sum, sample) => sum + env.terrain!.heights[sample.index] * sample.weight,
    0,
  );
  return clamp(base + delta, 0.08, MAX_GROUND_HEIGHT);
}
/** The upward surface normal of the ground, from its slope. */
export function groundNormal(x: number, z: number, env: Environment) {
  const step = 0.01;
  const dx = groundHeight(x + step, z, env) - groundHeight(x - step, z, env);
  const dz = groundHeight(x, z + step, env) - groundHeight(x, z - step, env);
  const length = Math.hypot(dx, 2 * step, dz);
  return { x: -dx / length, y: (2 * step) / length, z: -dz / length };
}
/** Stretch each species' preferred depth in a deep tank, keeping shallow
 * pond behavior unchanged and enough clearance above the substrate. */
export function swimmingHeight(
  x: number,
  z: number,
  env: Environment,
  depth: number,
  bob = 0,
  clearance = 0.05,
): number {
  const ground = groundHeight(x, z, env);
  const preferredDepth = depth * Math.max(1, (env.water - ground) / 0.4);
  return Math.max(ground + clearance, env.water - preferredDepth + bob);
}
export function boundedPosition(
  x: number,
  z: number,
  env: Environment,
  margin = 0.35,
) {
  return {
    x: clamp(x, -env.width / 2 + margin, env.width / 2 - margin),
    z: clamp(z, -env.depth / 2 + margin, env.depth / 2 - margin),
  };
}
export function placementProblem(
  kind: AssetKind,
  x: number,
  z: number,
  env: Environment,
  lift = 0,
): string | null {
  const ground = groundHeight(x, z, env) + lift;
  if (assets[kind].habitat === "land" && ground < env.water + 0.025)
    return "Find a dry spot on the bank.";
  if (assets[kind].habitat === "water" && ground > env.water - 0.12)
    return "Find deeper water, or raise the water level.";
  return null;
}
export function fitObject(
  object: HabitatObject,
  env: Environment,
): HabitatObject {
  return {
    ...object,
    ...boundedPosition(
      object.x,
      object.z,
      env,
      assets[object.kind].radius * object.scale,
    ),
  };
}
