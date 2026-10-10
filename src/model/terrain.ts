import type { Environment, HabitatObject } from "./schema";
import { assetRadius } from "../assets";
import { terrainSamples, groundCeiling } from "./terrainData";
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
/** The upward surface normal of the ground, from its slope. */
export function groundNormal(x: number, z: number, env: Environment) {
  const step = 0.01;
  const dx = groundHeight(x + step, z, env) - groundHeight(x - step, z, env);
  const dz = groundHeight(x, z + step, env) - groundHeight(x, z - step, env);
  const length = Math.hypot(dx, 2 * step, dz);
  return { x: -dx / length, y: (2 * step) / length, z: -dz / length };
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
