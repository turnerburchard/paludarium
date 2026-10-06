import * as THREE from "three";
import { material, curvedStem, blade } from "../geometry";
import type { AssetDefinition } from "../types";

export const monstera: AssetDefinition = {
  kind: "monstera",
  name: "Monstera",
  scientificName: "Monstera deliciosa",
  category: "Plants",
  description: "Big split leaves for a lush tropical canopy.",
  radius: 0.48,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group(),
    stem = material("#507139");
  const greens = ["#245c36", "#337a43", "#458d4d", "#265f38"];
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399 + random() * 0.3,
      height = 0.7 + random() * 0.95;
    const tip = new THREE.Vector3(
      Math.cos(angle) * (0.25 + height * 0.23),
      height,
      Math.sin(angle) * (0.25 + height * 0.23),
    );
    curvedStem(
      root,
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(tip.x * 0.2, height * 0.6, tip.z * 0.2),
        tip,
      ],
      0.022,
      stem,
    );
    const direction = new THREE.Vector3(
      Math.cos(angle) * 0.85,
      0.15 + random() * 0.35,
      Math.sin(angle) * 0.85,
    );
    const leaf = blade(
      root,
      tip,
      direction,
      0.65 + height * 0.15,
      0.68,
      material(greens[i % 4]),
      true,
    );
    // A raised midrib catches the light and makes the simplified foliage read as a plant.
    curvedStem(
      leaf,
      [
        new THREE.Vector3(0, 0, 0.005),
        new THREE.Vector3(0, 0.35, 0.13),
        new THREE.Vector3(0, 0.72, 0.02),
      ],
      0.006,
      stem,
    );
  }
  return root;
}
