import * as THREE from "three";
import { material, blade } from "../geometry";
import type { AssetDefinition } from "../types";

export const grass: AssetDefinition = {
  kind: "grass",
  name: "Sedge",
  group: "Grasses",
  biomes: ["Tropical", "Temperate", "Desert"],
  description: "Soft grassy tufts for the edge of the water.",
  radius: 0.24,
  habitat: "land",
  shelter: true,
  soil: "shore",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    colors = [material("#718b3d"), material("#829e48"), material("#486d37")];
  for (let i = 0; i < 28; i++) {
    const a = random() * Math.PI * 2;
    blade(
      root,
      new THREE.Vector3((random() - 0.5) * 0.12, 0, (random() - 0.5) * 0.12),
      new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5),
      0.35 + random() * 0.5,
      0.035,
      colors[i % 3],
    );
  }
  return root;
}
