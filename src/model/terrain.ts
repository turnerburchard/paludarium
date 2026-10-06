import type { Environment, HabitatObject, AssetKind } from "./schema";
import { assets } from "./catalog";
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
const smoothstep = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
/** One shared surface function keeps rendered terrain, placement and animals aligned. */
export function groundHeight(x: number, z: number, env: Environment): number {
  const nx = x / env.width,
    nz = z / env.depth;
  const bank = 1 - smoothstep((nx + 0.08 + 0.09 * Math.sin(nz * 7)) / 0.42);
  const detail = 0.035 * Math.sin(x * 3.1) * Math.cos(z * 3.4);
  return env.substrate + bank * (0.42 + 0.16 * (nz + 0.5)) + detail;
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
): string | null {
  const ground = groundHeight(x, z, env);
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
/** Tiny seeded generator: asset silhouettes remain stable across saves and undo. */
export function randomFromSeed(seed: number) {
  let value = seed | 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) | 0;
    return (value >>> 0) / 4294967296;
  };
}
