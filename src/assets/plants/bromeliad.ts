import * as THREE from "three";
import { material, branch, blade } from "../geometry";
import { bromeliadLeaves } from "../../model/plantSurfaces";
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
  perches: bromeliadLeaves,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const leaves = [
    material("#366d40"),
    material("#487a41"),
    material("#8caa54"),
  ];
  for (const [i, surface] of bromeliadLeaves(random).entries()) {
    blade(
      root,
      new THREE.Vector3(surface.tip.x, surface.tip.y, surface.tip.z),
      new THREE.Vector3(
        surface.direction.x,
        surface.direction.y,
        surface.direction.z,
      ),
      surface.length,
      surface.width,
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
