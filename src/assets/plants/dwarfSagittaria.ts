import * as THREE from "three";
import { material, mesh } from "../geometry";
import type { AssetDefinition } from "../types";
import { ribbon } from "./vallisneria";

export const dwarfSagittaria: AssetDefinition = {
  kind: "dwarf-sagittaria",
  name: "Dwarf sagittaria",
  scientificName: "Sagittaria subulata",
  category: "Plants",
  description:
    "Little grassy rosettes that spread by runners into a low carpet across the pool floor.",
  radius: 0.34,
  habitat: "water",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.6);
  skin.vertexColors = true;
  // Rosettes scattered over the patch, each a small fan of short straps.
  const rosettes = 18 + Math.floor(random() * 6);
  for (let r = 0; r < rosettes; r++) {
    const angle = r * 2.4 + random(),
      reach = Math.sqrt(random()) * 0.3;
    const center = new THREE.Vector3(
      Math.cos(angle) * reach,
      0,
      Math.sin(angle) * reach,
    );
    const leaves = 6 + Math.floor(random() * 3);
    for (let i = 0; i < leaves; i++) {
      const heading = (i / leaves) * Math.PI * 2 + random();
      mesh(ribbon(center, heading, 0.08 + random() * 0.08, random), skin, root);
    }
  }
  return root;
}
