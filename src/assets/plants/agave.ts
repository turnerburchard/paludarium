import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const agave: AssetDefinition = {
  kind: "agave",
  name: "Desert agave",
  scientificName: "Agave deserti",
  group: "Cacti & succulents",
  biomes: ["Desert"],
  description:
    "A tight rosette of thick, blue-grey leaves, each tipped with a dark spine.",
  radius: 0.32,
  size: 2,
  habitat: "land",
  shelter: true,
  soil: "arid",
  build,
};

const UP = new THREE.Vector3(0, 1, 0);

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.6);
  skin.vertexColors = true;
  const blue = new THREE.Color("#8aa49a"),
    pale = new THREE.Color("#a8bdb1"),
    tip = new THREE.Color("#3b2e26");
  const count = 18 + Math.floor(random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399;
    const inner = 1 - i / count;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const length = 0.24 + (1 - inner) * 0.12 + random() * 0.04;
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.32,
        droop: 0.05 + (1 - inner) * 0.15,
        cup: 0.25,
        color: (along, edge) =>
          along > 0.86 ? tip : edge < 0.34 ? pale : blue,
      }),
      skin,
      root,
    );
    placeLeaf(
      leaf,
      out.clone().multiplyScalar(0.015).setY(0.02),
      out
        .clone()
        .multiplyScalar(0.15 + (1 - inner) * 0.6)
        .setY(1),
      UP,
    );
  }
  return root;
}
