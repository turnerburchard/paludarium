import * as THREE from "three";
import type { Environment } from "../model/schema";
import { groundHeight } from "../model/terrain";
import {
  paintSamples,
  surfaceGrid,
  terrainGrid,
  terrainPoint,
  terrainPointCount,
  type GroundMaterial,
  type Terrain,
} from "../model/terrainData";

/** The ground's mesh, for one tank size. `drawTerrain` shapes and colors
 * it in place, so sculpting and painting never rebuild it. */
export function makeTerrain(env: Environment) {
  const { columns, rows } = surfaceGrid(env);
  const geo = new THREE.PlaneGeometry(env.width, env.depth, columns, rows);
  geo.rotateX(-Math.PI / 2);
  // Nudge inner points so facets are uneven triangles instead of a ruled
  // grid. Edge points stay on the walls so the sides still meet the surface.
  const p = geo.getAttribute("position");
  const step = Math.min(env.width / columns, env.depth / rows);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    if (
      Math.abs(x) >= env.width / 2 - 1e-6 ||
      Math.abs(z) >= env.depth / 2 - 1e-6
    )
      continue;
    p.setX(i, x + (hash(x, z) - 0.5) * 0.6 * step);
    p.setZ(i, z + (hash(z, x) - 0.5) * 0.6 * step);
  }
  // Unshared vertices let every facet carry its own flat color, like the
  // low-poly rocks and plants sitting on it.
  const faceted = geo.toNonIndexed();
  geo.dispose();
  const count = faceted.getAttribute("position").count;
  faceted.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
  );
  return faceted;
}
const soil = new THREE.Color("#443c2b"),
  sand = new THREE.Color("#a5936a");
const palette: Record<Exclude<GroundMaterial, "natural">, THREE.Color> = {
  soil,
  sand,
  stone: new THREE.Color("#74787b"),
  moss: soil,
};
/** Sets the ground's height and color from the terrain. With `area`, only
 * that part is redrawn, which keeps each brush dab cheap. */
export function drawTerrain(
  geo: THREE.BufferGeometry,
  env: Environment,
  area?: THREE.Box2,
) {
  const p = geo.getAttribute("position"),
    colors = geo.getAttribute("color");
  const color = new THREE.Color(),
    natural = new THREE.Color(),
    spot = new THREE.Vector2();
  const coverage = new Map<GroundMaterial, number>();
  let reshaped = false;
  for (let i = 0; i < p.count; i += 3) {
    let x = 0,
      z = 0;
    for (let v = i; v < i + 3; v++) {
      x += p.getX(v) / 3;
      z += p.getZ(v) / 3;
    }
    if (area && !area.containsPoint(spot.set(x, z))) continue;
    for (let v = i; v < i + 3; v++) {
      const h = groundHeight(p.getX(v), p.getZ(v), env);
      if (Math.fround(h) !== p.getY(v)) {
        p.setY(v, h);
        reshaped = true;
      }
    }
    const h = groundHeight(x, z, env);
    natural
      .copy(soil)
      .lerp(sand, THREE.MathUtils.clamp((0.55 - h) * 2.3, 0, 1));
    color.copy(natural);
    if (env.terrain) {
      coverage.clear();
      for (const { index, weight } of paintSamples(x, z, env)) {
        const material = env.terrain.paint[index];
        coverage.set(material, (coverage.get(material) ?? 0) + weight);
      }
      // Cubing the blend narrows the soft band between two materials.
      let total = 0;
      for (const weight of coverage.values()) total += weight ** 3;
      color.setRGB(0, 0, 0);
      for (const [material, weight] of coverage) {
        const source = material === "natural" ? natural : palette[material];
        color.r += (source.r * weight ** 3) / total;
        color.g += (source.g * weight ** 3) / total;
        color.b += (source.b * weight ** 3) / total;
      }
    }
    // Broad mottling plus a tone of its own for every facet, so the ground
    // reads as loose low-poly substrate rather than one smooth sheet.
    color.multiplyScalar(
      0.86 + 0.14 * grain(x, z, 0.18) + 0.14 * (hash(x, z) - 0.5),
    );
    for (let v = i; v < i + 3; v++) colors.setXYZ(v, color.r, color.g, color.b);
  }
  colors.needsUpdate = true;
  if (!reshaped) return;
  p.needsUpdate = true;
  geo.computeVertexNormals();
  // Raycasts skip a mesh whose stale bounds miss the pointer.
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}
/** The part of the ground that changed between two versions of its terrain,
 * or nothing when the grid itself changed and all of it needs redrawing. */
export function changedArea(
  before: Terrain | undefined,
  env: Environment,
): THREE.Box2 | undefined {
  const grid = terrainGrid(env),
    previous = terrainGrid({ ...env, terrain: before });
  if (grid.columns !== previous.columns || grid.rows !== previous.rows)
    return undefined;
  const area = new THREE.Box2();
  for (let index = 0; index < terrainPointCount(grid); index++) {
    const same =
      (before?.heights[index] ?? 0) === (env.terrain?.heights[index] ?? 0) &&
      (before?.paint[index] ?? "natural") ===
        (env.terrain?.paint[index] ?? "natural");
    if (same) continue;
    const { x, z } = terrainPoint(index, env);
    area.expandByPoint(new THREE.Vector2(x, z));
  }
  // A grid point's height and paint reach the ground up to two points away.
  return area.expandByScalar(
    2 * Math.max(env.width / grid.columns, env.depth / grid.rows),
  );
}
/** Smooth value noise between 0 and 1 that changes over about `cell`. Kept
 * wider than the mesh spacing so it never aliases into a pattern. */
export function grain(x: number, z: number, cell: number) {
  const gx = x / cell,
    gz = z / cell,
    ix = Math.floor(gx),
    iz = Math.floor(gz);
  const tx = THREE.MathUtils.smoothstep(gx - ix, 0, 1),
    tz = THREE.MathUtils.smoothstep(gz - iz, 0, 1);
  const corner = (i: number, j: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(corner(ix, iz), corner(ix + 1, iz), tx),
    THREE.MathUtils.lerp(corner(ix, iz + 1), corner(ix + 1, iz + 1), tx),
    tz,
  );
}

/** A stable pseudo-random value between 0 and 1 for one spot. */
export function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
