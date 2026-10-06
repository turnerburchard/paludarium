import * as THREE from "three";
import { material, curvedStem, blade } from "../geometry";
import { fernFronds, fernPerches } from "../../model/plantSurfaces";
import type { AssetDefinition } from "../types";

export const fern: AssetDefinition = {
  kind: "fern",
  name: "Forest fern",
  category: "Plants",
  description: "Arching fronds, at home beside a shady pond.",
  radius: 0.36,
  habitat: "land",
  shelter: true,
  soil: "damp",
  perches: fernPerches,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#536f2d"),
    greens = [material("#568d3e"), material("#357345"), material("#6d9e48")];
  for (const [i, frond] of fernFronds(random).entries()) {
    const { angle } = frond;
    const direction = new THREE.Vector3(
      frond.direction.x,
      frond.direction.y,
      frond.direction.z,
    );
    const points = frond.points.map(
      (point) => new THREE.Vector3(point.x, point.y, point.z),
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
