import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const begonia: AssetDefinition = {
  kind: "begonia",
  name: "Painted begonia",
  scientificName: "Begonia rex",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "Broad, lopsided leaves splashed with silver and edged in deep red, from shady limestone forests.",
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
  const silver = new THREE.Color("#b9c2b4"),
    green = new THREE.Color("#3f5a36"),
    wine = new THREE.Color("#5e2230");
  const count = 6 + Math.floor(random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + random() * 0.4;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const stalk = out
      .clone()
      .multiplyScalar(0.08 + random() * 0.05)
      .setY(0.08 + random() * 0.1);
    branch(root, new THREE.Vector3(), stalk, 0.008, material("#7a3a3a"));
    const length = 0.2 + random() * 0.08;
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.8,
        droop: 0.12,
        cup: 0.06,
        wave: 0.03,
        // A silver band between a dark heart and a red rim.
        color: (along, edge) => {
          if (edge > 0.67) return wine;
          if (edge > 0.34 && along > 0.15 && along < 0.85) return silver;
          return green;
        },
      }),
      skin,
      root,
    );
    leaf.scale.x = 0.8 + random() * 0.35;
    placeLeaf(
      leaf,
      stalk,
      out.clone().setY(0.1 + random() * 0.2),
      new THREE.Vector3(0, 1, 0),
    );
  }
  return root;
}
