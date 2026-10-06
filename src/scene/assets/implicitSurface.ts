import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

/** Signed distance fields let anatomical volumes meet without visible primitive seams. */
export type DistanceField = (x: number, y: number, z: number) => number;
export type Point = readonly [number, number, number];
export function ellipsoidField(center: Point, radius: Point): DistanceField {
  const [cx, cy, cz] = center,
    [rx, ry, rz] = radius;
  return (x, y, z) => {
    const px = (x - cx) / rx,
      py = (y - cy) / ry,
      pz = (z - cz) / rz;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const k1 = Math.sqrt(
      (px * px) / (rx * rx) + (py * py) / (ry * ry) + (pz * pz) / (rz * rz),
    );
    return k1 > 1e-8 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  };
}
export function taperedCapsule(
  start: Point,
  end: Point,
  startRadius: number,
  endRadius: number,
): DistanceField {
  const [ax, ay, az] = start,
    dx = end[0] - ax,
    dy = end[1] - ay,
    dz = end[2] - az,
    lengthSq = dx * dx + dy * dy + dz * dz;
  return (x, y, z) => {
    const t = THREE.MathUtils.clamp(
      ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / lengthSq,
      0,
      1,
    );
    return (
      Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) -
      THREE.MathUtils.lerp(startRadius, endRadius, t)
    );
  };
}
export function smoothUnion(
  fields: readonly DistanceField[],
  blend: number,
): DistanceField {
  return (x, y, z) => {
    let distance = fields[0](x, y, z);
    for (let i = 1; i < fields.length; i++) {
      const next = fields[i](x, y, z),
        h = Math.max(blend - Math.abs(distance - next), 0) / blend;
      distance = Math.min(distance, next) - h * h * blend * 0.25;
    }
    return distance;
  };
}
/** Generate once per species, then clone the compact mesh for each displayed animal. */
export function surfaceGeometry(
  field: DistanceField,
  resolution = 64,
): THREE.BufferGeometry {
  const placeholder = new THREE.MeshBasicMaterial();
  const effect = new MarchingCubes(
    resolution,
    placeholder,
    false,
    false,
    60000,
  );
  effect.isolation = 0;
  // A cubic sampling volume preserves correct normals when mapped back into world units.
  const halfExtent = 0.43,
    centerY = 0.2;
  for (let z = 0; z < resolution; z++)
    for (let y = 0; y < resolution; y++)
      for (let x = 0; x < resolution; x++) {
        const wx = (x / (resolution / 2) - 1) * halfExtent,
          wy = (y / (resolution / 2) - 1) * halfExtent + centerY,
          wz = (z / (resolution / 2) - 1) * halfExtent;
        effect.field[x + y * resolution + z * resolution * resolution] = -field(
          wx,
          wy,
          wz,
        );
      }
  effect.update();
  const count = effect.geometry.drawRange.count,
    geometry = new THREE.BufferGeometry();
  for (const name of ["position", "normal"]) {
    const source = effect.geometry.getAttribute(name);
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(
        new Float32Array(source.array.slice(0, count * 3)),
        3,
      ),
    );
  }
  geometry.scale(halfExtent, halfExtent, halfExtent);
  geometry.translate(0, centerY, 0);
  geometry.normalizeNormals();
  geometry.computeBoundingSphere();
  effect.geometry.dispose();
  placeholder.dispose();
  return geometry;
}
