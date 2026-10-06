import * as THREE from "three";
import { material, mesh } from "./geometry";
import { ringVolume, triangles, type Point } from "./faceted";

export function rock(random: () => number) {
  const root = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.47, 2),
    positions = geo.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const rough = 1 + 0.13 * Math.sin(x * 21 + z * 9) * Math.cos(y * 17);
    positions.setXYZ(
      i,
      x * rough * 1.1,
      Math.max(-0.22, y * rough * 0.85),
      z * rough * 0.8,
    );
  }
  geo.computeVertexNormals();
  const stone = material(
    new THREE.Color().setHSL(0.13, 0.075, 0.23 + random() * 0.1),
  );
  stone.flatShading = true;
  mesh(geo, stone, root, [0, 0.22, 0]);
  return root;
}
/** Shallow connected ground cover with tiny upright fronds, never stacked spheres. */
export function moss(random: () => number) {
  const root = new THREE.Group();
  const outline = Array.from({ length: 12 }, (_, i) => ({
    angle: (i * Math.PI) / 6,
    radius: 0.29 + random() * 0.08,
  }));
  const rings = [
    outline.map(
      ({ angle, radius }): Point => [
        Math.cos(angle) * radius,
        0.002,
        Math.sin(angle) * radius,
      ],
    ),
    outline.map(
      ({ angle, radius }): Point => [
        Math.cos(angle) * radius,
        0.008 + random() * 0.007,
        Math.sin(angle) * radius,
      ],
    ),
    outline.map(
      ({ angle, radius }): Point => [
        Math.cos(angle) * radius * 0.48,
        0.025 + random() * 0.016,
        Math.sin(angle) * radius * 0.48,
      ],
    ),
    outline.map(
      ({ angle }): Point => [
        Math.cos(angle) * 0.018,
        0.028,
        Math.sin(angle) * 0.018,
      ],
    ),
  ];
  const surface = ringVolume(rings);
  const positions = surface.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const palette = ["#50672b", "#617b31", "#718736"].map(
    (c) => new THREE.Color(c),
  );
  for (let i = 0; i < positions.count; i += 3) {
    const color = palette[Math.floor(random() * palette.length)];
    for (let j = 0; j < 3; j++)
      colors.set([color.r, color.g, color.b], (i + j) * 3);
  }
  surface.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = material("#ffffff", 0.95);
  mat.vertexColors = true;
  mesh(surface, mat, root);
  const fronds = material("#82964b", 0.95);
  for (let tuft = 0; tuft < 22; tuft++) {
    const a = random() * Math.PI * 2,
      radius = Math.sqrt(random()) * 0.28;
    const x = Math.cos(a) * radius,
      z = Math.sin(a) * radius;
    const y = 0.03 - radius * 0.055;
    for (let leaf = 0; leaf < 3; leaf++) {
      const angle = a + leaf * 2.1;
      const length = 0.022 + random() * 0.034;
      mesh(
        triangles(
          [
            [x, y, z],
            [
              x + Math.cos(angle) * length,
              y + length * 0.65,
              z + Math.sin(angle) * length,
            ],
            [
              x - Math.sin(angle) * 0.008,
              y + 0.014,
              z + Math.cos(angle) * 0.008,
            ],
            [
              x + Math.sin(angle) * 0.008,
              y + 0.014,
              z - Math.cos(angle) * 0.008,
            ],
          ],
          [0, 2, 1, 0, 1, 3],
        ),
        fronds,
        root,
      );
    }
  }
  return root;
}

/** Weathered, tapered sections with irregular angular grain and broken end faces. */
export function wood() {
  const root = new THREE.Group();
  const bark = material("#665342", 0.94);
  bark.vertexColors = true;
  const cut = material("#a18a67", 0.95);
  function limb(points: readonly Point[], radii: readonly number[]) {
    const centers = points.map((p) => new THREE.Vector3(...p));
    const rings = centers.map((center, i) => {
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
      return Array.from({ length: 7 }, (_, side): Point => {
        const angle = (side * Math.PI * 2) / 7;
        const radius = radii[i] * (1 + Math.sin(side * 2.7 + i) * 0.13);
        const p = center
          .clone()
          .addScaledVector(u, Math.cos(angle) * radius)
          .addScaledVector(v, Math.sin(angle) * radius);
        return [p.x, p.y, p.z];
      });
    });
    const geometry = ringVolume(rings);
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
    mesh(geometry, bark, root);
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
  limb(
    [
      [-0.52, 0.115, -0.015],
      [-0.19, 0.15, 0.02],
      [0.12, 0.19, 0.03],
      [0.5, 0.2, 0.1],
    ],
    [0.1, 0.11, 0.085, 0.055],
  );
  limb(
    [
      [-0.15, 0.16, 0.02],
      [0, 0.31, -0.13],
      [0.2, 0.49, -0.26],
    ],
    [0.052, 0.033, 0.013],
  );
  limb(
    [
      [0.17, 0.2, 0.05],
      [0.37, 0.13, 0.23],
      [0.58, 0.085, 0.36],
    ],
    [0.035, 0.024, 0.008],
  );
  return root;
}
