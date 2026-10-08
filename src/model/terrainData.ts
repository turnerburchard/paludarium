/** New terrain gets a point about this often, in each direction. */
const TERRAIN_SPACING = 0.2;
/** Resizing doubles or halves the grid along an axis when its points drift
 * outside this range, so sculpting detail keeps up with the tank. */
const MIN_SPACING = 0.15;
const MAX_SPACING = 0.3;
/** The rendered ground is this much finer than the terrain grid. */
const SURFACE_DETAIL = 4;
export const DEFAULT_TANK_HEIGHT = 2.9;
export const MIN_TANK_HEIGHT = 1.5;
export const MAX_TANK_HEIGHT = 6;

export function groundCeiling(env: { height: number }) {
  return env.height - 0.05;
}

export function waterCeiling(env: { height: number }) {
  return env.height - 0.25;
}
export const groundMaterials = [
  "natural",
  "soil",
  "sand",
  "stone",
  "moss",
] as const;
export type GroundMaterial = (typeof groundMaterials)[number];

export interface TerrainGrid {
  columns: number;
  rows: number;
}
export interface Terrain extends TerrainGrid {
  heights: number[];
  paint: GroundMaterial[];
}
interface Dimensions {
  width: number;
  depth: number;
  terrain?: TerrainGrid;
}

const defaultGrid = (env: Dimensions): TerrainGrid => ({
  columns: Math.round(env.width / TERRAIN_SPACING),
  rows: Math.round(env.depth / TERRAIN_SPACING),
});

/** The tank's sculpted grid, or the grid new terrain would get. */
export function terrainGrid(env: Dimensions): TerrainGrid {
  return env.terrain ?? defaultGrid(env);
}

export function terrainPointCount({ columns, rows }: TerrainGrid) {
  return (columns + 1) * (rows + 1);
}

/** Subdivisions of the rendered ground, by tank size alone so painting or
 * resizing the grid never changes the mesh. */
export function surfaceGrid(env: Dimensions): TerrainGrid {
  const grid = defaultGrid(env);
  return {
    columns: grid.columns * SURFACE_DETAIL,
    rows: grid.rows * SURFACE_DETAIL,
  };
}

/** Terrain for this tank, each point's height offset from `height`. */
export function newTerrain(
  env: Dimensions,
  height: (x: number, z: number) => number = () => 0,
  paint: GroundMaterial = "natural",
): Terrain {
  const grid = defaultGrid(env);
  const heights = Array.from({ length: terrainPointCount(grid) }, (_, i) => {
    const { x, z } = terrainPoint(i, { ...env, terrain: grid });
    return height(x, z);
  });
  return { ...grid, heights, paint: heights.map(() => paint) };
}

export function terrainPoint(index: number, env: Dimensions) {
  const { columns, rows } = terrainGrid(env);
  return {
    x: ((index % (columns + 1)) / columns - 0.5) * env.width,
    z: (Math.floor(index / (columns + 1)) / rows - 0.5) * env.depth,
  };
}

/** The four grid points around a spot in grid units, with bilinear weights. */
function gridSamples(gx: number, gz: number, { columns, rows }: TerrainGrid) {
  gx = Math.max(0, Math.min(columns, gx));
  gz = Math.max(0, Math.min(rows, gz));
  const ix = Math.min(columns - 1, Math.floor(gx)),
    iz = Math.min(rows - 1, Math.floor(gz));
  const tx = gx - ix,
    tz = gz - iz,
    index = iz * (columns + 1) + ix;
  return [
    { index, weight: (1 - tx) * (1 - tz) },
    { index: index + 1, weight: tx * (1 - tz) },
    { index: index + columns + 1, weight: (1 - tx) * tz },
    { index: index + columns + 2, weight: tx * tz },
  ];
}

/** Normalized coordinates retain a sculpted landscape when the tank is resized. */
export function terrainSamples(x: number, z: number, env: Dimensions) {
  const grid = terrainGrid(env);
  return gridSamples(
    (x / env.width + 0.5) * grid.columns,
    (z / env.depth + 0.5) * grid.rows,
    grid,
  );
}

function fitDivisions(divisions: number, length: number) {
  while (length / divisions > MAX_SPACING) divisions *= 2;
  while (length / divisions < MIN_SPACING && divisions % 2 === 0)
    divisions /= 2;
  return divisions;
}

/** Keeps a resized tank's grid points between the spacing limits. The
 * landscape stretches with the tank as before. Doubling only adds midpoints,
 * which leaves the bilinear surface exactly as it was, and halving drops
 * detail too fine to see at the new size. */
export function fitTerrain(terrain: Terrain, env: Dimensions): Terrain {
  const columns = fitDivisions(terrain.columns, env.width),
    rows = fitDivisions(terrain.rows, env.depth);
  if (columns === terrain.columns && rows === terrain.rows) return terrain;
  const length = terrainPointCount({ columns, rows });
  const heights: number[] = [],
    paint: GroundMaterial[] = [];
  for (let i = 0; i < length; i++) {
    const gx = ((i % (columns + 1)) / columns) * terrain.columns,
      gz = (Math.floor(i / (columns + 1)) / rows) * terrain.rows;
    const height = gridSamples(gx, gz, terrain).reduce(
      (sum, { index, weight }) => sum + terrain.heights[index] * weight,
      0,
    );
    heights.push(Math.round(height * 10000) / 10000 || 0);
    paint.push(
      terrain.paint[Math.round(gz) * (terrain.columns + 1) + Math.round(gx)],
    );
  }
  return { columns, rows, heights, paint };
}
