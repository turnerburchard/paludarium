import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const fittonia: AssetDefinition = {
  kind: "fittonia",
  name: "Nerve plant",
  scientificName: "Fittonia albivenis",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "A low mound of small leaves netted with pink veins, cover for insects.",
  radius: 0.3,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.6);
  skin.vertexColors = true;
  const green = new THREE.Color("#2e6b3a"),
    vein = new THREE.Color("#e48aa0");
  const count = 30;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + random() * 0.5;
    const reach = Math.sqrt(i / count) * 0.24;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const base = out
      .clone()
      .multiplyScalar(reach)
      .setY(0.02 + (1 - reach / 0.24) * 0.1 + random() * 0.02);
    const length = 0.13 + random() * 0.05;
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.7,
        droop: 0.1,
        cup: 0.1,
        // The pink net: the midrib and a few side veins.
        color: (along, edge) =>
          edge < 0.34 || Math.abs(((along * 5 + edge * 1.5) % 1) - 0.5) < 0.12
            ? vein
            : green,
      }),
      skin,
      root,
    );
    placeLeaf(
      leaf,
      base,
      out.clone().setY(0.25 + random() * 0.3),
      new THREE.Vector3(0, 1, 0),
    );
  }
  return root;
}
