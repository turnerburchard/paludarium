import * as THREE from "three";
import { material, curvedStem, blade } from "../geometry";
import type { AssetDefinition } from "../types";

export const fern: AssetDefinition = {
  kind: "fern",
  name: "Forest fern",
  category: "Plants",
  description: "Arching fronds, at home beside a shady pond.",
  radius: 0.36,
  habitat: "land",
  shelter: true,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#536f2d"),
    greens = [material("#568d3e"), material("#357345"), material("#6d9e48")];
  for (let i = 0; i < 9; i++) {
    const angle = (i * Math.PI * 2) / 9 + random() * 0.2,
      length = 0.7 + random() * 0.5;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const points = Array.from({ length: 9 }, (_, j) =>
      direction
        .clone()
        .multiplyScalar((j / 8) * length * 0.73)
        .setY(
          Math.sin((j / 8) * Math.PI * 0.86) * length * 0.7 + (j / 8) * 0.06,
        ),
    );
    curvedStem(root, points, 0.009, stem);
    for (let j = 1; j < 8; j++)
      for (const side of [-1, 1]) {
        const t = j / 8,
          p = points[j];
        const tangent = new THREE.Vector3(
          -Math.sin(angle) * side,
          0.12,
          Math.cos(angle) * side,
        ).addScaledVector(direction, 0.3);
        blade(
          root,
          p,
          tangent,
          (1 - t) * 0.31 + 0.04,
          0.12,
          greens[(i + j) % 3],
        );
      }
  }
  return root;
}
