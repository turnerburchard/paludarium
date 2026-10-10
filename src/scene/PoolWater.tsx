import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Environment } from "../model/schema";
import { clamp, groundHeight } from "../model/terrain";
import { cellCenter, type WaterMap } from "../model/water";

/** Depth over which a pool thins out to nothing at its shore. */
const SHORE = 0.015;

/** A pool's surface over its cells and the ring around them, laid out in a
 * plane's own frame (x right, y away from the viewer) so the water material's
 * ripples line up with the tank's water. Each corner fades with the depth
 * under it, so the water's edge follows the ground between grid lines. */
function poolGeometry(
  index: number,
  map: WaterMap,
  env: Environment,
): THREE.BufferGeometry {
  const { level, cells } = map.pools[index];
  const step = { x: env.width / map.columns, z: env.depth / map.rows };
  const inPool = (column: number, row: number) =>
    column >= 0 &&
    column < map.columns &&
    row >= 0 &&
    row < map.rows &&
    map.poolAt[row * map.columns + column] === index;
  const positions: number[] = [],
    fade: number[] = [],
    indices: number[] = [];
  const corners = new Map<number, number>();
  // Corners are numbered on the grid one wider than the cells.
  const corner = (column: number, row: number) => {
    const key = row * (map.columns + 1) + column;
    let vertex = corners.get(key);
    if (vertex !== undefined) return vertex;
    vertex = corners.size;
    corners.set(key, vertex);
    const x = -env.width / 2 + column * step.x,
      z = -env.depth / 2 + row * step.z;
    const wet =
      inPool(column - 1, row - 1) ||
      inPool(column, row - 1) ||
      inPool(column - 1, row) ||
      inPool(column, row);
    positions.push(x, -z, 0);
    fade.push(wet ? clamp((level - groundHeight(x, z, env)) / SHORE, 0, 1) : 0);
    return vertex;
  };
  const covered = new Set<number>();
  for (const cell of cells) {
    const column = cell % map.columns,
      row = Math.floor(cell / map.columns);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = column + dc,
          r = row + dr;
        if (c < 0 || c >= map.columns || r < 0 || r >= map.rows) continue;
        covered.add(r * map.columns + c);
      }
  }
  for (const cell of covered) {
    const column = cell % map.columns,
      row = Math.floor(cell / map.columns);
    const a = corner(column, row),
      b = corner(column + 1, row),
      c = corner(column, row + 1),
      d = corner(column + 1, row + 1);
    // Wound to face up once the plane is laid flat.
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("fade", new THREE.Float32BufferAttribute(fade, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Where a pool meets the glass, the water seen through it: a strip down
 * each cell's edge from the surface to the ground. */
function glassGeometry(index: number, map: WaterMap, env: Environment) {
  const { level, cells } = map.pools[index];
  const positions: number[] = [];
  const strip = (x0: number, z0: number, x1: number, z1: number) => {
    const g0 = Math.min(level, groundHeight(x0, z0, env)),
      g1 = Math.min(level, groundHeight(x1, z1, env));
    positions.push(x0, g0, z0, x1, g1, z1, x1, level, z1);
    positions.push(x0, g0, z0, x1, level, z1, x0, level, z0);
  };
  const halfX = env.width / 2 - 0.008,
    halfZ = env.depth / 2 - 0.008;
  for (const cell of cells) {
    const column = cell % map.columns,
      row = Math.floor(cell / map.columns);
    const { x, z } = cellCenter(cell, map, env);
    const dx = env.width / map.columns / 2,
      dz = env.depth / map.rows / 2;
    if (row === 0) strip(x - dx, -halfZ, x + dx, -halfZ);
    if (row === map.rows - 1) strip(x - dx, halfZ, x + dx, halfZ);
    if (column === 0) strip(-halfX, z - dz, -halfX, z + dz);
    if (column === map.columns - 1) strip(halfX, z - dz, halfX, z + dz);
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

/** A pool a spring keeps full, standing above the tank's water. */
export function PoolWater({
  index,
  map,
  environment: env,
  material,
  glass,
}: {
  index: number;
  map: WaterMap;
  environment: Environment;
  material: THREE.Material;
  glass: THREE.Material;
}) {
  const surface = useMemo(
    () => poolGeometry(index, map, env),
    [index, map, env],
  );
  const sides = useMemo(
    () => glassGeometry(index, map, env),
    [index, map, env],
  );
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => sides?.dispose(), [sides]);
  return (
    <group>
      <mesh
        geometry={surface}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, map.pools[index].level, 0]}
        receiveShadow
        renderOrder={2}
      />
      {sides && <mesh geometry={sides} material={glass} renderOrder={3} />}
    </group>
  );
}
