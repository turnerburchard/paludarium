import * as THREE from "three";
import { branch, curvedStem, material, mesh } from "../geometry";
import { placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const treePhilodendron: AssetDefinition = {
  kind: "tree-philodendron",
  name: "Lacy tree philodendron",
  scientificName: "Thaumatophyllum bipinnatifidum",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "Deeply lobed, glossy leaves spreading from a short trunk on the rainforest floor.",
  radius: 0.45,
  size: 1.5,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

const UP = new THREE.Vector3(0, 1, 0);

function build(random: () => number) {
  const root = new THREE.Group();
  const stalk = material("#668047");
  const trunk = material("#716344");
  branch(
    root,
    new THREE.Vector3(),
    new THREE.Vector3(0, 0.18, 0),
    0.045,
    trunk,
  );
  const foliage = material("#ffffff", 0.38);
  foliage.vertexColors = true;
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.399 + random() * 0.25;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const young = i >= 6;
    const reach = young ? 0.12 : 0.2 + random() * 0.06;
    const height = young ? 0.53 + random() * 0.08 : 0.37 + random() * 0.12;
    const origin = out.clone().multiplyScalar(reach).setY(height);
    curvedStem(
      root,
      [
        new THREE.Vector3(0, 0.12 + i * 0.006, 0),
        out
          .clone()
          .multiplyScalar(reach * 0.35)
          .setY(height * 0.75),
        origin,
      ],
      0.008,
      stalk,
    );
    const length = young ? 0.27 + random() * 0.05 : 0.38 + random() * 0.07;
    const leaf = mesh(lobedLeaf(length, length * 0.8, random()), foliage, root);
    placeLeaf(
      leaf,
      origin,
      out.clone().setY(young ? 0.8 : 0.12 + random() * 0.25),
      UP,
    );
  }
  return root;
}

/** Deep sinuses stop at a continuous midrib. Each half curls independently,
 * giving the lobes volume even when the blade is seen from the side. */
function lobedLeaf(length: number, width: number, phase: number) {
  const rows = 72;
  const across = 4;
  const positions: number[] = [];
  const colors: number[] = [];
  const green = new THREE.Color("#3d7436");
  const light = new THREE.Color("#568946");
  const point = (i: number, j: number, side: number) => {
    const t = i / rows;
    const s = j / across;
    const lobes =
      0.22 + 0.78 * ((1 + Math.cos(t * Math.PI * 12 + side * 0.3)) / 2) ** 0.65;
    const half = width * 0.5 * Math.sin(Math.PI * t ** 0.7) ** 0.65 * lobes;
    const x = side * s * half;
    return [
      x,
      t * length,
      length * (0.13 * Math.sin(Math.PI * t) - 0.28 * t * t) +
        width * Math.sin(Math.PI * t) * s * s * 0.06 +
        Math.sin(t * 28 + side + phase) * s * s * width * 0.018,
    ];
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < across; j++) {
        const a = point(i, j, side),
          b = point(i + 1, j, side);
        const c = point(i + 1, j + 1, side),
          d = point(i, j + 1, side);
        const tone = green
          .clone()
          .lerp(light, j === 0 ? 0.65 : 0.15 + 0.2 * Math.sin(i * 0.7 + phase));
        for (const vertex of side > 0
          ? [a, b, c, a, c, d]
          : [a, c, b, a, d, c]) {
          positions.push(...vertex);
          colors.push(tone.r, tone.g, tone.b);
        }
      }
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
