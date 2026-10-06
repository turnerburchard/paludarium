import * as THREE from "three";
import { material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";

export const rock: AssetDefinition = {
  kind: "rock",
  name: "River stone",
  category: "Landscape",
  description:
    "Weathered stone. Vary its size and turn for a natural arrangement.",
  radius: 0.42,
  habitat: "either",
  blocksMovement: true,
  build,
};

function build(random: () => number) {
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
