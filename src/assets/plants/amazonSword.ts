import * as THREE from "three";
import { material, mesh } from "../geometry";
import { ovalLeaf, placeLeaf } from "../leaves";
import type { AssetDefinition } from "../types";

export const amazonSword: AssetDefinition = {
  kind: "amazon-sword",
  name: "Amazon sword",
  scientificName: "Echinodorus grisebachii",
  group: "Aquatic plants",
  biomes: ["Tropical"],
  description:
    "A broad rosette of long, sword-shaped leaves that anchors a planted pool.",
  radius: 0.4,
  habitat: "water",
  build,
};

function build(random: () => number) {
  const root = new THREE.Group();
  const skin = material("#ffffff", 0.55);
  skin.vertexColors = true;
  const light = new THREE.Color("#7fae45"),
    dark = new THREE.Color("#3f7a2e"),
    rib = new THREE.Color("#a9c96a");
  const count = 14 + Math.floor(random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + random() * 0.4;
    // Inner leaves stand tall; outer ones arch out and down.
    const inner = 1 - i / count;
    const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const length = 0.35 + inner * 0.35 + random() * 0.1;
    const tone = dark.clone().lerp(light, 0.3 + inner * 0.5);
    const leaf = mesh(
      ovalLeaf({
        length,
        width: length * 0.36,
        droop: 0.45 - inner * 0.3,
        cup: 0.12,
        color: (_, edge) => (edge < 0.34 ? rib : tone),
      }),
      skin,
      root,
    );
    placeLeaf(
      leaf,
      out.clone().multiplyScalar(0.02).setY(0.02),
      out
        .clone()
        .multiplyScalar(0.5 - inner * 0.35)
        .setY(0.6 + inner * 0.6),
      new THREE.Vector3(0, 1, 0),
    );
  }
  return root;
}
