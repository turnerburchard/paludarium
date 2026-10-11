import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const bucephalandra: AssetDefinition = {
  kind: "bucephalandra",
  name: "Bucephalandra",
  scientificName: "Bucephalandra sp.",
  group: "Aquatic plants",
  biomes: ["Tropical"],
  description:
    "Small, wavy leaves in dark teal and purple on a creeping rhizome. It clings to rocks in fast Bornean streams, above or below the water.",
  radius: 0.2,
  habitat: "either",
  shelter: true,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.3);
  skin.vertexColors = true;
  const teal = new THREE.Color("#1d4a40"),
    purple = new THREE.Color("#4b3048"),
    bronze = new THREE.Color("#7b3d2e");
  // The rhizome forks as it creeps, and leaves crowd its tips.
  const base = new THREE.Vector3(0, 0.015, 0);
  const tips = [0, 1, 2].map((i) => {
    const angle = (i / 3) * Math.PI * 2 + random();
    const tip = new THREE.Vector3(
      Math.cos(angle) * 0.08,
      0.02,
      Math.sin(angle) * 0.08,
    );
    branch(root, base, tip, 0.008, material("#35342a"));
    return tip;
  });
  for (const tip of tips) {
    const count = 4 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const stalk = tip
        .clone()
        .addScaledVector(out, 0.015)
        .setY(0.03 + random() * 0.03);
      branch(root, tip, stalk, 0.004, material("#3b4a30"));
      const length = 0.09 + random() * 0.05;
      // The newest leaves unfurl bronze before they darken.
      const young = random() < 0.12;
      const leaf = mesh(
        ovalLeaf({
          length,
          width: length * 0.38,
          droop: 0.08,
          cup: 0.12,
          wave: 0.03,
          color: (_, edge) =>
            young ? bronze : teal.clone().lerp(purple, edge * 0.8),
        }),
        skin,
        root,
      );
      placeLeaf(
        leaf,
        stalk,
        out.clone().setY(0.8 + random() * 0.7),
        new THREE.Vector3(0, 1, 0),
      );
    }
  }
  return root;
}
