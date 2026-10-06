import * as THREE from "three";
import { material, mesh } from "../geometry";
import { triangles, type Point } from "../faceted";
import type { AssetDefinition } from "../types";

export const leafLitter: AssetDefinition = {
  kind: "leaf-litter",
  name: "Leaf litter",
  category: "Landscape",
  description:
    "A drift of fallen leaves. Insects breed beneath it and frogs hunt over it.",
  radius: 0.45,
  habitat: "land",
  shelter: true,
  build,
};

const BROWNS = ["#7a4f2a", "#9b6a35", "#5e3d22", "#a8804a", "#6e5130"];

function build(random: () => number) {
  const root = new THREE.Group();
  const colors = BROWNS.map((color) => material(color, 0.95));
  const count = 80;
  for (let i = 0; i < count; i++) {
    // Denser toward the middle, thinning out at the edge.
    const distance = Math.sqrt(random()) * 0.42;
    const angle = random() * Math.PI * 2;
    const length = 0.09 + random() * 0.08;
    const leaf = mesh(
      fallenLeaf(length, length * (0.5 + random() * 0.25), random() * 0.5),
      colors[Math.floor(random() * colors.length)],
      root,
      [
        Math.cos(angle) * distance,
        0.012 + (i / count) * 0.016,
        Math.sin(angle) * distance,
      ],
    );
    leaf.rotation.set(
      (random() - 0.5) * 0.3,
      random() * Math.PI * 2,
      (random() - 0.5) * 0.3,
    );
  }
  return root;
}

/** A leaf lying flat with its edges curled up, folded along the midrib. */
function fallenLeaf(length: number, width: number, curl: number) {
  const half = width / 2;
  const rise = half * (0.2 + curl);
  const points: Point[] = [
    [0, 0, -length / 2],
    [0, 0, length / 2],
    [-half, rise, -length * 0.08],
    [half, rise, -length * 0.08],
    [-half * 0.6, rise * 0.7, length * 0.26],
    [half * 0.6, rise * 0.7, length * 0.26],
    [-half * 0.5, rise * 0.6, -length * 0.36],
    [half * 0.5, rise * 0.6, -length * 0.36],
  ];
  return triangles(
    points,
    [
      [0, 6, 2],
      [0, 2, 4],
      [0, 4, 1],
      [0, 3, 7],
      [0, 5, 3],
      [0, 1, 5],
    ].flat(),
  );
}
