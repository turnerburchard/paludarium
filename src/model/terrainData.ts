export const TERRAIN_COLUMNS = 32;
export const TERRAIN_ROWS = 24;
export const TERRAIN_POINTS = (TERRAIN_COLUMNS + 1) * (TERRAIN_ROWS + 1);
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

interface Dimensions {
  width: number;
  depth: number;
}

export function terrainPoint(index: number, env: Dimensions) {
  return {
    x: ((index % (TERRAIN_COLUMNS + 1)) / TERRAIN_COLUMNS - 0.5) * env.width,
    z:
      (Math.floor(index / (TERRAIN_COLUMNS + 1)) / TERRAIN_ROWS - 0.5) *
      env.depth,
  };
}

/** Normalized coordinates retain a sculpted landscape when the tank is resized. */
export function terrainSamples(x: number, z: number, env: Dimensions) {
  const gx = Math.max(
    0,
    Math.min(TERRAIN_COLUMNS, (x / env.width + 0.5) * TERRAIN_COLUMNS),
  );
  const gz = Math.max(
    0,
    Math.min(TERRAIN_ROWS, (z / env.depth + 0.5) * TERRAIN_ROWS),
  );
  const ix = Math.min(TERRAIN_COLUMNS - 1, Math.floor(gx)),
    iz = Math.min(TERRAIN_ROWS - 1, Math.floor(gz));
  const tx = gx - ix,
    tz = gz - iz,
    index = iz * (TERRAIN_COLUMNS + 1) + ix;
  return [
    { index, weight: (1 - tx) * (1 - tz) },
    { index: index + 1, weight: tx * (1 - tz) },
    { index: index + TERRAIN_COLUMNS + 1, weight: (1 - tx) * tz },
    { index: index + TERRAIN_COLUMNS + 2, weight: tx * tz },
  ];
}
