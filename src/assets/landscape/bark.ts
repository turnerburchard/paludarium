import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ringVolume, triangles, type Point } from "../faceted";

export function barkMaterials() {
  const bark = material("#665342", 0.94);
  bark.vertexColors = true;
  return { bark, cut: material("#a18a67", 0.95) };
}

/** A tapered, seven-sided limb through `points`, with banded bark facets and
 * inset end grain at its far end. */
export function barkLimb(
  root: THREE.Object3D,
  points: readonly Point[],
  radii: readonly number[],
  { bark, cut }: ReturnType<typeof barkMaterials>,
) {
  const centers = points.map((p) => new THREE.Vector3(...p));
  const rings = limbRings(points, radii);
  mesh(banded(ringVolume(rings)), bark, root);
  // Inset end grain instead of a floating circular cap.
  const last = rings.at(-1)!;
  const center = centers.at(-1)!;
  const capPoints: Point[] = last.map((p) => {
    const inset = new THREE.Vector3(...p).lerp(center, 0.12);
    return [inset.x, inset.y, inset.z];
  });
  const faces = Array.from({ length: 5 }, (_, i) => [0, i + 1, i + 2]).flat();
  const cap = mesh(triangles(capPoints, faces), cut, root);
  cap.position.copy(
    centers
      .at(-1)!
      .clone()
      .sub(centers.at(-2)!)
      .normalize()
      .multiplyScalar(0.001),
  );
}

/** Cross sections through `points`, each square to the limb. */
export function limbRings(
  points: readonly Point[],
  radii: readonly number[],
  sides = 7,
): Point[][] {
  const centers = points.map((p) => new THREE.Vector3(...p));
  return centers.map((center, i) => {
    const axis = centers[Math.min(i + 1, centers.length - 1)]
      .clone()
      .sub(centers[Math.max(0, i - 1)])
      .normalize();
    const reference =
      Math.abs(axis.y) > 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(axis, reference).normalize();
    const v = new THREE.Vector3().crossVectors(axis, u).normalize();
    return Array.from({ length: sides }, (_, side): Point => {
      const angle = (side * Math.PI * 2) / sides;
      const radius = radii[i] * (1 + Math.sin(side * 2.7 + i) * 0.13);
      const p = center
        .clone()
        .addScaledVector(u, Math.cos(angle) * radius)
        .addScaledVector(v, Math.sin(angle) * radius);
      return [p.x, p.y, p.z];
    });
  });
}

/** Alternating face tones so bark reads as split, faceted planes. */
export function banded(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 3) {
    const tone = new THREE.Color("#ffffff").multiplyScalar(
      0.82 + (0.18 * ((i / 3) % 4)) / 3,
    );
    for (let j = 0; j < 3; j++)
      colors.set([tone.r, tone.g, tone.b], (i + j) * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}
