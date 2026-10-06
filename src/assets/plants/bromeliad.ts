import * as THREE from "three";
import { material, branch, blade } from "../geometry";
import type { AssetDefinition } from "../types";

export const bromeliad: AssetDefinition = {
  kind: "bromeliad",
  name: "Scarlet star",
  scientificName: "Guzmania lingulata",
  category: "Plants",
  description: "A splash of coral among deep green leaves.",
  radius: 0.32,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const leaves = [
    material("#366d40"),
    material("#487a41"),
    material("#8caa54"),
  ];
  for (let i = 0; i < 13; i++) {
    const a = i * 2.4;
    blade(
      root,
      new THREE.Vector3(0, 0.03, 0),
      new THREE.Vector3(
        Math.cos(a) * 0.7,
        0.3 + random() * 0.5,
        Math.sin(a) * 0.7,
      ),
      0.6 + random() * 0.2,
      0.16,
      leaves[i % 3],
    );
  }
  const flower = material("#e46747"),
    tip = material("#f2a263");
  branch(
    root,
    new THREE.Vector3(),
    new THREE.Vector3(0, 0.62, 0),
    0.02,
    flower,
  );
  for (let i = 0; i < 8; i++) {
    const a = i * 2.4;
    blade(
      root,
      new THREE.Vector3(0, 0.4 + i * 0.03, 0),
      new THREE.Vector3(Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7),
      0.22,
      0.12,
      i % 2 ? flower : tip,
    );
  }
  return root;
}
