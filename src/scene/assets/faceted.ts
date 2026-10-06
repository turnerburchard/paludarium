import * as THREE from "three";

export type Point = readonly [number, number, number];

/** Explicit triangles keep authored silhouettes and planar faces easy to inspect. */
export function triangles(
  points: readonly Point[],
  faces: readonly number[],
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      faces.flatMap((index) => [...points[index]]),
      3,
    ),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** A closed, low-sided volume from deliberate cross sections along an axis. */
export function ringVolume(
  rings: readonly (readonly Point[])[],
): THREE.BufferGeometry {
  const sides = rings[0].length;
  const points: Point[] = rings.flatMap((ring) => [...ring]);
  const faces: number[] = [];
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      const a = ring * sides + side,
        b = ring * sides + next;
      const c = (ring + 1) * sides + side,
        d = (ring + 1) * sides + next;
      faces.push(a, b, d, a, d, c);
    }
  for (const [ring, reverse] of [
    [0, true],
    [rings.length - 1, false],
  ] as const) {
    const offset = ring * sides;
    for (let side = 1; side < sides - 1; side++)
      faces.push(
        offset,
        offset + (reverse ? side + 1 : side),
        offset + (reverse ? side : side + 1),
      );
  }
  return triangles(points, faces);
}
