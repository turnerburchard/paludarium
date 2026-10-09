import type { Environment, HabitatObject, AssetKind } from "./schema";
import { assetRadius, assets } from "../assets";
import {
  terrainSamples,
  terrainGrid,
  terrainPoint,
  terrainPointCount,
  groundCeiling,
} from "./terrainData";
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
  const delta = env.terrain
    ? terrainSamples(x, z, env).reduce(
        (sum, sample) =>
          sum + env.terrain!.heights[sample.index] * sample.weight,
        0,
      )
    : 0;
  return clamp(base + delta, 0.08, groundCeiling(env));
}
/** Whether two environments differ at most in ground paint, which only
 * the renderer reads. */
export function onlyPaintDiffers(a: Environment, b: Environment): boolean {
  const { terrain: before, ...restA } = a,
    { terrain: after, ...restB } = b;
  const keys = Object.keys(restA) as (keyof typeof restA)[];
  return (
    before?.heights === after?.heights &&
    keys.length === Object.keys(restB).length &&
    keys.every((key) => restA[key] === restB[key])
  );
}
export function hasDryGround(env: Environment): boolean {
  const points = terrainPointCount(terrainGrid(env));
  for (let index = 0; index < points; index++) {
    const { x, z } = terrainPoint(index, env);
    if (groundHeight(x, z, env) >= env.water + 0.025) return true;
  }
  return false;
}
/** The upward surface normal of the ground, from its slope. */
export function groundNormal(x: number, z: number, env: Environment) {
  const step = 0.01;
  const dx = groundHeight(x + step, z, env) - groundHeight(x - step, z, env);
  const dz = groundHeight(x, z + step, env) - groundHeight(x, z - step, env);
  const length = Math.hypot(dx, 2 * step, dz);
  return { x: -dx / length, y: (2 * step) / length, z: -dz / length };
}
/** Depths below the surface are given as in water 0.4 deep. Deeper water
 * stretches them in proportion, so schools spread through a deep tank, while
 * shallow ponds keep their real depths. */
function depthScale(x: number, z: number, env: Environment) {
  return Math.max(1, (env.water - groundHeight(x, z, env)) / 0.4);
}
/** The height at a depth, on that 0.4-deep scale. */
export function heightAtDepth(
  x: number,
  z: number,
  env: Environment,
  depth: number,
) {
  return env.water - depth * depthScale(x, z, env);
}
/** The depth of a height, on that 0.4-deep scale. */
export function depthAt(x: number, z: number, env: Environment, y: number) {
  return (env.water - y) / depthScale(x, z, env);
}
/** The middle of a species' depth range, with clearance above the substrate. */
export function swimmingHeight(
  x: number,
  z: number,
  env: Environment,
  depth: readonly [number, number],
  clearance = 0.05,
): number {
  const middle = (depth[0] + Math.min(depth[1], 0.4)) / 2;
  return Math.max(
    groundHeight(x, z, env) + clearance,
    heightAtDepth(x, z, env, middle),
  );
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
      assetRadius(object.kind) * object.scale,
    ),
  };
}
