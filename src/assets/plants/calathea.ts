import * as THREE from "three";
import { curvedStem, material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const calathea: AssetDefinition = {
  kind: "calathea",
  name: "Prayer plant",
  scientificName: "Goeppertia orbifolia",
  group: "Leafy plants",
  biomes: ["Tropical"],
  description:
    "Round leaves banded in silver and green, held up on slender stalks.",
  radius: 0.36,
  habitat: "land",
  shelter: true,
  soil: "damp",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const stalk = material("#6b7f4a");
  const skin = material("#ffffff", 0.5);
  skin.vertexColors = true;
  const dark = new THREE.Color("#2f6b3d"),
    silver = new THREE.Color("#a9c79a");
  const count = 9;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + random() * 0.4;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const height = 0.25 + random() * 0.3;
    const base = out
      .clone()
      .multiplyScalar(0.06 + height * 0.25)
      .setY(height);
    curvedStem(
      root,
      [
        new THREE.Vector3(),
        out
          .clone()
          .multiplyScalar(0.03)
          .setY(height * 0.6),
        base,
      ],
      0.007,
      stalk,
    );
    const length = 0.24 + random() * 0.08;
    // Silver bands follow the side veins across a broad, rounded leaf.
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.85,
        droop: 0.15,
        cup: 0.12,
        color: (along, edge) =>
          Math.sin(along * 26 - edge * 3) > 0.35 ? silver : dark,
      }),
      skin,
      root,
    );
    const direction = out.clone().setY(0.25 + random() * 0.45);
    placeLeaf(leaf, base, direction, new THREE.Vector3(0, 1, 0));
  }
  return root;
}
