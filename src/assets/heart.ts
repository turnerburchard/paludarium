import * as THREE from "three";
import { mesh } from "./geometry";
import { triangles, type Point } from "./faceted";

/** Half a heart, from the tip back around the lobe to the notch at the
 * stalk, as fractions of the blade's length and width. */
const HEART: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.84, 0.16],
  [0.64, 0.3],
  [0.44, 0.41],
  [0.24, 0.47],
  [0.06, 0.46],
  [-0.1, 0.38],
  [-0.18, 0.24],
  [-0.15, 0.1],
  [0.02, 0],
];

export const sagAt = (t: number, droop: number, length: number) =>
  -droop * t * t * length;

/** A faceted heart in a frame where +Z runs along the midrib and +Y faces up.
 * Halves rise slightly from the midrib and the tip droops. */
export function heart(
  length: number,
  width: number,
  droop: number,
  mat: THREE.Material,
) {
  const outline = [
    ...HEART,
    ...HEART.slice(1, -1)
      .reverse()
      .map(([u, v]) => [u, -v] as const),
  ];
  const center = [0.38, 0] as const;
  const lift = (u: number, v: number): Point => {
    const side = Math.abs(v) * width;
    return [
      v * width,
      sagAt(u, droop, length) + side * 0.16 - (side * side * 0.5) / width,
      u * length,
    ];
  };
  // A center point, a middle ring and the outline give broad, even facets.
  const points: Point[] = [lift(...center)];
  for (const scale of [0.5, 1])
    for (const [u, v] of outline)
      points.push(
        lift(
          center[0] + (u - center[0]) * scale,
          center[1] + (v - center[1]) * scale,
        ),
      );
  const n = outline.length;
  const faces: number[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    faces.push(0, 1 + next, 1 + i);
    faces.push(1 + i, 1 + next, 1 + n + next);
    faces.push(1 + i, 1 + n + next, 1 + n + i);
  }
  const blade = new THREE.Group();
  mesh(triangles(points, faces), mat, blade);
  return blade;
}

export function orient(
  object: THREE.Object3D,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
) {
  const forward = new THREE.Vector3(direction.x, direction.y, direction.z);
  const up = new THREE.Vector3(normal.x, normal.y, normal.z);
  const side = new THREE.Vector3().crossVectors(up, forward);
  object.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(side, up, forward),
  );
  object.position.set(origin.x, origin.y, origin.z);
}
