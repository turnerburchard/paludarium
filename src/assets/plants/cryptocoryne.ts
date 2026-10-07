import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const cryptocoryne: AssetDefinition = {
  kind: "cryptocoryne",
  name: "Water trumpet",
  scientificName: "Cryptocoryne cordata",
  group: "Aquatic plants",
  biomes: ["Tropical"],
  description:
    "Wavy bronze-green leaves with rosy undersides, from the slow forest streams of Southeast Asia. Grows above or below water.",
  radius: 0.24,
  habitat: "either",
  shelter: true,
  build,
};

const UP = new THREE.Vector3(0, 1, 0);

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.55);
  skin.vertexColors = true;
  const bronze = new THREE.Color("#5e6a34"),
    green = new THREE.Color("#4d7034"),
    rose = new THREE.Color("#8a4a45");
  const count = 9 + Math.floor(random() * 4);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + random() * 0.3;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const stalk = out
      .clone()
      .multiplyScalar(0.05 + random() * 0.04)
      .setY(0.08 + random() * 0.1);
    branch(root, new THREE.Vector3(), stalk, 0.005, material("#6b4a3c"));
    const length = 0.12 + random() * 0.06;
    const tone = random() < 0.5 ? bronze : green;
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.55,
        droop: 0.2,
        cup: 0.05,
        wave: 0.05,
        color: (along, edge) => (edge > 0.67 && along > 0.2 ? rose : tone),
      }),
      skin,
      root,
    );
    placeLeaf(leaf, stalk, out.clone().setY(0.35 + random() * 0.35), UP);
  }
  return root;
}
