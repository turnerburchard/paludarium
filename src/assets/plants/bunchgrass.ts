import * as THREE from "three";
import { blade, branch, material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";

export const bunchgrass: AssetDefinition = {
  kind: "bunchgrass",
  name: "Indian ricegrass",
  scientificName: "Achnatherum hymenoides",
  category: "Plants",
  description:
    "A dry, wiry bunchgrass whose airy seed heads catch the light over sand.",
  radius: 0.22,
  habitat: "land",
  shelter: true,
  soil: "arid",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const colors = [
    material("#a69a62"),
    material("#bfae72"),
    material("#8d8a55"),
  ];
  for (let i = 0; i < 26; i++) {
    const a = random() * Math.PI * 2;
    blade(
      root,
      new THREE.Vector3((random() - 0.5) * 0.08, 0, (random() - 0.5) * 0.08),
      new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35),
      0.25 + random() * 0.2,
      0.018,
      colors[i % 3],
    );
  }
  // Thin stalks end in loose sprays of pale seeds.
  const stalk = material("#c9b984"),
    seed = material("#efe6c8");
  for (let i = 0; i < 6; i++) {
    const a = random() * Math.PI * 2;
    const top = new THREE.Vector3(
      Math.cos(a) * 0.12,
      0.38 + random() * 0.12,
      Math.sin(a) * 0.12,
    );
    branch(root, new THREE.Vector3(), top, 0.003, stalk);
    for (let s = 0; s < 6; s++) {
      const b = random() * Math.PI * 2;
      const tip = top
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(b) * 0.05,
            random() * 0.04,
            Math.sin(b) * 0.05,
          ),
        );
      branch(root, top, tip, 0.0015, stalk);
      mesh(new THREE.IcosahedronGeometry(0.007, 0), seed, root, tip);
    }
  }
  return root;
}
