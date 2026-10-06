import * as THREE from "three";

export interface OvalLeaf {
  length: number;
  width: number;
  /** How far the tip hangs below a flat blade, as a fraction of its length. */
  droop: number;
  /** How much the halves rise from the midrib. */
  cup: number;
  /** Ripples along the edge, as in a bird's nest fern; zero for smooth. */
  wave?: number;
  /** Face color by position along the leaf (0 at the stalk, 1 at the tip)
   * and out from the midrib (0 to 1 at the edge). */
  color(along: number, out: number): THREE.Color;
}

/** A faceted, pointed oval blade along +Y with its face toward +Z, colored
 * face by face so stripes and veins are part of the geometry. */
export function ovalLeaf(leaf: OvalLeaf): THREE.BufferGeometry {
  const along = 14,
    across = 3;
  const positions: number[] = [];
  const colors: number[] = [];
  const point = (i: number, j: number, side: number) => {
    const t = i / along,
      s = j / across;
    const half = (leaf.width / 2) * Math.sin(Math.PI * t ** 0.85) ** 0.8;
    const x = side * s * half;
    const ripple = (leaf.wave ?? 0) * Math.sin(t * 22) * s * leaf.width;
    return [
      x,
      t * leaf.length,
      -leaf.droop * t * t * leaf.length + s * half * leaf.cup + ripple,
    ];
  };
  for (const side of [-1, 1])
    for (let i = 0; i < along; i++)
      for (let j = 0; j < across; j++) {
        const a = point(i, j, side),
          b = point(i + 1, j, side),
          c = point(i + 1, j + 1, side),
          d = point(i, j + 1, side);
        const tone = leaf.color((i + 0.5) / along, (j + 0.5) / across);
        // Keep the winding facing +Z on both halves.
        const faces = side > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
        for (const corner of faces) {
          positions.push(...corner);
          colors.push(tone.r, tone.g, tone.b);
        }
      }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Turns a leaf built along +Y facing +Z so it points along `direction`
 * with its face toward `normal`, its stalk end at `origin`. */
export function placeLeaf(
  object: THREE.Object3D,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  normal: THREE.Vector3,
) {
  const up = direction.clone().normalize();
  const face = normal.clone().addScaledVector(up, -normal.dot(up)).normalize();
  const side = new THREE.Vector3().crossVectors(up, face);
  object.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(side, up, face),
  );
  object.position.copy(origin);
}
