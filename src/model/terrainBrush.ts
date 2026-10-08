import type { Environment } from "./schema";
import {
  TERRAIN_COLUMNS,
  TERRAIN_ROWS,
  TERRAIN_POINTS,
  groundCeiling,
  terrainPoint,
  type GroundMaterial,
} from "./terrainData";
import { baseGroundHeight, groundHeight, clamp } from "./terrain";

export type TerrainMode =
  | "raise"
  | "lower"
  | "smooth"
  | "pool"
  | "stream"
  | Exclude<GroundMaterial, "natural">;
export interface TerrainBrush {
  mode: TerrainMode;
  radius: number;
}

export function applyTerrainBrush(
  env: Environment,
  x: number,
  z: number,
  brush: TerrainBrush,
  heightStep = 0.07,
): Environment {
  const terrain = env.terrain ?? {
    heights: Array<number>(TERRAIN_POINTS).fill(0),
    paint: Array<GroundMaterial>(TERRAIN_POINTS).fill("natural"),
  };
  const heights = [...terrain.heights],
    paint = [...terrain.paint];
  const water =
    brush.mode === "pool" || brush.mode === "stream"
      ? Math.max(0.35, env.water)
      : env.water;
  let changed = water !== env.water;
  for (let index = 0; index < TERRAIN_POINTS; index++) {
    const point = terrainPoint(index, env);
    const distance = Math.hypot(point.x - x, point.z - z) / brush.radius;
    if (distance >= 1) continue;
    const weight = (1 - distance * distance) ** 2;
    const base = baseGroundHeight(point.x, point.z, env),
      height = groundHeight(point.x, point.z, env);
    let delta = terrain.heights[index];
    if (brush.mode === "raise" || brush.mode === "lower")
      delta += (brush.mode === "raise" ? heightStep : -heightStep) * weight;
    else if (brush.mode === "pool" || brush.mode === "stream")
      delta += Math.min(0, water - 0.2 - height) * weight;
    else if (brush.mode === "smooth") {
      const col = index % (TERRAIN_COLUMNS + 1),
        row = Math.floor(index / (TERRAIN_COLUMNS + 1));
      const neighbors = [
        [col, row],
        [Math.max(0, col - 1), row],
        [Math.min(TERRAIN_COLUMNS, col + 1), row],
        [col, Math.max(0, row - 1)],
        [col, Math.min(TERRAIN_ROWS, row + 1)],
      ];
      const average =
        neighbors.reduce((sum, [cx, cz]) => {
          const p = terrainPoint(cz * (TERRAIN_COLUMNS + 1) + cx, env);
          return sum + groundHeight(p.x, p.z, env);
        }, 0) / neighbors.length;
      delta += (average - height) * weight * 0.65;
    } else if (weight > 0.15) paint[index] = brush.mode;
    if (
      brush.mode === "soil" ||
      brush.mode === "sand" ||
      brush.mode === "stone" ||
      brush.mode === "moss"
    ) {
      changed ||= paint[index] !== terrain.paint[index];
      continue;
    }
    heights[index] =
      Math.round(
        clamp(delta, Math.max(-0.9, 0.08 - base), groundCeiling(env) - base) *
          10000,
      ) / 10000;
    changed ||=
      heights[index] !== terrain.heights[index] ||
      paint[index] !== terrain.paint[index];
  }
  return changed ? { ...env, water, terrain: { heights, paint } } : env;
}
