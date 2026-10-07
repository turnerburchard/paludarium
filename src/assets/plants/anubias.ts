import * as THREE from "three";
import { branch, material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const anubias: AssetDefinition = {
  kind: "anubias",
  name: "Anubias",
  scientificName: "Anubias barteri",
  group: "Aquatic plants",
  biomes: ["Tropical"],
  description:
    "Tough, dark leaves on a creeping rhizome. Grows above or below water, and is happiest tied onto wood or stone.",
  radius: 0.28,
  habitat: "either",
  shelter: true,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.35);
  skin.vertexColors = true;
  const green = new THREE.Color("#25552b"),
    rib = new THREE.Color("#3f7a3a");
  // A short rhizome creeps along the surface; leaves rise on stalks from it.
  const start = new THREE.Vector3(-0.12, 0.02, 0),
    end = new THREE.Vector3(0.12, 0.025, 0.02);
  branch(root, start, end, 0.022, material("#5c6b3a"));
  const count = 10 + Math.floor(random() * 4);
  for (let i = 0; i < count; i++) {
    const at = start.clone().lerp(end, (i + 0.5) / count);
    const angle = random() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const stalk = at
      .clone()
      .addScaledVector(out, 0.04)
      .setY(0.06 + random() * 0.06);
    branch(root, at, stalk, 0.006, material("#3d5f2f"));
    const length = 0.17 + random() * 0.08;
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.62,
        droop: 0.15,
        cup: 0.08,
        color: (_, edge) => (edge < 0.34 ? rib : green),
      }),
      skin,
      root,
    );
    placeLeaf(
      leaf,
      stalk,
      out.clone().setY(0.5 + random() * 0.5),
      new THREE.Vector3(0, 1, 0),
    );
  }
  return root;
}
