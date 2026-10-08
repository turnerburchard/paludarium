import * as THREE from "three";
import type { Environment } from "../model/schema";
import { randomFromSeed } from "../model/random";
import { groundHeight } from "../model/terrain";
import { surfaceGrid, terrainSamples } from "../model/terrainData";

export function makeGroundMoss(env: Environment) {
  const paint = env.terrain?.paint;
  if (!paint?.includes("moss")) return undefined;
  const { columns, rows } = surfaceGrid(env);
  const dark = new THREE.Color("#293c23"),
    light = new THREE.Color("#53633a");
  // Sample the whole grid, including bare ground, so painting never reshuffles detail.
  const random = randomFromSeed(31);
  const vertices = Array.from(
    { length: (columns + 1) * (rows + 1) },
    (_, index) => {
      const col = index % (columns + 1),
        row = Math.floor(index / (columns + 1));
      const x = (col / columns - 0.5) * env.width;
      const z = (row / rows - 0.5) * env.depth;
      const coverage = terrainSamples(x, z, env).reduce(
        (sum, sample) =>
          sum + (paint[sample.index] === "moss" ? sample.weight : 0),
        0,
      );
      const ground = groundHeight(x, z, env);
      const lift = 0.003 + random() * 0.022 * coverage;
      const color = dark.clone().lerp(light, random());
      return {
        x,
        y: ground + lift,
        z,
        color,
        visible: coverage > 0.25 && ground > env.water + 0.025,
      };
    },
  );
  const positions: number[] = [],
    colors: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * (columns + 1) + col;
      for (const triangle of [
        [index, index + columns + 1, index + 1],
        [index + 1, index + columns + 1, index + columns + 2],
      ]) {
        if (!triangle.every((i) => vertices[i].visible)) continue;
        for (const i of triangle) {
          const { x, y, z, color } = vertices[i];
          positions.push(x, y, z);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
  }
  if (!positions.length) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
