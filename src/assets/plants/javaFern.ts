import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const javaFern: AssetDefinition = {
  kind: "java-fern",
  name: "Java fern",
  scientificName: "Microsorum pteropus",
  group: "Aquatic plants",
  biomes: ["Tropical"],
  description:
    "Long, rippled blades in an arching clump. Grows above or below water, rooted on wood or stone.",
  radius: 0.32,
  habitat: "either",
  shelter: true,
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.5);
  skin.vertexColors = true;
  const green = new THREE.Color("#3e7034"),
    pale = new THREE.Color("#6d9a45");
  const count = 9 + Math.floor(random() * 4);
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const length = 0.3 + random() * 0.22;
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.2,
        droop: 0.2 + random() * 0.15,
        cup: 0.05,
        wave: 0.12,
        // Young blades are paler toward the tip.
        color: (along, edge) =>
          edge < 0.34 ? pale : green.clone().lerp(pale, along * 0.4),
      }),
      skin,
      root,
    );
    placeLeaf(
      leaf,
      out.clone().multiplyScalar(0.03).setY(0.02),
      out
        .clone()
        .multiplyScalar(0.35 + random() * 0.3)
        .setY(1),
      new THREE.Vector3(0, 1, 0),
    );
  }
  return root;
}
